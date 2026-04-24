import type { Board, MemoData, Module } from "@/types";
import { normalizeBoardCategory } from "@/lib/boardCategory";

const BUNDLE_ATTR = "data-cg-comprehensive=\"v1\"";

const NOTE_W = 640;
const NOTE_H = 520;
const GAP = 28;

const H3 =
  "margin:0 0 8px 0;font-size:15px;font-weight:600;color:var(--text-primary);line-height:1.35";
const P = "margin:0 0 10px 0;line-height:1.65";
const UL = "margin:0 0 12px 0;padding-left:1.25em;line-height:1.6";
const TH =
  "border:1px solid var(--border); padding:8px; text-align:left; background:var(--surface-hover); font-size:13px";
const TD = "border:1px solid var(--border); padding:8px; text-align:left; font-size:14px; vertical-align:top";
const hidden = `<span ${BUNDLE_ATTR} style="display:none" aria-hidden="true"></span>`;

const HTML_서문 = `${hidden}
<p style="margin:0 0 12px 0; font-size:16px; font-weight:600; color:var(--text-primary)">종합 가이드: 클로드 코드 &amp; 커서 AI</p>
<p style="${P}">AI 에이전트인 <strong>클로드 코드</strong>와 AI 특화 IDE <strong>커서(Cursor)</strong>의 설치·운영부터 모델 전환, 단축키, 컨텍스트, 프롬프트 팁까지 한곳에 모았습니다.</p>
<p style="margin:0; font-size:13px; color:var(--text-muted)">문서 버전 1.1 (2026-04-23)</p>`;

const HTML_클로드 = `${hidden}
<p style="margin:0 0 12px 0; font-size:16px; font-weight:600; color:var(--text-primary)">1. 클로드 코드 (Claude Code)</p>
<p style="${P}">터미널에서 동작하는 AI 개발 에이전트로, 파일 접근·명령 실행·코드 수정·테스트까지 직접 수행합니다.</p>

<h3 style="${H3}">설치 · 실행</h3>
<ul style="${UL}">
<li>사전 요구: <strong>Node.js 18 이상</strong></li>
<li>설치: <code>npm install -g @anthropic-ai/claude-code</code></li>
<li>로그인: <code>claude auth</code> (최초 1회)</li>
<li>실행(프로젝트 루트): <code>claude</code></li>
</ul>

<h3 style="${H3}">권한 · 위험 모드</h3>
<table style="border-collapse:collapse; width:100%; margin:12px 0; font-size:14px; border:1px solid var(--border)">
<thead>
<tr>
<th style="${TH}">플래그 / 명령</th>
<th style="${TH}">설명</th>
<th style="${TH}">예</th>
</tr>
</thead>
<tbody>
<tr>
<td style="${TD}"><code>--dangerously-skip-permissions</code></td>
<td style="${TD}">파일·명령 승인 절차를 생략(위험)</td>
<td style="${TD}"><code>claude --dangerously-skip-permissions</code></td>
</tr>
<tr>
<td style="${TD}"><code>--permission-mode auto</code></td>
<td style="${TD}">단순 작업은 자동, 위험 작업만 확인</td>
<td style="${TD}"><code>claude --permission-mode auto</code></td>
</tr>
<tr>
<td style="${TD}"><code>/auto</code></td>
<td style="${TD}">세션 중 자동 승인으로 전환</td>
<td style="${TD}">채팅에서 <code>/auto</code> 입력</td>
</tr>
</tbody>
</table>

<h3 style="${H3}">모델 · 어드바이저</h3>
<table style="border-collapse:collapse; width:100%; margin:12px 0; font-size:14px; border:1px solid var(--border)">
<thead>
<tr>
<th style="${TH}">명령</th>
<th style="${TH}">역할</th>
<th style="${TH}">활용</th>
</tr>
</thead>
<tbody>
<tr>
<td style="${TD}"><code>/model opus</code></td>
<td style="${TD}">Claude 4.6 Opus</td>
<td style="${TD}">복잡한 설계·고난도 구현</td>
</tr>
<tr>
<td style="${TD}"><code>/model opusplan</code></td>
<td style="${TD}">Opus가 계획·Sonnet이 실행</td>
<td style="${TD}">대규모 작업, 속도·지능 균형</td>
</tr>
<tr>
<td style="${TD}"><code>/advisor opus</code></td>
<td style="${TD}">막힐 때 Opus에 자문</td>
<td style="${TD}">버그·최적화</td>
</tr>
<tr>
<td style="${TD}"><code>/model sonnet</code></td>
<td style="${TD}">빠른 Sonnet(기본)</td>
<td style="${TD}">일반 코딩</td>
</tr>
</tbody>
</table>

<h3 style="${H3}">슬래시 예시</h3>
<ul style="${UL}">
<li><code>/compact</code> — 맥락을 압축해 토큰 절감</li>
<li><code>/search</code> — 프로젝트 전역 검색</li>
<li><code>/clear</code> — 세션 대화 리셋</li>
<li><code>/undo</code> — 직전 클로드 변경 되돌리기</li>
</ul>

<h3 style="${H3}">추천 프롬프트(요약)</h3>
<blockquote style="margin:0; padding:12px 14px; border-left:3px solid var(--primary); background:var(--surface-hover); line-height:1.65; font-size:14px">
&quot;전체를 스캔해 비효율 루프·보안 취약점을 찾고, <code>/advisor opus</code>로 최적화안을 받은 뒤 자동 권한 모드로 반영. 마지막에 테스트 통과&quot;
</blockquote>
`;

