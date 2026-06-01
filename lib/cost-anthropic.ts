import type { DailyCostRow } from "@/lib/supabase/admin";

// Anthropic Cost API: GET /v1/organizations/cost_report
// 일별 버킷 고정. group_by[]=description 으로 모델/항목별 분해.
// 응답 amount는 문자열(USD). Admin 키(sk-ant-admin...) + 조직(Organization) 설정 필요.

const BASE = "https://api.anthropic.com/v1/organizations/cost_report";

type AnthropicResult = {
  currency: string;
  amount: string;
  description?: string;
  cost_type?: string;
  model?: string;
};

type AnthropicBucket = {
  starting_at: string;
  ending_at: string;
  results: AnthropicResult[];
};

type AnthropicResponse = {
  data: AnthropicBucket[];
  has_more: boolean;
  next_page: string | null;
};

export async function fetchAnthropicCosts(
  startISO: string,
  endISO: string
): Promise<DailyCostRow[]> {
  const key = process.env.ANTHROPIC_ADMIN_KEY;
  if (!key) throw new Error("ANTHROPIC_ADMIN_KEY 미설정");

  const rows: DailyCostRow[] = [];
  let page: string | null = null;

  do {
    const params = new URLSearchParams({
      starting_at: startISO,
      ending_at: endISO,
      limit: "31",
    });
    params.append("group_by[]", "description");
    if (page) params.set("page", page);

    const res = await fetch(`${BASE}?${params.toString()}`, {
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as AnthropicResponse;

    for (const bucket of json.data) {
      const usageDate = bucket.starting_at.slice(0, 10);
      for (const r of bucket.results) {
        rows.push({
          provider: "anthropic",
          usage_date: usageDate,
          line_item: r.description ?? r.model ?? "total",
          amount_usd: Number(r.amount) || 0,
          raw: r,
        });
      }
    }
    page = json.has_more ? json.next_page : null;
  } while (page);

  return rows;
}
