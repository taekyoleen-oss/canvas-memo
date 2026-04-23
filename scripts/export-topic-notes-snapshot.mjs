/**
 * 주제별(topic_notes) 보드와 연결된 modules / connections / groups 만 스냅샷으로 저장합니다.
 *
 * 사용:
 *   pnpm run export:topic-notes -- <auth_user_uuid>
 * 또는 .env.local 에 EXPORT_USER_ID=<uuid> 후
 *   pnpm run export:topic-notes
 *
 * 출력: exports/topic-notes-<타임스탬프>.json , 동일 이름 .txt (읽기용 요약)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./_loadEnvLocal.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function stripHtml(html) {
  if (html == null || typeof html !== "string") return "";
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function main() {
  const env = loadEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const userId = process.argv[2] || env.EXPORT_USER_ID;
  if (!url || !serviceKey) {
    console.error("NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.");
    process.exit(1);
  }
  if (!userId) {
    console.error(
      "사용자 UUID가 필요합니다.\n  pnpm run export:topic-notes -- <user_uuid>\n또는 .env.local 에 EXPORT_USER_ID 설정"
    );
    process.exit(1);
  }

  void run(url, serviceKey, userId);
}

async function run(url, serviceKey, userId) {
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: boards, error: bErr } = await supabase
    .from("boards")
    .select("*")
    .eq("user_id", userId)
    .eq("board_category", "topic_notes")
    .order("sidebar_order", { ascending: true });

  if (bErr) {
    console.error("boards 조회 실패:", bErr.message);
    process.exit(1);
  }

  const boardList = boards ?? [];
  const boardIds = boardList.map((b) => b.id);
  if (boardIds.length === 0) {
    console.warn("주제별(topic_notes) 보드가 0개입니다. 빈 스냅샷을 씁니다.");
  }

  let modules = [];
  let connections = [];
  let groups = [];

  if (boardIds.length > 0) {
    const { data: m, error: mErr } = await supabase.from("modules").select("*").in("board_id", boardIds);
    if (mErr) {
      console.error("modules 조회 실패:", mErr.message);
      process.exit(1);
    }
    modules = m ?? [];

    const modIds = modules.map((x) => x.id);
    const { data: c, error: cErr } = await supabase.from("connections").select("*").in("board_id", boardIds);
    if (cErr) {
      console.error("connections 조회 실패:", cErr.message);
      process.exit(1);
    }
    connections = c ?? [];

    const { data: g, error: gErr } = await supabase.from("groups").select("*").in("board_id", boardIds);
    if (gErr) {
      console.error("groups 조회 실패:", gErr.message);
      process.exit(1);
    }
    groups = g ?? [];
  }

  const exportedAt = new Date().toISOString();
  const snapshot = {
    snapshotVersion: 1,
    kind: "mindcanvas-topic-notes",
    exportedAt,
    userId,
    boards: boardList,
    modules,
    connections,
    groups,
  };

  const stamp = exportedAt.replace(/[:.]/g, "-");
  const outDir = path.join(__dirname, "..", "exports");
  fs.mkdirSync(outDir, { recursive: true });
  const base = path.join(outDir, `topic-notes-${stamp}`);
  const jsonPath = `${base}.json`;
  fs.writeFileSync(jsonPath, JSON.stringify(snapshot, null, 2), "utf8");

  const lines = [];
  lines.push("MindCanvas — 주제별(topic_notes) 스냅샷 (읽기용 요약)");
  lines.push(`보낸 시각(UTC): ${exportedAt}`);
  lines.push(`사용자 user_id: ${userId}`);
  lines.push(`보드 ${boardList.length}개 · 모듈 ${modules.length}개 · 연결 ${connections.length}개 · 그룹 ${groups.length}개`);
  lines.push("");
  lines.push("복원은 topic-notes-*.json 파일로 import-topic-notes 스크립트를 사용하세요.");
  lines.push("");

  for (const b of boardList) {
    lines.push(`## 보드: ${b.name ?? "(이름 없음)"}  (id: ${b.id})`);
    const bMods = modules.filter((m) => m.board_id === b.id);
    for (const m of bMods) {
      const d = m.data && typeof m.data === "object" ? m.data : {};
      const title = stripHtml(d.title ?? "");
      const content = stripHtml(d.content ?? "");
      lines.push(`  - [${m.type}] ${title || "(제목 없음)"}`);
      if (content) {
        const prev = content.length > 500 ? content.slice(0, 500) + "…" : content;
        lines.push(`    ${prev}`);
      }
    }
    lines.push("");
  }

  const txtPath = `${base}.txt`;
  fs.writeFileSync(txtPath, lines.join("\n"), "utf8");

  console.log("저장 완료:");
  console.log(" ", jsonPath);
  console.log(" ", txtPath);
}

main();
