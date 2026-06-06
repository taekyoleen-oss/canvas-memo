import { createClient } from "@supabase/supabase-js";

// 비용 모니터 전용 service_role 클라이언트.
// 기존 lib/supabase/client.ts(anon)·server.ts(SSR)와 분리.
// service_role 키는 서버에서만 사용, 절대 클라이언트로 노출 금지.
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase env(NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)가 설정되지 않았습니다.");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * 비용 모니터에 필요한 서버 환경변수 중 빠진 것의 이름 목록.
 * 비어 있으면 설정 완료. 라우트가 throw(500) 대신 명확한 안내를 주기 위해 사용.
 */
export function missingCostEnv(): string[] {
  const miss: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) miss.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) miss.push("SUPABASE_SERVICE_ROLE_KEY");
  return miss;
}

export type DailyCostRow = {
  provider: "anthropic" | "openai";
  usage_date: string; // YYYY-MM-DD
  line_item: string;
  amount_usd: number;
  raw?: unknown;
};