const HTML_커서 = `${hidden}
<p style="margin:0 0 12px 0; font-size:16px; font-weight:600; color:var(--text-primary)">2. 커서 AI (Cursor AI)</p>
<p style="${P}">VS Code 기반 AI 전용 편집기로, 시각적 편집·실시간 질의에 맞습니다.</p>

<h3 style="${H3}">핵심 단축키</h3>
<table style="border-collapse:collapse; width:100%; margin:12px 0; font-size:14px; border:1px solid var(--border)">
<thead>
<tr>
<th style="${TH}">단축키</th>
<th style="${TH}">기능</th>
<th style="${TH}">요약</th>
</tr>
</thead>
<tbody>
<tr>
<td style="${TD}">Cmd / Ctrl + K</td>
<td style="${TD}">Inline edit</td>
<td style="${TD}">선택 구간에 바로 지시</td>
</tr>
<tr>
<td style="${TD}">Cmd / Ctrl + L</td>
<td style="${TD}">Chat</td>
<td style="${TD}">프로젝트/파일 기준 질문</td>
</tr>
<tr>
<td style="${TD}">Cmd / Ctrl + I</td>
<td style="${TD}">Composer</td>
<td style="${TD}">여러 파일에 걸친 대규모 편집</td>
</tr>
<tr>
<td style="${TD}">Cmd / Ctrl + J</td>
<td style="${TD}">터미널 채팅</td>
<td style="${TD}">터미널 에러 분석·해결책</td>
</tr>
</tbody>
</table>

<h3 style="${H3}">컨텍스트(@)</h3>
<ul style="${UL}">
<li><strong>@Files / 폴더</strong> — 지정 경로를 맥락에 포함</li>
<li><strong>@Codebase</strong> — 전체 코드 탐색·분석</li>
<li><strong>@Web</strong> — 최신 문서·Q&amp;A 검색</li>
</ul>
<p style="${P}">프로젝트 루트 <code>AGENTS.md</code>·<code>CLAUDE.md</code>·<code>.cursorrules</code>에 코딩 규칙(예: JSDoc)을 정의하면 반영됩니다.</p>

<h3 style="${H3}">추천 프롬프트(요약)</h3>
<blockquote style="margin:0; padding:12px 14px; border-left:3px solid var(--primary); background:var(--surface-hover); line-height:1.65; font-size:14px">
&quot;<strong>@Codebase</strong> 데이터 모델에 맞춰 분석 대시보드 컴포넌트를 추가해 줘. UI는 Tailwind, 검증은 기존 <code>ValidationService</code>를 상속&quot;
</blockquote>
`;

