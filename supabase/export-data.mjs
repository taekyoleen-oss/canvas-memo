/**
 * MindCanvas 데이터 익스포터
 * Node.js로 Supabase 데이터를 SQL INSERT 파일로 추출합니다.
 * 사용법: node supabase/export-data.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// .env.local 파일에서 환경변수 직접 읽기
function loadEnv() {
  const envPath = join(__dirname, '..', '.env.local');
  const content = readFileSync(envPath, 'utf-8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim();
    env[key] = val;
  }
  return env;
}

const env = loadEnv();
const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ .env.local에서 SUPABASE_URL / SUPABASE_ANON_KEY를 찾을 수 없습니다.');
  process.exit(1);
}

// service_role key가 있으면 사용 (RLS 우회 가능), 없으면 anon key 사용
const serviceKey = env['SUPABASE_SERVICE_ROLE_KEY'] || supabaseKey;

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false }
});

const TABLES = ['boards', 'modules', 'connections', 'groups'];

function escapeValue(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
  return `'${String(val).replace(/'/g, "''")}'`;
}

function rowToInsert(table, row) {
  const cols = Object.keys(row).map(c => `"${c}"`).join(', ');
  const vals = Object.values(row).map(escapeValue).join(', ');
  return `INSERT INTO public."${table}" (${cols}) VALUES (${vals}) ON CONFLICT (id) DO NOTHING;`;
}

async function exportTable(table) {
  console.log(`  📋 ${table} 추출 중...`);
  const { data, error } = await supabase.from(table).select('*');
  if (error) {
    console.warn(`  ⚠️  ${table}: ${error.message}`);
    return { table, rows: [], error: error.message };
  }
  console.log(`     → ${data.length}개 행`);
  return { table, rows: data };
}

async function main() {
  console.log('🚀 MindCanvas 데이터 익스포트 시작\n');

  const results = [];
  for (const table of TABLES) {
    results.push(await exportTable(table));
  }

  const lines = [
    '-- MindCanvas 데이터 백업',
    `-- 생성일시: ${new Date().toISOString()}`,
    `-- 원본: ${supabaseUrl}`,
    '',
    '-- 외래키 제약 일시 해제 (순서 무관 삽입)',
    'SET session_replication_role = replica;',
    '',
  ];

  for (const { table, rows, error } of results) {
    if (error) {
      lines.push(`-- ⚠️  ${table} 오류: ${error}`);
      continue;
    }
    lines.push(`-- ── ${table} (${rows.length}행) ────────────────────`);
    if (rows.length === 0) {
      lines.push(`-- (데이터 없음)`);
    } else {
      for (const row of rows) {
        lines.push(rowToInsert(table, row));
      }
    }
    lines.push('');
  }

  lines.push('-- 외래키 제약 복원');
  lines.push('SET session_replication_role = DEFAULT;');

  const outputPath = join(__dirname, 'backup_data.sql');
  writeFileSync(outputPath, lines.join('\n'), 'utf-8');

  const total = results.reduce((s, r) => s + (r.rows?.length ?? 0), 0);
  console.log(`\n✅ 완료! 총 ${total}개 행 → supabase/backup_data.sql`);
  console.log(`   경로: ${outputPath}`);
}

main().catch(err => {
  console.error('❌ 오류:', err.message);
  process.exit(1);
});
