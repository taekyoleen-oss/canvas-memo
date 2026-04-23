/**
 * export-topic-notes-snapshot.mjs 로 만든 JSON을 Supabase에 다시 넣습니다.
 * (DB 복원 후 같은 계정 또는 --target-user 로 지정한 계정에 upsert)
 *
 * 사용:
 *   pnpm run import:topic-notes -- exports/topic-notes-xxxx.json
 * 다른 계정으로 넣을 때:
 *   pnpm run import:topic-notes -- exports/topic-notes-xxxx.json <target_user_uuid>
 *
 * 순서: boards → modules → groups → connections (FK)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./_loadEnvLocal.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function main() {
  const fileArg = process.argv[2];
  const targetUserId = process.argv[3];

  if (!fileArg) {
    console.error(
      "사용법: pnpm run import:topic-notes -- <snapshot.json> [target_user_uuid]\n" +
        "  target_user_uuid 생략 시 스냅샷의 userId 사용"
    );
    process.exit(1);
  }

  const jsonPath = path.isAbsolute(fileArg) ? fileArg : path.join(process.cwd(), fileArg);
  if (!fs.existsSync(jsonPath)) {
    console.error("파일 없음:", jsonPath);
    process.exit(1);
  }

  const raw = fs.readFileSync(jsonPath, "utf8");
  let snap;
  try {
    snap = JSON.parse(raw);
  } catch (e) {
    console.error("JSON 파싱 실패:", e.message);
    process.exit(1);
  }

  if (snap.kind !== "mindcanvas-topic-notes" || snap.snapshotVersion !== 1) {
    console.error("지원하지 않는 스냅샷 형식입니다. kind / snapshotVersion 확인.");
    process.exit(1);
  }

  const uid = targetUserId || snap.userId;
  if (!uid) {
    console.error("userId가 없습니다. JSON의 userId 또는 두 번째 인자로 target UUID를 주세요.");
    process.exit(1);
  }

  void run(jsonPath, snap, uid);
}

function reassignUserId(rows, userId) {
  if (!rows?.length) return [];
  return rows.map((r) => ({ ...r, user_id: userId }));
}

async function run(jsonPath, snap, targetUserId) {
  const env = loadEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const boards = reassignUserId(snap.boards ?? [], targetUserId);
  const modules = reassignUserId(snap.modules ?? [], targetUserId);
  const connections = reassignUserId(snap.connections ?? [], targetUserId);
  const groups = reassignUserId(snap.groups ?? [], targetUserId);

  console.log("가져오기:", jsonPath);
  console.log(`대상 user_id: ${targetUserId} (스냅샷 원본 user: ${snap.userId ?? "?"})`);
  console.log(`boards ${boards.length} · modules ${modules.length} · groups ${groups.length} · connections ${connections.length}`);

  if (boards.length) {
    const { error } = await supabase.from("boards").upsert(boards, { onConflict: "id" });
    if (error) {
      console.error("boards upsert 실패:", error.message);
      process.exit(1);
    }
    console.log("boards upsert 완료");
  }

  if (modules.length) {
    const { error } = await supabase.from("modules").upsert(modules, { onConflict: "id" });
    if (error) {
      console.error("modules upsert 실패:", error.message);
      process.exit(1);
    }
    console.log("modules upsert 완료");
  }

  if (groups.length) {
    const { error } = await supabase.from("groups").upsert(groups, { onConflict: "id" });
    if (error) {
      console.error("groups upsert 실패:", error.message);
      process.exit(1);
    }
    console.log("groups upsert 완료");
  }

  if (connections.length) {
    const { error } = await supabase.from("connections").upsert(connections, { onConflict: "id" });
    if (error) {
      console.error("connections upsert 실패:", error.message);
      process.exit(1);
    }
    console.log("connections upsert 완료");
  }

  console.log("주제별 스냅샷 반영이 끝났습니다. 앱에서 새로고침하세요.");
}

main();
