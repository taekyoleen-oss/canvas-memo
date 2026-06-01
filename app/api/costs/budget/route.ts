import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 패널에서 월 예산 한도 수정 → budgets upsert.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: {
    provider?: string;
    monthly_limit_usd?: number;
    alert_threshold?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const provider = body.provider;
  const limit = Number(body.monthly_limit_usd);
  if (
    (provider !== "anthropic" && provider !== "openai") ||
    !Number.isFinite(limit) ||
    limit < 0
  ) {
    return NextResponse.json({ error: "invalid params" }, { status: 400 });
  }
  const threshold =
    Number.isFinite(Number(body.alert_threshold)) &&
    Number(body.alert_threshold) > 0 &&
    Number(body.alert_threshold) <= 1
      ? Number(body.alert_threshold)
      : 0.8;

  const db = supabaseAdmin();
  const { error } = await db.from("budgets").upsert(
    {
      provider,
      monthly_limit_usd: limit,
      alert_threshold: threshold,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "provider" }
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
