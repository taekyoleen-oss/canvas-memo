import { createClient } from "@/lib/supabase/client";
import { v4 as uuidv4 } from "uuid";

/**
 * 사용자 계정에 받은 메모 보드(is_inbox=true)가 없으면 자동 생성.
 * 이미 존재하면 해당 보드의 id만 반환.
 * Chrome 확장 프로그램(add-in Browser)이 스크랩을 저장할 기본 목적지.
 */
export async function ensureInboxBoard(userId: string): Promise<string | null> {
  const supabase = createClient();

  const { data: existing } = await supabase
    .from("boards")
    .select("id")
    .eq("user_id", userId)
    .eq("is_inbox", true)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const now = new Date().toISOString();
  const id = uuidv4();

  const { error } = await supabase.from("boards").insert({
    id,
    user_id: userId,
    name: "받은 메모",
    icon: "📥",
    color: "#6366f1",
    board_category: "memo_schedule",
    sidebar_order: -1,  // 메모/할일 카테고리 최상단 고정
    is_inbox: true,
    viewport: { x: 0, y: 0, zoom: 1 },
    created_at: now,
    updated_at: now,
  });

  if (error) {
    // UNIQUE 제약 위반 = 동시 생성 경쟁 — 다시 조회
    if (error.code === "23505") {
      const { data: retry } = await supabase
        .from("boards")
        .select("id")
        .eq("user_id", userId)
        .eq("is_inbox", true)
        .maybeSingle();
      return retry?.id ?? null;
    }
    console.error("[inboxBoard] ensureInboxBoard failed:", error.message);
    return null;
  }

  return id;
}
