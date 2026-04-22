/**
 * MindCanvas 데이터 임포터
 * backup_data.sql의 데이터를 새 Supabase 프로젝트에 삽입합니다.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const NEW_URL = 'https://qaajufkqjjgggewjvfps.supabase.co';
const NEW_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhYWp1ZmtxampnZ2dld2p2ZnBzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjUzOTg4NCwiZXhwIjoyMDkyMTE1ODg0fQ.jWpPFA_0lhokonf69BiVuBZCiw3ZK0nvAUmIpYg6mhQ';

const supabase = createClient(NEW_URL, NEW_SERVICE_KEY, {
  auth: { persistSession: false }
});

// SQL 파일에서 INSERT 문 파싱
function parseInserts(sql) {
  const inserts = [];
  const lines = sql.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('INSERT INTO')) {
      inserts.push(trimmed);
    }
  }
  return inserts;
}

// INSERT INTO public."table" (...) VALUES (...) 에서 테이블명 추출
function getTableName(insertSql) {
  const match = insertSql.match(/INSERT INTO public\."(\w+)"/);
  return match ? match[1] : null;
}

async function runInsert(sql) {
  // service_role key로 RLS 우회하여 직접 SQL 실행
  const { error } = await supabase.rpc('exec_sql', { query: sql }).single();
  return error;
}

// Supabase JS client로 직접 INSERT (테이블별 파싱)
function parseInsertRow(sql) {
  // INSERT INTO public."table" ("col1", "col2") VALUES ('val1', 'val2') ON CONFLICT ...
  const colMatch = sql.match(/\(("[\w"]+(?:,\s*"[\w"]+")*)\)\s+VALUES/);
  const valMatch = sql.match(/VALUES\s*\(([\s\S]+?)\)\s+ON CONFLICT/);
  if (!colMatch || !valMatch) return null;

  const cols = colMatch[1].split(',').map(c => c.trim().replace(/"/g, ''));
  const rawVals = valMatch[1];

  // 값 파싱 (문자열, NULL, 숫자, JSON)
  const vals = [];
  let current = '';
  let depth = 0;
  let inStr = false;
  let escaped = false;

  for (let i = 0; i < rawVals.length; i++) {
    const ch = rawVals[i];
    if (escaped) { current += ch; escaped = false; continue; }
    if (ch === '\\') { escaped = true; current += ch; continue; }
    if (ch === "'" && !inStr) { inStr = true; current += ch; continue; }
    if (ch === "'" && inStr) {
      if (rawVals[i + 1] === "'") { current += "'"; i++; continue; }
      inStr = false; current += ch; continue;
    }
    if (inStr) { current += ch; continue; }
    if (ch === '{' || ch === '[' || ch === '(') depth++;
    if (ch === '}' || ch === ']' || ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      vals.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) vals.push(current.trim());

  const row = {};
  for (let i = 0; i < cols.length; i++) {
    const raw = vals[i];
    if (raw === 'NULL') { row[cols[i]] = null; }
    else if (raw === 'TRUE') { row[cols[i]] = true; }
    else if (raw === 'FALSE') { row[cols[i]] = false; }
    else if (/^-?\d+$/.test(raw)) { row[cols[i]] = parseInt(raw); }
    else if (/^-?\d+\.\d+$/.test(raw)) { row[cols[i]] = parseFloat(raw); }
    else if (raw.startsWith("'") && raw.endsWith("'")) {
      const inner = raw.slice(1, -1).replace(/''/g, "'");
      // JSON 객체/배열 시도
      try {
        if ((inner.startsWith('{') && inner.endsWith('}')) ||
            (inner.startsWith('[') && inner.endsWith(']'))) {
          row[cols[i]] = JSON.parse(inner);
        } else {
          row[cols[i]] = inner;
        }
      } catch {
        row[cols[i]] = inner;
      }
    } else {
      row[cols[i]] = raw;
    }
  }
  return row;
}

const TABLES = ['boards', 'modules', 'connections', 'groups'];

async function main() {
  console.log('🚀 MindCanvas 데이터 임포트 시작\n');

  const sqlPath = join(__dirname, 'backup_data.sql');
  const sql = readFileSync(sqlPath, 'utf-8');
  const inserts = parseInserts(sql);

  console.log(`  📄 INSERT 문 ${inserts.length}개 파싱 완료\n`);

  // 테이블별로 분류
  const byTable = {};
  for (const table of TABLES) byTable[table] = [];
  for (const ins of inserts) {
    const table = getTableName(ins);
    if (table && byTable[table]) {
      const row = parseInsertRow(ins);
      if (row) byTable[table].push(row);
    }
  }

  // 외래키 순서대로 삽입: boards → modules → connections → groups
  for (const table of TABLES) {
    const rows = byTable[table];
    if (rows.length === 0) {
      console.log(`  ⏭️  ${table}: 데이터 없음`);
      continue;
    }

    console.log(`  📥 ${table} (${rows.length}행) 삽입 중...`);
    const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' });
    if (error) {
      console.error(`  ❌ ${table} 오류: ${error.message}`);
    } else {
      console.log(`     ✅ 완료`);
    }
  }

  console.log('\n✅ 임포트 완료!');
}

main().catch(err => {
  console.error('❌ 오류:', err.message);
  process.exit(1);
});
