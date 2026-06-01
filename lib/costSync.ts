import { fetchAnthropicCosts } from "@/lib/cost-anthropic";
import { fetchOpenAICosts } from "@/lib/cost-openai";
import { supabaseAdmin, type DailyCostRow } from "@/lib/supabase/admin";

// cron(/api/cron/sync)과 수동 새로고침(/api/costs/refresh)이 공유하는 동기화 로직.
// 최근 며칠을 다시 긁어 upsert (비용 확정 지연 보정). 한 provider가 실패해도 다른 쪽은 진행.
export async function syncCosts(
  lookbackDays = 5
): Promise<{ synced_at: string; results: Record<string, string> }> {
  const db = supabaseAdmin();
  const now = new Date();
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - lookbackDays);
  start.setUTCHours(0, 0, 0, 0);

  const startISO = start.toISOString();
  const endISO = now.toISOString();
  const startUnix = Math.floor(start.getTime() / 1000);
  const endUnix = Math.floor(now.getTime() / 1000);

  const results: Record<string, string> = {};

  const tasks: Array<[string, Promise<DailyCostRow[]>]> = [
    ["anthropic", fetchAnthropicCosts(startISO, endISO)],
    ["openai", fetchOpenAICosts(startUnix, endUnix)],
  ];

  for (const [provider, task] of tasks) {
    try {
      const rows = await task;
      if (rows.length) {
        const { error } = await db.from("daily_costs").upsert(
          rows.map((r) => ({ ...r, updated_at: new Date().toISOString() })),
          { onConflict: "provider,usage_date,line_item" }
        );
        if (error) throw error;
      }
      results[provider] = `ok (${rows.length} rows)`;
      await db
        .from("sync_log")
        .insert({ provider, status: "ok", detail: `${rows.length} rows` });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      results[provider] = `error: ${msg}`;
      await db.from("sync_log").insert({ provider, status: "error", detail: msg });
    }
  }

  return { synced_at: endISO, results };
}
