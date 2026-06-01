import { NextRequest, NextResponse } from "next/server";
import { syncCosts } from "@/lib/costSync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // Pro면 길게. Hobby는 10s 상한.

// Vercel Cron은 Authorization: Bearer ${CRON_SECRET} 를 자동으로 붙여준다.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const out = await syncCosts();
  return NextResponse.json(out);
}
