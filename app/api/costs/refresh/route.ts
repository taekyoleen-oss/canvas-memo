import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { missingCostEnv } from "@/lib/supabase/admin";
import { syncCosts } from "@/lib/costSync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// 패널 "새로고침" — 로그인 사용자가 직접 동기화 실행.
// 선택 body { days } 로 백필 기간 지정(기본 30일, 최대 366일).
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const miss = missingCostEnv();
  if (miss.length) {
    return NextResponse.json(
      {
        error: `비용 모니터 환경변수가 설정되지 않았습니다: ${miss.join(", ")}. 배포(Vercel) 환경변수에 추가하세요.`,
        code: "not_configured",
      },
      { status: 503 }
    );
  }

  // 기간 파싱: 기본 30, 1~366일로 제한.
  let days = 30;
  try {
    const body = (await req.json()) as { days?: number };
    if (body && Number.isFinite(Number(body.days))) {
      days = Math.min(366, Math.max(1, Math.floor(Number(body.days))));
    }
  } catch {
    // body 없음 → 기본 30일
  }

  try {
    const out = await syncCosts(days);
    return NextResponse.json({ ...out, days });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: `동기화 실패: ${msg}`, code: "server_error" },
      { status: 500 }
    );
  }
}
