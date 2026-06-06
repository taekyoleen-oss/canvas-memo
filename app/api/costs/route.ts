import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin, missingCostEnv } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DailyRow = {
  provider: "anthropic" | "openai";
  usage_date: string;
  amount_usd: number;
};
type Budget = {
  provider: string;
  monthly_limit_usd: number;
  alert_threshold: number;
};

// 로그인 사용자만 자신(소유자)의 API 지출을 본다. 지출 데이터는 민감 → 세션 필수.
export async function GET() {
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

  try {
    const db = supabaseAdmin();
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 60);

    const [{ data: costs }, { data: budgets }] = await Promise.all([
      db
        .from("daily_costs")
        .select("provider, usage_date, amount_usd")
        .gte("usage_date", since.toISOString().slice(0, 10))
        .order("usage_date", { ascending: true }),
      db.from("budgets").select("provider, monthly_limit_usd, alert_threshold"),
    ]);

    const byDate = new Map<string, { anthropic: number; openai: number }>();
    for (const r of (costs ?? []) as DailyRow[]) {
      const slot = byDate.get(r.usage_date) ?? { anthropic: 0, openai: 0 };
      slot[r.provider] += Number(r.amount_usd);
      byDate.set(r.usage_date, slot);
    }
    const series = [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v, total: v.anthropic + v.openai }));

    const monthStart = new Date();
    monthStart.setUTCDate(1);
    const mStr = monthStart.toISOString().slice(0, 10);
    const mtd = { anthropic: 0, openai: 0 };
    for (const s of series) {
      if (s.date >= mStr) {
        mtd.anthropic += s.anthropic;
        mtd.openai += s.openai;
      }
    }

    return NextResponse.json({
      series,
      mtd,
      budgets: (budgets ?? []) as Budget[],
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: `비용 데이터 조회 실패: ${msg}`, code: "server_error" },
      { status: 500 }
    );
  }
}
