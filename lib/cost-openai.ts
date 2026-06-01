import type { DailyCostRow } from "@/lib/supabase/admin";

// OpenAI Costs API: GET /v1/organization/costs
// start_time/end_time 은 Unix seconds. bucket_width=1d. group_by[]=line_item.
// 응답 amount는 { value, currency } 객체. Admin 키(sk-admin-...) 필요.

const BASE = "https://api.openai.com/v1/organization/costs";

type OpenAIResult = {
  amount: { value: number; currency: string };
  line_item?: string | null;
  project_id?: string | null;
};

type OpenAIBucket = {
  start_time: number;
  end_time: number;
  results: OpenAIResult[];
};

type OpenAIResponse = {
  data: OpenAIBucket[];
  has_more: boolean;
  next_page: string | null;
};

export async function fetchOpenAICosts(
  startUnix: number,
  endUnix: number
): Promise<DailyCostRow[]> {
  const key = process.env.OPENAI_ADMIN_KEY;
  if (!key) throw new Error("OPENAI_ADMIN_KEY 미설정");

  const rows: DailyCostRow[] = [];
  let page: string | null = null;

  do {
    const params = new URLSearchParams({
      start_time: String(startUnix),
      end_time: String(endUnix),
      bucket_width: "1d",
      limit: "180",
    });
    params.append("group_by[]", "line_item");
    if (page) params.set("page", page);

    const res = await fetch(`${BASE}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as OpenAIResponse;

    for (const bucket of json.data) {
      const usageDate = new Date(bucket.start_time * 1000)
        .toISOString()
        .slice(0, 10);
      for (const r of bucket.results) {
        rows.push({
          provider: "openai",
          usage_date: usageDate,
          line_item: r.line_item ?? "total",
          amount_usd: r.amount?.value ?? 0,
          raw: r,
        });
      }
    }
    page = json.has_more ? json.next_page : null;
  } while (page);

  return rows;
}