const HTML_비교 = `${hidden}
<p style="margin:0 0 12px 0; font-size:16px; font-weight:600; color:var(--text-primary)">3. 비교 &amp; 시너지</p>

<h3 style="${H3}">역할</h3>
<table style="border-collapse:collapse; width:100%; margin:12px 0; font-size:14px; border:1px solid var(--border)">
<thead>
<tr>
<th style="${TH}">구분</th>
<th style="${TH}">클로드 코드(에이전트)</th>
<th style="${TH}">커서 AI(IDE)</th>
</tr>
</thead>
<tbody>
<tr>
<td style="${TD}">잘 맞는 일</td>
<td style="${TD}">대규모 리팩터·CI·에러 일괄 수정</td>
<td style="${TD}">UI·신기능·실시간 가이드</td>
</tr>
<tr>
<td style="${TD}">환경</td>
<td style="${TD}">터미널·CLI</td>
<td style="${TD}">GUI 편집기</td>
</tr>
<tr>
<td style="${TD}">난이도</td>
<td style="${TD}">명령·워크플로에 익숙해야 함</td>
<td style="${TD}">VS Code 사용자면 익숙</td>
</tr>
</tbody>
</table>

<h3 style="${H3}">시너지(실무 팁)</h3>
<ol style="margin:0 0 12px 0; padding-left:1.3em; line-height:1.7">
<li><strong>Cursor</strong>로 구조·UI를 먼저 잡는다.</li>
<li>프로젝트 전체 타입 오류·버그 일괄는 터미널 <strong>클로드 코드</strong>에 <code>--dangerously-skip-permissions</code> 등 권한 모드와 함께 맡긴다(신뢰할 때만).</li>
<li>난이도가 높은 수식·알고리즘·설계는 <strong>Opus / OpusPlan</strong>을 CLI·IDE 모두에서 적극 활용한다.</li>
</ol>
<p style="margin:0; font-size:13px; color:var(--text-muted)">문서 출처: 추가·종합 가이드 v1.1</p>
`;

function isCanonicalClaudeTopicName(name: string | undefined): boolean {
  const n = (name ?? "").trim();
  return (
    n === "클로드" ||
    n === "클로드 코드" ||
    n.endsWith(" · 클로드") ||
    n.endsWith(" · 클로드 코드") ||
    n.endsWith("· 클로드 코드")
  );
}

function findClaudeTopicBoard(boards: Board[]): Board | undefined {
  const topic = boards.filter((b) => normalizeBoardCategory(b) === "topic_notes");
  const byIcon = topic.find((b) => b.icon === "🧩");
  if (byIcon) return byIcon;
  return topic.find((b) => isCanonicalClaudeTopicName(b.name));
}

function boardHasComprehensiveBundle(board: Board): boolean {
  return (board.modules ?? []).some(
    (m) =>
      m.type === "memo" &&
      typeof (m.data as MemoData).content === "string" &&
      (m.data as MemoData).content!.includes(BUNDLE_ATTR)
  );
}

function makeMemoModule(
  id: string,
  now: string,
  position: { x: number; y: number },
  zIndex: number,
  title: string,
  html: string
): Module {
  return {
    id,
    type: "memo",
    position,
    size: { width: NOTE_W, height: NOTE_H },
    zIndex,
    color: "purple",
    shape: "rounded",
    isExpanded: true,
    isMinimized: false,
    data: {
      title,
      content: html,
      previewLines: 6,
    } satisfies MemoData,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * 주제별 워크스페이스의 **클로드** 보드(시드)에, 종합 가이드를 주제 단위(4노트)로 한 번만 추가합니다.
 * 리치 HTML은 메모의 기존 렌더 규칙(리치텍스트)에 맞춥니다.
 */
export function applyComprehensiveClaudeTopicGuideNotes(
  boards: Board[],
  now: string,
  newId: () => string
): { boards: Board[]; changed: boolean } {
  const claude = findClaudeTopicBoard(boards);
  if (!claude) {
    return { boards, changed: false };
  }
  if (boardHasComprehensiveBundle(claude)) {
    return { boards, changed: false };
  }

  const mods = [...(claude.modules ?? [])];
  const zBase = mods.length ? Math.max(...mods.map((m) => m.zIndex)) + 1 : 1;
  const bottomY = mods.reduce(
    (max, m) => Math.max(max, m.position.y + m.size.height),
    0
  );
  const y0 = bottomY > 0 ? bottomY + GAP : 72;
  const x0 = 48;
  const x1 = 48 + NOTE_W + GAP;
  const positions: { x: number; y: number }[] = [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x0, y: y0 + NOTE_H + GAP },
    { x: x1, y: y0 + NOTE_H + GAP },
  ];

  const spec: { title: string; html: string }[] = [
    { title: "가이드 · 서문", html: HTML_서문 },
    { title: "1. 클로드 코드", html: HTML_클로드 },
    { title: "2. 커서 AI", html: HTML_커서 },
    { title: "3. 비교·시너지", html: HTML_비교 },
  ];

  for (let i = 0; i < spec.length; i++) {
    mods.push(
      makeMemoModule(
        newId(),
        now,
        positions[i]!,
        zBase + i,
        spec[i]!.title,
        spec[i]!.html
      )
    );
  }

  const nextBoard: Board = {
    ...claude,
    modules: mods,
    updatedAt: now,
  };

  const out = boards.map((b) => (b.id === claude.id ? nextBoard : b));
  return { boards: out, changed: true };
}
