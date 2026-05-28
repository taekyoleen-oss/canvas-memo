import { createClient } from "@/lib/supabase/client";
import { v4 as uuidv4 } from "uuid";
import type { SharedModuleInput } from "@/lib/share/classifyShare";

/**
 * Web Share Target 으로 들어온 모듈을 받은 메모 보드에 Supabase 로 직접 기록한다.
 *
 * /share-target 페이지는 zustand 스토어가 hydrate 되어 있지 않으므로
 * (hydrateForUser / hydrateFromSupabase 는 app/page.tsx 에서만 호출됨)
 * `addSharedModulesToInbox` 액션을 거치면 boards 가 비어 있어 데이터가 손실된다.
 *
 * 이 함수는 zustand 를 우회해 modules 테이블에 직접 insert 하므로
 * 홈으로 리다이렉트되면 hydrateFromSupabase 가 자연스럽게 새 모듈을 가져온다.
 */
export async function persistSharedModulesToInbox(
  userId: string,
  inboxBoardId: string,
  modules: SharedModuleInput[]
): Promise<{ insertedCount: number; ids: string[] }> {
  if (modules.length === 0) return { insertedCount: 0, ids: [] };

  const supabase = createClient();
  const now = new Date().toISOString();

  // 새로 들어온 항목은 보드 상단에 stack 형태로 배치. STEP·GAP 은 store 의 액션과 동일.
  const GAP = 28;
  const CARD_H_GUESS = 200;
  const STEP = CARD_H_GUESS + GAP;

  const ids: string[] = [];
  const rows = modules.map((mi, idx) => {
    const id = uuidv4();
    ids.push(id);
    return {
      id,
      board_id: inboxBoardId,
      user_id: userId,
      type: mi.type,
      position: { x: 48, y: 72 + idx * STEP },
      size: mi.size,
      z_index: mi.zIndex ?? 1,
      color: mi.color ?? "default",
      is_expanded: mi.isExpanded ?? false,
      is_minimized: false,
      data: mi.data,
      created_at: now,
      updated_at: now,
    };
  });

  const { error } = await supabase.from("modules").insert(rows);
  if (error) {
    console.error("[persistSharedModules] insert failed:", error.message);
    return { insertedCount: 0, ids: [] };
  }

  // 보드 자체의 updated_at 도 갱신 (정렬·캐시 무효화 효과).
  await supabase
    .from("boards")
    .update({ updated_at: now })
    .eq("id", inboxBoardId)
    .eq("user_id", userId);

  return { insertedCount: rows.length, ids };
}
