/**
 * Supabase에 「클로드」「한양」 관련 boards / modules / connections 행이 있는지 확인합니다.
 * 사용: pnpm node scripts/check-db-claude-hanyang.mjs
 * 필요: .env.local 의 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
  const p = path.join(__dirname, "..", ".env.local");
  const raw = fs.readFileSync(p, "utf8");
  const env = {};
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[k] = v;
  }
  return env;
}

function textHasAny(hay, needles) {
  const s = typeof hay === "string" ? hay : hay == null ? "" : JSON.stringify(hay);
  return needles.some((n) => s.includes(n));
}

const needles = ["클로드", "클로드 코드", "한양", "한양대"];

async function main() {
  const env = loadEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 가 없습니다.");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: boardRows, error: boardErr } = await supabase
    .from("boards")
    .select("id,name,board_category,user_id,created_at")
    .order("created_at", { ascending: true });

  if (boardErr) {
    console.error("boards 조회 오류:", boardErr.message);
    process.exit(1);
  }

  const boards = boardRows ?? [];
  const boardsByName = boards.filter((b) =>
    needles.some((n) => (b.name ?? "").includes(n))
  );

  const boardIds = new Set(boards.map((b) => b.id));

  const { data: modRows, error: modErr } = await supabase
    .from("modules")
    .select("id,board_id,user_id,type,data,created_at")
    .order("created_at", { ascending: true });

  if (modErr) {
    console.error("modules 조회 오류:", modErr.message);
    process.exit(1);
  }

  const modules = modRows ?? [];
  const modulesHit = modules.filter((m) => {
    const d = m.data;
    const title = d && typeof d === "object" ? d.title : undefined;
    const content = d && typeof d === "object" ? d.content : undefined;
    return (
      textHasAny(title, needles) ||
      textHasAny(content, needles) ||
      textHasAny(d, needles)
    );
  });

  const boardIdsFromMods = new Set(modulesHit.map((m) => m.board_id));
  const boardsReferenced = boards.filter((b) => boardIdsFromMods.has(b.id));

  const { data: connRows, error: connErr } = await supabase
    .from("connections")
    .select("id,board_id,from_module_id,to_module_id");

  if (connErr) {
    console.error("connections 조회 오류:", connErr.message);
    process.exit(1);
  }

  const connections = connRows ?? [];
  const modIdsHit = new Set(modulesHit.map((m) => m.id));
  const boardIdsConcerned = new Set([
    ...boardsByName.map((b) => b.id),
    ...modulesHit.map((m) => m.board_id),
  ]);

  const connectionsHit = connections.filter(
    (c) =>
      boardIdsConcerned.has(c.board_id) ||
      modIdsHit.has(c.from_module_id) ||
      modIdsHit.has(c.to_module_id)
  );

  console.log("=== Supabase 진단: 클로드 / 한양 관련 ===\n");
  console.log(`전체 boards: ${boards.length}, modules: ${modules.length}, connections: ${connections.length}\n`);

  console.log(`이름에 키워드가 포함된 board: ${boardsByName.length}건`);
  for (const b of boardsByName) {
    console.log(
      `  - [${b.board_category ?? "?"}] id=${b.id} name=${JSON.stringify(b.name)} user=${b.user_id}`
    );
  }

  console.log(`\ndata(제목·본문 등)에 키워드가 포함된 module: ${modulesHit.length}건`);
  const preview = (s, n = 80) => {
    if (s == null) return "";
    const t = String(s).replace(/\s+/g, " ").trim();
    return t.length <= n ? t : t.slice(0, n) + "…";
  };
  for (const m of modulesHit.slice(0, 40)) {
    const d = m.data && typeof m.data === "object" ? m.data : {};
    const title = d.title ?? "";
    const content = d.content ?? "";
    const bn = boards.find((x) => x.id === m.board_id);
    console.log(
      `  - board=${m.board_id} (${bn?.name ?? "?"}) type=${m.type} module=${m.id}\n    title: ${preview(title, 100)}\n    content: ${preview(content, 120)}`
    );
  }
  if (modulesHit.length > 40) console.log(`  … 외 ${modulesHit.length - 40}건`);

  console.log(`\n위 module이 속한 보드(이름만): ${boardsReferenced.length}건`);
  const seen = new Set();
  for (const b of boardsReferenced) {
    if (seen.has(b.id)) continue;
    seen.add(b.id);
    console.log(`  - [${b.board_category ?? "?"}] ${JSON.stringify(b.name)} id=${b.id}`);
  }

  const targetBoardIds = boardsByName.map((b) => b.id);
  const modulesOnNamedBoards = modules.filter((m) => targetBoardIds.includes(m.board_id));
  console.log(`\n「클로드」「한양대」이름 보드에 연결된 module 전체: ${modulesOnNamedBoards.length}건`);
  for (const m of modulesOnNamedBoards) {
    const bn = boards.find((x) => x.id === m.board_id);
    const d = m.data && typeof m.data === "object" ? m.data : {};
    const title = d.title ?? "";
    const content = d.content ?? "";
    console.log(
      `  - board ${bn?.name ?? "?"} (${m.board_id}) type=${m.type} module=${m.id}\n    title: ${preview(title, 120)}\n    content: ${preview(content, 160)}`
    );
  }

  console.log(`\n관련 connections: ${connectionsHit.length}건`);
  for (const c of connectionsHit.slice(0, 20)) {
    console.log(`  - board=${c.board_id} ${c.from_module_id} → ${c.to_module_id}`);
  }
  if (connectionsHit.length > 20) console.log(`  … 외 ${connectionsHit.length - 20}건`);

  const hasBodyInDb =
    modulesOnNamedBoards.some((m) => {
      const d = m.data && typeof m.data === "object" ? m.data : {};
      const c = String(d.content ?? "").trim();
      const t = String(d.title ?? "").trim();
      return c.length > 0 || t.length > 0;
    }) || modulesHit.length > 0;

  console.log("\n--- 요약 ---");
  if (boardsByName.length === 0) {
    console.log("이름이 클로드/한양인 board 행: 없음.");
  } else {
    console.log(
      `이름이 클로드/한양인 board 행: ${boardsByName.length}건 (위 목록). 해당 board_id에 매달린 modules 행: ${modulesOnNamedBoards.length}건.`
    );
  }
  if (!hasBodyInDb && boardsByName.length > 0) {
    console.log(
      "→ 메모 본문/제목은 Supabase `modules` 테이블에 남아 있지 않습니다. (로컬 캐시·백업에서만 복구 가능할 수 있음)"
    );
  }
  if (connections.length === 0) {
    console.log("→ 현재 프로젝트 DB의 `connections` 테이블은 전체 0건입니다.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
