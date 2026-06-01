import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncCosts } from "@/lib/costSync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// 패널 "새로고침" — 로그인 사용자가 직접 동기화 실행.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const out = await syncCosts();
  return NextResponse.json(out);
}
