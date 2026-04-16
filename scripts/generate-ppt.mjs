// MindCanvas 사용자 가이드 PPT 생성 스크립트
// pptxgenjs v4 (CommonJS global)
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const globalModulesPath = 'C:/Users/tklee/AppData/Roaming/npm/node_modules';
const PptxGenJS = require(`${globalModulesPath}/pptxgenjs`);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ── 출력 경로 (중복 방지) ────────────────────────────────────────────────
function resolveOutputPath(dir, baseName = 'MindCanvas_사용가이드') {
  let candidate = path.join(dir, `${baseName}.pptx`);
  if (!fs.existsSync(candidate)) return candidate;
  let n = 2;
  while (true) {
    candidate = path.join(dir, `${baseName}_${n}.pptx`);
    if (!fs.existsSync(candidate)) return candidate;
    n++;
  }
}

// ── 상수 ─────────────────────────────────────────────────────────────────
const SLIDE = { W: 13.33, H: 7.5 };
const L = {
  HDR: 1.05,
  Y0:  1.12,
  YB:  6.80,
  XL:  0.40,
  XR:  12.93,
};
L.W  = L.XR - L.XL;   // 12.53
L.AH = L.YB - L.Y0;   // 5.68

const C = {
  navy:    '1E3A5F',
  blue:    '2563EB',
  lightBl: 'DBEAFE',
  white:   'FFFFFF',
  blk:     '111827',
  dark:    '374151',
  sub:     '6B7280',
  border:  'E5E7EB',
  card:    'F9FAFB',
  accent:  '0EA5E9',
  green:   '059669',
  purple:  '7C3AED',
  orange:  'F97316',
  pink:    'EC4899',
  teal:    '0D9488',
};

const F = 'Noto Sans KR';
const FE = 'Segoe UI Emoji';

// ── 헬퍼: calcCardH ───────────────────────────────────────────────────────
function calcCardH(startY, rows, gap = 0.10, margin = 0.05) {
  const available = (L.YB - margin) - startY;
  const cardH = (available - gap * (rows - 1)) / rows;
  const lastBottom = startY + rows * cardH + (rows - 1) * gap;
  if (lastBottom > L.YB) {
    console.warn(`OVERFLOW RISK: lastBottom=${lastBottom.toFixed(3)} > YB=${L.YB}`);
  }
  return Math.max(cardH, 0.40);
}

// ── 헬퍼: 헤더 바 ──────────────────────────────────────────────────────────
function addHeader(s, pptx, num, title) {
  s.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: SLIDE.W, h: L.HDR,
    fill: { color: C.navy }, line: { color: C.navy }
  });
  s.addText(`${String(num).padStart(2,'0')}  ${title}`, {
    x: L.XL, y: 0.08, w: L.W, h: L.HDR - 0.16,
    fontSize: 28, bold: true, color: C.white, fontFace: F,
    valign: 'middle', fit: 'shrink'
  });
}

// ── 헬퍼: 카드 ────────────────────────────────────────────────────────────
function addCard(s, pptx, x, y, w, h, icon, title, desc, opts = {}) {
  const bg = opts.bg || C.card;
  const borderColor = opts.border || C.border;
  s.addShape(pptx.ShapeType.rect, {
    x, y, w, h,
    fill: { color: bg }, line: { color: borderColor, width: 0.75 },
    shadow: { type: 'outer', color: '00000018', blur: 4, offset: 2, angle: 45 }
  });
  const iconH = h * 0.35;
  s.addText(`${icon}  ${title}`, {
    x: x + 0.14, y: y + 0.12, w: w - 0.28, h: iconH,
    fontSize: 20, bold: true, color: C.blk, fontFace: F,
    valign: 'top', fit: 'shrink', wrap: true
  });
  const descY = y + 0.12 + iconH + 0.06;
  const descH = h - 0.12 - iconH - 0.06 - 0.10;
  if (desc) {
    s.addText(desc, {
      x: x + 0.14, y: descY, w: w - 0.28, h: Math.max(descH, 0.30),
      fontSize: 15, color: C.dark, fontFace: F,
      valign: 'top', wrap: true, fit: 'shrink',
      lineSpacingMultiple: 1.25
    });
  }
}

// ── 헬퍼: 번호 배지 ──────────────────────────────────────────────────────
function addStepBadge(s, pptx, x, y, num, color) {
  s.addShape(pptx.ShapeType.ellipse, {
    x, y, w: 0.45, h: 0.45,
    fill: { color: color || C.blue }, line: { color: color || C.blue }
  });
  s.addText(String(num), {
    x, y, w: 0.45, h: 0.45,
    fontSize: 18, bold: true, color: C.white, fontFace: F,
    align: 'center', valign: 'middle', fit: 'shrink'
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// PPT 생성 시작
// ═══════════════════════════════════════════════════════════════════════════
const pptx = new PptxGenJS();
pptx.layout = 'LAYOUT_WIDE';
pptx.author  = 'MindCanvas';
pptx.title   = 'MindCanvas 사용자 가이드';
pptx.subject = '앱 사용 방법 안내';

// ─────────────────────────────────────────────────────────────────────────
// Slide 1 — 표지
// ─────────────────────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  // 배경 그라데이션 느낌 (상단 진한 네이비)
  s.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: SLIDE.W, h: SLIDE.H * 0.55,
    fill: { color: C.navy }, line: { color: C.navy }
  });
  // 하단 흰 배경
  s.addShape(pptx.ShapeType.rect, {
    x: 0, y: SLIDE.H * 0.55, w: SLIDE.W, h: SLIDE.H * 0.45,
    fill: { color: C.white }, line: { color: C.white }
  });

  // 앱 이름
  s.addText('🧠 MindCanvas', {
    x: L.XL, y: 0.80, w: L.W, h: 1.10,
    fontSize: 52, bold: true, color: C.white, fontFace: FE,
    align: 'center', valign: 'middle', fit: 'shrink'
  });
  // 부제목
  s.addText('나만의 지식 캔버스 — 아이디어를 시각적으로 연결하다', {
    x: L.XL, y: 1.95, w: L.W, h: 0.55,
    fontSize: 22, color: 'BFDBFE', fontFace: F,
    align: 'center', valign: 'middle', fit: 'shrink'
  });
  // 구분선
  s.addShape(pptx.ShapeType.rect, {
    x: SLIDE.W * 0.35, y: SLIDE.H * 0.52, w: SLIDE.W * 0.30, h: 0.04,
    fill: { color: C.accent }, line: { color: C.accent }
  });
  // 하단 설명
  s.addText('사용자 사용 가이드', {
    x: L.XL, y: SLIDE.H * 0.58, w: L.W, h: 0.55,
    fontSize: 26, bold: true, color: C.navy, fontFace: F,
    align: 'center', valign: 'middle', fit: 'shrink'
  });
  s.addText('메모 · 일정 · 이미지 · 링크를 자유롭게 캔버스에 배치하고\n모듈 간 연결로 아이디어 맵을 완성하는 개인 지식 관리 도구', {
    x: L.XL + 1.0, y: SLIDE.H * 0.66, w: L.W - 2.0, h: 0.90,
    fontSize: 18, color: C.dark, fontFace: F,
    align: 'center', valign: 'top', wrap: true,
    lineSpacingMultiple: 1.5, fit: 'shrink'
  });
  s.addText('Next.js 15  ·  Zustand  ·  TailwindCSS  ·  Supabase', {
    x: L.XL, y: SLIDE.H - 0.60, w: L.W, h: 0.45,
    fontSize: 14, color: C.sub, fontFace: F,
    align: 'center', valign: 'middle', fit: 'shrink'
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Slide 2 — 목차
// ─────────────────────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  addHeader(s, pptx, 0, '목차 (Table of Contents)');

  const items = [
    ['01', '앱 개요', '무한 캔버스 기반 지식 관리 도구', C.blue],
    ['02', '시작하기 · 보드 생성', '첫 방문 온보딩 → 보드 만들기', C.accent],
    ['03', '모듈 추가하기', 'FAB 버튼으로 4종 모듈 배치', C.green],
    ['04', '모듈 편집 · 관리', '내용 수정, 색상, 복사, 삭제', C.purple],
    ['05', '모듈 연결 (커넥션)', '앵커 탭으로 관계선 그리기', C.orange],
    ['06', '그룹화 기능', '여러 모듈을 묶어 정리', C.teal],
    ['07', '보드 · 테마 관리', '여러 보드, 다크/라이트 테마', C.pink],
    ['08', '로그인 · 동기화', 'Supabase 계정 연동', C.navy],
  ];

  const colW = (L.W - 0.20) / 2;
  const ROW_GAP = 0.12;
  const cardStartY = L.Y0 + 0.05;
  const cardH = calcCardH(cardStartY, 4, ROW_GAP);

  items.forEach((item, i) => {
    const row = Math.floor(i / 2);
    const col = i % 2;
    const x = L.XL + col * (colW + 0.20);
    const y = cardStartY + row * (cardH + ROW_GAP);

    s.addShape(pptx.ShapeType.rect, {
      x, y, w: colW, h: cardH,
      fill: { color: C.card }, line: { color: item[3], width: 1.5 }
    });
    // 번호 배지
    s.addShape(pptx.ShapeType.rect, {
      x, y, w: 0.60, h: cardH,
      fill: { color: item[3] }, line: { color: item[3] }
    });
    s.addText(item[0], {
      x, y, w: 0.60, h: cardH,
      fontSize: 20, bold: true, color: C.white, fontFace: F,
      align: 'center', valign: 'middle', fit: 'shrink'
    });
    s.addText(item[1], {
      x: x + 0.68, y: y + 0.10, w: colW - 0.76, h: cardH * 0.45,
      fontSize: 19, bold: true, color: C.blk, fontFace: F,
      valign: 'top', fit: 'shrink'
    });
    s.addText(item[2], {
      x: x + 0.68, y: y + cardH * 0.48, w: colW - 0.76, h: cardH * 0.45,
      fontSize: 14, color: C.dark, fontFace: F,
      valign: 'top', fit: 'shrink', wrap: true
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Slide 3 — 앱 개요
// ─────────────────────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  addHeader(s, pptx, 1, '앱 개요');

  s.addText('MindCanvas는 무엇인가?', {
    x: L.XL, y: L.Y0, w: L.W, h: 0.42,
    fontSize: 22, bold: true, color: C.navy, fontFace: F,
    valign: 'middle', fit: 'shrink'
  });

  const COL_GAP = 0.18;
  const colW = (L.W - COL_GAP * 2) / 3;
  const cardStartY = L.Y0 + 0.48;
  const cardH = calcCardH(cardStartY, 1, 0.10);

  const top3 = [
    { icon: '🗂️', title: '보드', desc: '주제별 캔버스 공간\n(예: 공부, 업무, 여행)' },
    { icon: '📌', title: '모듈', desc: '메모·일정·이미지·링크\n4종의 카드 블록' },
    { icon: '🔗', title: '커넥션', desc: '모듈 간 관계선\n아이디어 맵 시각화' },
  ];
  top3.forEach((c, i) => {
    addCard(s, pptx, L.XL + i * (colW + COL_GAP), cardStartY, colW, cardH,
      c.icon, c.title, c.desc, { bg: C.lightBl, border: C.blue });
  });

  const cardStartY2 = cardStartY + cardH + 0.20;
  const cardH2 = calcCardH(cardStartY2, 1, 0.10);
  const colW2 = (L.W - COL_GAP * 3) / 4;

  const bot4 = [
    { icon: '♾️', title: '무한 캔버스', desc: '핀치줌·팬으로\n자유 탐색' },
    { icon: '🎨', title: '8색 팔레트', desc: '모듈 색상 개별\n설정 가능' },
    { icon: '🌙', title: '다크 모드', desc: '라이트/다크\n테마 전환' },
    { icon: '☁️', title: '클라우드 동기화', desc: 'Supabase 계정\n다기기 동기화' },
  ];
  bot4.forEach((c, i) => {
    addCard(s, pptx, L.XL + i * (colW2 + COL_GAP), cardStartY2, colW2, cardH2,
      c.icon, c.title, c.desc);
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Slide 4 — 시작하기 · 보드 생성
// ─────────────────────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  addHeader(s, pptx, 2, '시작하기 · 보드 생성');

  s.addText('보드(Board)는 하나의 주제를 담는 캔버스 공간입니다.', {
    x: L.XL, y: L.Y0, w: L.W, h: 0.38,
    fontSize: 18, color: C.dark, fontFace: F,
    valign: 'middle', fit: 'shrink'
  });

  // 왼쪽 : 흐름도
  const leftW = L.W * 0.44;
  const steps = [
    { n: 1, icon: '🚀', title: '앱 최초 접속', desc: '브라우저에서 앱 URL 접속\n자동으로 온보딩 화면 표시' },
    { n: 2, icon: '✏️', title: '보드 이름 입력', desc: '보드 이름 · 이모지 · 색상 선택\n(예: 📚 공부, 💼 업무)' },
    { n: 3, icon: '✅', title: '보드 생성 완료', desc: '캔버스 메인 화면으로 진입\n모듈 추가 시작 가능' },
  ];

  const ROW_GAP = 0.14;
  const cardStartY = L.Y0 + 0.44;
  const cardH = calcCardH(cardStartY, 3, ROW_GAP);

  steps.forEach((step, i) => {
    const y = cardStartY + i * (cardH + ROW_GAP);
    s.addShape(pptx.ShapeType.rect, {
      x: L.XL, y, w: leftW, h: cardH,
      fill: { color: C.card }, line: { color: C.border }
    });
    addStepBadge(s, pptx, L.XL + 0.14, y + cardH * 0.28, step.n, C.blue);
    s.addText(`${step.icon} ${step.title}`, {
      x: L.XL + 0.72, y: y + 0.10, w: leftW - 0.82, h: cardH * 0.40,
      fontSize: 18, bold: true, color: C.blk, fontFace: F,
      valign: 'top', fit: 'shrink'
    });
    s.addText(step.desc, {
      x: L.XL + 0.72, y: y + cardH * 0.44, w: leftW - 0.82, h: cardH * 0.50,
      fontSize: 14, color: C.dark, fontFace: F,
      valign: 'top', wrap: true, fit: 'shrink',
      lineSpacingMultiple: 1.3
    });
    // 화살표 연결
    if (i < steps.length - 1) {
      s.addShape(pptx.ShapeType.rect, {
        x: L.XL + leftW * 0.3, y: y + cardH + 0.01, w: leftW * 0.4, h: ROW_GAP,
        fill: { color: C.border }, line: { color: C.border }
      });
    }
  });

  // 오른쪽 : 보드 목록 탐색 방법
  const rightX = L.XL + leftW + 0.30;
  const rightW = L.W - leftW - 0.30;

  s.addText('보드 탐색 방법', {
    x: rightX, y: cardStartY, w: rightW, h: 0.40,
    fontSize: 19, bold: true, color: C.navy, fontFace: F,
    valign: 'middle', fit: 'shrink'
  });

  const tips = [
    { icon: '📱', title: '모바일', desc: '화면 하단 탭바에서 보드 이동\n+ 버튼으로 새 보드 추가' },
    { icon: '🖥️', title: 'PC / 데스크탑', desc: '좌측 사이드바에서 보드 목록 확인\n보드 클릭으로 전환' },
    { icon: '✏️', title: '보드 편집', desc: '보드 이름·색상·이모지 수정\n오래된 보드 삭제 가능' },
  ];

  const tipCardH = calcCardH(cardStartY + 0.44, 3, 0.12);
  tips.forEach((tip, i) => {
    const y = cardStartY + 0.44 + i * (tipCardH + 0.12);
    addCard(s, pptx, rightX, y, rightW, tipCardH, tip.icon, tip.title, tip.desc,
      { bg: C.white, border: C.blue });
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Slide 5 — 모듈 추가하기
// ─────────────────────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  addHeader(s, pptx, 3, '모듈 추가하기');

  s.addText('화면 우측 하단 + (FAB) 버튼을 눌러 4종 모듈 중 하나를 선택합니다.', {
    x: L.XL, y: L.Y0, w: L.W, h: 0.38,
    fontSize: 18, color: C.dark, fontFace: F,
    valign: 'middle', fit: 'shrink'
  });

  // 4종 모듈 카드
  const COL_GAP = 0.18;
  const colW = (L.W - COL_GAP * 3) / 4;
  const cardStartY = L.Y0 + 0.44;
  const cardH1 = calcCardH(cardStartY, 1, 0.10) * 0.52;

  const modules = [
    { icon: '📝', title: '메모', color: C.yellow || 'FEF3C7',
      desc: '자유로운 텍스트 노트\n마크다운 지원\n아이디어·메모·요약' },
    { icon: '✅', title: '일정', color: 'DCFCE7',
      desc: '체크리스트 & 할일 관리\n날짜 지정 가능\n완료 여부 토글' },
    { icon: '🖼', title: '이미지', color: 'EDE9FE',
      desc: '사진·이미지 첨부\n캡션 추가 가능\n아이디어 비주얼화' },
    { icon: '🔗', title: '링크', color: 'FEE2E2',
      desc: 'URL 입력 → OG 자동 수집\n제목·설명·썸네일 표시\n레퍼런스 관리' },
  ];

  modules.forEach((m, i) => {
    const x = L.XL + i * (colW + COL_GAP);
    s.addShape(pptx.ShapeType.rect, {
      x, y: cardStartY, w: colW, h: cardH1,
      fill: { color: m.color }, line: { color: C.border }
    });
    s.addText(m.icon, {
      x, y: cardStartY + 0.12, w: colW, h: 0.55,
      fontSize: 34, fontFace: FE,
      align: 'center', valign: 'middle', fit: 'shrink'
    });
    s.addText(m.title, {
      x, y: cardStartY + 0.72, w: colW, h: 0.40,
      fontSize: 20, bold: true, color: C.blk, fontFace: F,
      align: 'center', valign: 'middle', fit: 'shrink'
    });
    s.addText(m.desc, {
      x: x + 0.10, y: cardStartY + 1.16, w: colW - 0.20, h: cardH1 - 1.30,
      fontSize: 14, color: C.dark, fontFace: F,
      align: 'center', valign: 'top', wrap: true, fit: 'shrink',
      lineSpacingMultiple: 1.35
    });
  });

  // 하단: 추가 방법 단계
  const stepY = cardStartY + cardH1 + 0.22;
  s.addText('모듈 추가 절차', {
    x: L.XL, y: stepY, w: L.W, h: 0.38,
    fontSize: 19, bold: true, color: C.navy, fontFace: F,
    valign: 'middle', fit: 'shrink'
  });

  const botSteps = [
    '① 화면 우측 하단의 파란색 + 버튼 탭',
    '② 메모 / 일정 / 이미지 / 링크 중 하나 선택',
    '③ 캔버스 중앙에 새 모듈 자동 배치',
    '④ 드래그로 원하는 위치로 이동',
  ];
  const stepCardH = calcCardH(stepY + 0.42, 1, 0.10);
  const stepColW = (L.W - 0.18 * 3) / 4;

  botSteps.forEach((text, i) => {
    const x = L.XL + i * (stepColW + 0.18);
    const y = stepY + 0.42;
    s.addShape(pptx.ShapeType.rect, {
      x, y, w: stepColW, h: stepCardH,
      fill: { color: C.card }, line: { color: C.blue, width: 1.0 }
    });
    s.addShape(pptx.ShapeType.ellipse, {
      x: x + stepColW / 2 - 0.20, y: y + 0.10, w: 0.40, h: 0.40,
      fill: { color: C.blue }, line: { color: C.blue }
    });
    s.addText(String(i + 1), {
      x: x + stepColW / 2 - 0.20, y: y + 0.10, w: 0.40, h: 0.40,
      fontSize: 16, bold: true, color: C.white, fontFace: F,
      align: 'center', valign: 'middle', fit: 'shrink'
    });
    s.addText(text, {
      x: x + 0.10, y: y + 0.56, w: stepColW - 0.20, h: stepCardH - 0.66,
      fontSize: 14, color: C.blk, fontFace: F,
      valign: 'top', wrap: true, fit: 'shrink',
      lineSpacingMultiple: 1.3
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Slide 6 — 모듈 편집 · 관리
// ─────────────────────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  addHeader(s, pptx, 4, '모듈 편집 · 관리');

  s.addText('모듈을 탭(클릭)하거나 메뉴(⋮)를 열어 다양한 편집 기능을 사용할 수 있습니다.', {
    x: L.XL, y: L.Y0, w: L.W, h: 0.38,
    fontSize: 18, color: C.dark, fontFace: F,
    valign: 'middle', fit: 'shrink'
  });

  const COL_GAP = 0.18;
  const colW = (L.W - COL_GAP) / 2;
  const cardStartY = L.Y0 + 0.44;
  const ROW_GAP = 0.12;
  const cardH = calcCardH(cardStartY, 3, ROW_GAP);

  const left = [
    { icon: '🔽', title: '펼치기 / 접기', color: C.accent,
      desc: '모듈 하단 ▾ 버튼 탭\n• 접힘: 제목+요약만 표시\n• 펼침: 전체 내용 표시·편집 가능' },
    { icon: '🎨', title: '색상 변경', color: C.purple,
      desc: '메뉴(⋮) → 색상 변경\n• 8가지 색상 선택 가능\n• 기본·노랑·분홍·파랑·초록·보라·주황·청록' },
    { icon: '📋', title: '복사 · 붙여넣기', color: C.orange,
      desc: '메뉴(⋮) → 복사\n• 동일한 모듈이 오프셋 위치에 생성\n• 내용·색상 모두 복사됨' },
  ];

  const right = [
    { icon: '✏️', title: '내용 편집', color: C.green,
      desc: '모듈 펼친 상태에서 인라인 편집\n• 제목 클릭 → 텍스트 입력\n• 저장: 500ms 자동 debounce 저장' },
    { icon: '🗑️', title: '모듈 삭제', color: 'EF4444',
      desc: '메뉴(⋮) → 삭제 선택\n• 확인 다이얼로그 표시\n• 연결선도 함께 삭제됨' },
    { icon: '↔️', title: '이동 · 드래그', color: C.teal,
      desc: '모듈 헤더 영역 드래그로 이동\n• 모바일: 터치 드래그\n• PC: 마우스 드래그' },
  ];

  left.forEach((c, i) => {
    const y = cardStartY + i * (cardH + ROW_GAP);
    s.addShape(pptx.ShapeType.rect, {
      x: L.XL, y, w: colW, h: cardH,
      fill: { color: C.card }, line: { color: c.color, width: 1.5 }
    });
    s.addShape(pptx.ShapeType.rect, {
      x: L.XL, y, w: 0.55, h: cardH,
      fill: { color: c.color }, line: { color: c.color }
    });
    s.addText(c.icon, {
      x: L.XL, y, w: 0.55, h: cardH,
      fontSize: 22, fontFace: FE,
      align: 'center', valign: 'middle', fit: 'shrink'
    });
    s.addText(c.title, {
      x: L.XL + 0.63, y: y + 0.10, w: colW - 0.72, h: cardH * 0.38,
      fontSize: 17, bold: true, color: C.blk, fontFace: F,
      valign: 'top', fit: 'shrink'
    });
    s.addText(c.desc, {
      x: L.XL + 0.63, y: y + cardH * 0.42, w: colW - 0.72, h: cardH * 0.52,
      fontSize: 13, color: C.dark, fontFace: F,
      valign: 'top', wrap: true, fit: 'shrink',
      lineSpacingMultiple: 1.25
    });
  });

  right.forEach((c, i) => {
    const x = L.XL + colW + COL_GAP;
    const y = cardStartY + i * (cardH + ROW_GAP);
    s.addShape(pptx.ShapeType.rect, {
      x, y, w: colW, h: cardH,
      fill: { color: C.card }, line: { color: c.color, width: 1.5 }
    });
    s.addShape(pptx.ShapeType.rect, {
      x, y, w: 0.55, h: cardH,
      fill: { color: c.color }, line: { color: c.color }
    });
    s.addText(c.icon, {
      x, y, w: 0.55, h: cardH,
      fontSize: 22, fontFace: FE,
      align: 'center', valign: 'middle', fit: 'shrink'
    });
    s.addText(c.title, {
      x: x + 0.63, y: y + 0.10, w: colW - 0.72, h: cardH * 0.38,
      fontSize: 17, bold: true, color: C.blk, fontFace: F,
      valign: 'top', fit: 'shrink'
    });
    s.addText(c.desc, {
      x: x + 0.63, y: y + cardH * 0.42, w: colW - 0.72, h: cardH * 0.52,
      fontSize: 13, color: C.dark, fontFace: F,
      valign: 'top', wrap: true, fit: 'shrink',
      lineSpacingMultiple: 1.25
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Slide 7 — 모듈 연결 (커넥션)
// ─────────────────────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  addHeader(s, pptx, 5, '모듈 연결 (커넥션)');

  s.addText('두 모듈 사이에 관계선(화살표)을 그어 아이디어 맵을 완성합니다.', {
    x: L.XL, y: L.Y0, w: L.W, h: 0.38,
    fontSize: 18, color: C.dark, fontFace: F,
    valign: 'middle', fit: 'shrink'
  });

  // 연결 절차 (좌측)
  const leftW = L.W * 0.50;
  const cardStartY = L.Y0 + 0.46;
  const ROW_GAP = 0.14;
  const cardH = calcCardH(cardStartY, 4, ROW_GAP);

  const steps = [
    { n: 1, color: C.orange, icon: '👆', title: '출력 앵커 탭',
      desc: '모듈 우측/하단에 나타나는 ◉ 앵커 포인트를 탭\n→ 오렌지 강조 & 연결 대기 상태 진입' },
    { n: 2, color: C.blue, icon: '🎯', title: '대상 모듈 앵커 탭',
      desc: '연결할 다른 모듈의 좌측/상단 앵커 탭\n→ 자동으로 베지어 곡선 연결선 생성' },
    { n: 3, color: C.green, icon: '✅', title: '연결 완료',
      desc: '두 모듈 사이에 화살표 선 표시\n라벨 추가 및 실선/점선 스타일 변경 가능' },
    { n: 4, color: 'EF4444', icon: '❌', title: '연결 삭제',
      desc: '연결선 클릭 → 삭제 버튼\n또는 모듈 삭제 시 연결선 자동 제거' },
  ];

  steps.forEach((step, i) => {
    const y = cardStartY + i * (cardH + ROW_GAP);
    s.addShape(pptx.ShapeType.rect, {
      x: L.XL, y, w: leftW, h: cardH,
      fill: { color: C.card }, line: { color: step.color, width: 1.5 }
    });
    addStepBadge(s, pptx, L.XL + 0.14, y + cardH * 0.22, step.n, step.color);
    s.addText(`${step.icon} ${step.title}`, {
      x: L.XL + 0.70, y: y + 0.10, w: leftW - 0.82, h: cardH * 0.42,
      fontSize: 17, bold: true, color: C.blk, fontFace: F,
      valign: 'top', fit: 'shrink'
    });
    s.addText(step.desc, {
      x: L.XL + 0.70, y: y + cardH * 0.46, w: leftW - 0.82, h: cardH * 0.48,
      fontSize: 13, color: C.dark, fontFace: F,
      valign: 'top', wrap: true, fit: 'shrink',
      lineSpacingMultiple: 1.25
    });
  });

  // 우측 : 커넥션 특징
  const rightX = L.XL + leftW + 0.28;
  const rightW = L.W - leftW - 0.28;

  s.addText('커넥션 특징', {
    x: rightX, y: cardStartY, w: rightW, h: 0.38,
    fontSize: 19, bold: true, color: C.navy, fontFace: F,
    valign: 'middle', fit: 'shrink'
  });

  const feats = [
    { icon: '〰️', text: '실선 / 점선 스타일 선택' },
    { icon: '🏷️', text: '연결선에 라벨 텍스트 추가' },
    { icon: '🎨', text: '연결선 색상 변경 가능' },
    { icon: '↩️', text: '앵커: 상/하/좌/우 4방향' },
    { icon: '🖥️', text: 'PC는 마우스 드래그로도 연결' },
  ];

  const featCardStartY = cardStartY + 0.44;
  const featCardH = calcCardH(featCardStartY, feats.length, 0.10);

  feats.forEach((f, i) => {
    const y = featCardStartY + i * (featCardH + 0.10);
    s.addShape(pptx.ShapeType.rect, {
      x: rightX, y, w: rightW, h: featCardH,
      fill: { color: C.card }, line: { color: C.border }
    });
    s.addText(`${f.icon}  ${f.text}`, {
      x: rightX + 0.14, y, w: rightW - 0.28, h: featCardH,
      fontSize: 16, color: C.blk, fontFace: F,
      valign: 'middle', fit: 'shrink'
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Slide 8 — 그룹화 기능
// ─────────────────────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  addHeader(s, pptx, 6, '그룹화 기능');

  s.addText('관련 모듈을 하나의 그룹으로 묶어 보드를 체계적으로 정리합니다.', {
    x: L.XL, y: L.Y0, w: L.W, h: 0.38,
    fontSize: 18, color: C.dark, fontFace: F,
    valign: 'middle', fit: 'shrink'
  });

  // 상단: 그룹 만들기 절차
  const topCardStartY = L.Y0 + 0.46;
  const topCardH = calcCardH(topCardStartY, 1, 0.10) * 0.44;
  const COL_GAP = 0.14;
  const colW3 = (L.W - COL_GAP * 2) / 3;

  const groupSteps = [
    { n: 1, icon: '🖱️', title: '그룹 생성', desc: '사이드바 또는 메뉴에서\n"그룹 추가" 선택\n이름·색상 설정' },
    { n: 2, icon: '📥', title: '모듈 포함', desc: '그룹 영역으로 모듈 드래그\n또는 모듈 메뉴 → 그룹 지정\n여러 모듈 한번에 포함 가능' },
    { n: 3, icon: '📦', title: '그룹 접기', desc: '그룹 헤더 클릭으로 접기/펼치기\n접힘 → 포함된 모듈 숨김\n캔버스 공간 효율화' },
  ];

  groupSteps.forEach((step, i) => {
    const x = L.XL + i * (colW3 + COL_GAP);
    s.addShape(pptx.ShapeType.rect, {
      x, y: topCardStartY, w: colW3, h: topCardH,
      fill: { color: C.card }, line: { color: C.teal, width: 1.5 }
    });
    addStepBadge(s, pptx, x + 0.14, topCardStartY + 0.10, step.n, C.teal);
    s.addText(`${step.icon} ${step.title}`, {
      x: x + 0.68, y: topCardStartY + 0.10, w: colW3 - 0.80, h: topCardH * 0.38,
      fontSize: 17, bold: true, color: C.blk, fontFace: F,
      valign: 'top', fit: 'shrink'
    });
    s.addText(step.desc, {
      x: x + 0.14, y: topCardStartY + topCardH * 0.46, w: colW3 - 0.28, h: topCardH * 0.48,
      fontSize: 14, color: C.dark, fontFace: F,
      valign: 'top', wrap: true, fit: 'shrink',
      lineSpacingMultiple: 1.25
    });
  });

  // 하단: 그룹 속성 정보
  const botStartY = topCardStartY + topCardH + 0.22;
  s.addText('그룹 속성 및 관리', {
    x: L.XL, y: botStartY, w: L.W, h: 0.38,
    fontSize: 19, bold: true, color: C.navy, fontFace: F,
    valign: 'middle', fit: 'shrink'
  });

  const props = [
    { icon: '🏷️', title: '이름', desc: '그룹마다 고유 이름 지정 가능' },
    { icon: '🎨', title: '색상', desc: '6가지 색상으로 구분 (노랑/분홍/청록/파랑/보라/주황)' },
    { icon: '📐', title: '크기 조정', desc: '그룹 경계 드래그로 영역 크기 변경' },
    { icon: '🗑️', title: '삭제', desc: '그룹 삭제 시 포함 모듈은 삭제되지 않음 (그룹만 제거)' },
  ];

  const propStartY = botStartY + 0.42;
  const propCOL_GAP = 0.16;
  const propColW = (L.W - propCOL_GAP * 3) / 4;
  const propCardH = calcCardH(propStartY, 1, 0.10);

  props.forEach((p, i) => {
    const x = L.XL + i * (propColW + propCOL_GAP);
    addCard(s, pptx, x, propStartY, propColW, propCardH, p.icon, p.title, p.desc,
      { bg: C.white, border: C.teal });
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Slide 9 — 보드 · 테마 · 캔버스 조작
// ─────────────────────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  addHeader(s, pptx, 7, '보드 · 테마 · 캔버스 조작');

  const cardStartY = L.Y0 + 0.08;
  const ROW_GAP = 0.14;
  const COL_GAP = 0.18;
  const colW = (L.W - COL_GAP) / 2;
  const cardH = calcCardH(cardStartY, 3, ROW_GAP);

  const left = [
    { icon: '🌙', color: C.navy, title: '다크 / 라이트 테마',
      desc: '우측 상단 테마 토글 버튼 클릭\n• 라이트: 밝은 배경의 일반 모드\n• 다크: 어두운 배경의 야간 모드\n• 시스템 설정 자동 감지 지원' },
    { icon: '📋', color: C.purple, title: '여러 보드 관리',
      desc: '보드는 카테고리처럼 사용\n• 각 보드별 독립된 캔버스\n• 보드 이름/이모지/색상 커스텀\n• 보드 순서 변경 가능' },
    { icon: '💾', color: C.green, title: '자동 저장',
      desc: '편집 후 500ms 후 자동 저장\n• localStorage에 실시간 보존\n• 새로고침 후에도 데이터 유지\n• 클라우드 동기화 추가 지원' },
  ];

  const right = [
    { icon: '🤏', color: C.orange, title: '핀치줌 (모바일)',
      desc: '두 손가락 오므리기/벌리기로 확대/축소\n• 최소 0.3× ~ 최대 3.0× 줌 지원\n• 캔버스 어느 위치에서나 적용' },
    { icon: '✋', color: C.accent, title: '팬 (스크롤)',
      desc: '한 손가락 드래그로 캔버스 이동\n• PC: 마우스 드래그 (빈 영역)\n• 모바일: 터치 스와이프' },
    { icon: '🔍', color: C.blue, title: '줌 컨트롤',
      desc: '우측 상단 줌 버튼 (+/-)\n• 현재 줌 배율 표시\n• 홈 버튼으로 전체 보기 복귀' },
  ];

  left.forEach((c, i) => {
    const y = cardStartY + i * (cardH + ROW_GAP);
    s.addShape(pptx.ShapeType.rect, {
      x: L.XL, y, w: colW, h: cardH,
      fill: { color: C.card }, line: { color: c.color, width: 1.5 }
    });
    s.addShape(pptx.ShapeType.rect, {
      x: L.XL, y, w: 0.55, h: cardH,
      fill: { color: c.color }, line: { color: c.color }
    });
    s.addText(c.icon, {
      x: L.XL, y, w: 0.55, h: cardH,
      fontSize: 22, fontFace: FE,
      align: 'center', valign: 'middle', fit: 'shrink'
    });
    s.addText(c.title, {
      x: L.XL + 0.63, y: y + 0.10, w: colW - 0.72, h: cardH * 0.38,
      fontSize: 17, bold: true, color: C.blk, fontFace: F,
      valign: 'top', fit: 'shrink'
    });
    s.addText(c.desc, {
      x: L.XL + 0.63, y: y + cardH * 0.42, w: colW - 0.72, h: cardH * 0.52,
      fontSize: 13, color: C.dark, fontFace: F,
      valign: 'top', wrap: true, fit: 'shrink',
      lineSpacingMultiple: 1.25
    });
  });

  right.forEach((c, i) => {
    const x = L.XL + colW + COL_GAP;
    const y = cardStartY + i * (cardH + ROW_GAP);
    s.addShape(pptx.ShapeType.rect, {
      x, y, w: colW, h: cardH,
      fill: { color: C.card }, line: { color: c.color, width: 1.5 }
    });
    s.addShape(pptx.ShapeType.rect, {
      x, y, w: 0.55, h: cardH,
      fill: { color: c.color }, line: { color: c.color }
    });
    s.addText(c.icon, {
      x, y, w: 0.55, h: cardH,
      fontSize: 22, fontFace: FE,
      align: 'center', valign: 'middle', fit: 'shrink'
    });
    s.addText(c.title, {
      x: x + 0.63, y: y + 0.10, w: colW - 0.72, h: cardH * 0.38,
      fontSize: 17, bold: true, color: C.blk, fontFace: F,
      valign: 'top', fit: 'shrink'
    });
    s.addText(c.desc, {
      x: x + 0.63, y: y + cardH * 0.42, w: colW - 0.72, h: cardH * 0.52,
      fontSize: 13, color: C.dark, fontFace: F,
      valign: 'top', wrap: true, fit: 'shrink',
      lineSpacingMultiple: 1.25
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Slide 10 — 로그인 · 동기화
// ─────────────────────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  addHeader(s, pptx, 8, '로그인 · 클라우드 동기화');

  s.addText('Supabase 계정으로 로그인하면 여러 기기에서 데이터를 동기화할 수 있습니다.', {
    x: L.XL, y: L.Y0, w: L.W, h: 0.38,
    fontSize: 18, color: C.dark, fontFace: F,
    valign: 'middle', fit: 'shrink'
  });

  // 로그인 절차
  const leftW = L.W * 0.44;
  const cardStartY = L.Y0 + 0.46;
  const ROW_GAP = 0.14;
  const cardH = calcCardH(cardStartY, 3, ROW_GAP);

  const loginSteps = [
    { n: 1, color: C.blue, icon: '📧', title: '로그인 페이지 이동',
      desc: '상단 우측 로그인 버튼 클릭\n→ /auth/login 페이지 이동\n이메일 + 비밀번호 입력' },
    { n: 2, color: C.green, icon: '🔑', title: '인증 완료',
      desc: 'Supabase Auth 이메일 인증\n→ 로그인 후 기존 데이터 자동 동기화\n보드/모듈 데이터 클라우드 업로드' },
    { n: 3, color: C.accent, icon: '🔄', title: '다기기 동기화',
      desc: '모바일·PC 어디서나 동일 데이터\n→ 편집 내용 자동 반영\n로그아웃 시 로컬 데이터 보존' },
  ];

  loginSteps.forEach((step, i) => {
    const y = cardStartY + i * (cardH + ROW_GAP);
    s.addShape(pptx.ShapeType.rect, {
      x: L.XL, y, w: leftW, h: cardH,
      fill: { color: C.card }, line: { color: step.color, width: 1.5 }
    });
    addStepBadge(s, pptx, L.XL + 0.14, y + cardH * 0.22, step.n, step.color);
    s.addText(`${step.icon} ${step.title}`, {
      x: L.XL + 0.70, y: y + 0.10, w: leftW - 0.82, h: cardH * 0.40,
      fontSize: 17, bold: true, color: C.blk, fontFace: F,
      valign: 'top', fit: 'shrink'
    });
    s.addText(step.desc, {
      x: L.XL + 0.70, y: y + cardH * 0.44, w: leftW - 0.82, h: cardH * 0.50,
      fontSize: 13, color: C.dark, fontFace: F,
      valign: 'top', wrap: true, fit: 'shrink',
      lineSpacingMultiple: 1.25
    });
  });

  // 우측: 동기화 & 비로그인 정보
  const rightX = L.XL + leftW + 0.28;
  const rightW = L.W - leftW - 0.28;

  const infoItems = [
    { icon: '🔒', color: C.navy, title: '비로그인 이용 가능',
      desc: 'localStorage로 완전 동작\n로그인 없이도 모든 기능 사용 가능' },
    { icon: '🔁', color: C.green, title: '자동 동기화',
      desc: '편집 후 자동으로 Supabase 업데이트\n오프라인 → 온라인 복귀 시 동기화' },
    { icon: '🛡️', color: C.purple, title: '보안 (RLS)',
      desc: '내 데이터는 나만 접근 가능\nRow-Level Security 적용' },
  ];

  const infoCardH = calcCardH(cardStartY, 3, 0.14);
  infoItems.forEach((item, i) => {
    const y = cardStartY + i * (infoCardH + 0.14);
    addCard(s, pptx, rightX, y, rightW, infoCardH, item.icon, item.title, item.desc,
      { bg: C.white, border: item.color });
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Slide 11 — 활용 팁 & 마무리
// ─────────────────────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  addHeader(s, pptx, 9, '활용 팁 & 마무리');

  const cardStartY = L.Y0 + 0.08;
  const COL_GAP = 0.16;
  const colW = (L.W - COL_GAP * 2) / 3;
  const cardH1 = calcCardH(cardStartY, 1, 0.10) * 0.46;

  const tips = [
    { icon: '🗺️', color: C.orange, title: '프로젝트 맵',
      desc: '업무 프로젝트를 보드로 만들고\n태스크를 일정 모듈로, 참고 자료를 링크 모듈로 배치\n커넥션으로 의존 관계 시각화' },
    { icon: '📖', color: C.blue, title: '독서 노트',
      desc: '책 한 권을 보드 하나로 관리\n챕터별 메모 모듈 + 인용 이미지 모듈\n핵심 개념 간 커넥션으로 지식 맵 완성' },
    { icon: '💡', color: C.purple, title: '아이디어 브레인스토밍',
      desc: '생각나는 아이디어를 메모 모듈로 빠르게 캡처\n그룹화로 주제별 분류\n커넥션으로 연관 아이디어 연결' },
  ];

  tips.forEach((tip, i) => {
    const x = L.XL + i * (colW + COL_GAP);
    s.addShape(pptx.ShapeType.rect, {
      x, y: cardStartY, w: colW, h: cardH1,
      fill: { color: C.card }, line: { color: tip.color, width: 2 }
    });
    s.addText(tip.icon, {
      x, y: cardStartY + 0.10, w: colW, h: 0.55,
      fontSize: 34, fontFace: FE,
      align: 'center', valign: 'middle', fit: 'shrink'
    });
    s.addText(tip.title, {
      x: x + 0.12, y: cardStartY + 0.70, w: colW - 0.24, h: 0.40,
      fontSize: 18, bold: true, color: tip.color, fontFace: F,
      align: 'center', valign: 'middle', fit: 'shrink'
    });
    s.addText(tip.desc, {
      x: x + 0.12, y: cardStartY + 1.14, w: colW - 0.24, h: cardH1 - 1.26,
      fontSize: 14, color: C.dark, fontFace: F,
      align: 'center', valign: 'top', wrap: true, fit: 'shrink',
      lineSpacingMultiple: 1.35
    });
  });

  // 구분선
  const divY = cardStartY + cardH1 + 0.20;
  s.addShape(pptx.ShapeType.rect, {
    x: L.XL, y: divY, w: L.W, h: 0.03,
    fill: { color: C.border }, line: { color: C.border }
  });

  // 빠른 참조표
  const refY = divY + 0.18;
  s.addText('⚡ 빠른 참조 — 자주 쓰는 동작', {
    x: L.XL, y: refY, w: L.W, h: 0.38,
    fontSize: 18, bold: true, color: C.navy, fontFace: F,
    valign: 'middle', fit: 'shrink'
  });

  const shortcuts = [
    ['모듈 추가', '우측 하단 + 버튼'],
    ['모듈 이동', '헤더 드래그 (터치/마우스)'],
    ['모듈 편집', '▾ 버튼으로 펼친 후 인라인 입력'],
    ['색상/복사/삭제', '모듈 우상단 ⋮ 메뉴'],
    ['커넥션 생성', '앵커(◉) 탭 → 대상 앵커 탭'],
    ['줌 조절', '핀치줌 or 줌 버튼(+/-)'],
    ['보드 이동', '하단 탭바(모바일) / 사이드바(PC)'],
    ['테마 전환', '상단 우측 테마 토글'],
  ];

  const shortcutStartY = refY + 0.42;
  const shortcutCardH = calcCardH(shortcutStartY, 4, 0.06);
  const scColW = (L.W - 0.16) / 2;

  shortcuts.forEach((sc, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = L.XL + col * (scColW + 0.16);
    const y = shortcutStartY + row * (shortcutCardH + 0.06);
    s.addShape(pptx.ShapeType.rect, {
      x, y, w: scColW, h: shortcutCardH,
      fill: { color: C.card }, line: { color: C.border }
    });
    s.addText(sc[0], {
      x: x + 0.12, y, w: scColW * 0.35, h: shortcutCardH,
      fontSize: 14, bold: true, color: C.navy, fontFace: F,
      valign: 'middle', fit: 'shrink'
    });
    s.addShape(pptx.ShapeType.rect, {
      x: x + scColW * 0.38, y: y + shortcutCardH * 0.25,
      w: 0.02, h: shortcutCardH * 0.50,
      fill: { color: C.border }, line: { color: C.border }
    });
    s.addText(sc[1], {
      x: x + scColW * 0.40, y, w: scColW * 0.57, h: shortcutCardH,
      fontSize: 13, color: C.dark, fontFace: F,
      valign: 'middle', fit: 'shrink'
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Slide 12 — 마지막 슬라이드
// ─────────────────────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  s.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: SLIDE.W, h: SLIDE.H,
    fill: { color: C.navy }, line: { color: C.navy }
  });
  s.addText('🧠 MindCanvas', {
    x: L.XL, y: 1.60, w: L.W, h: 1.0,
    fontSize: 48, bold: true, color: C.white, fontFace: FE,
    align: 'center', valign: 'middle', fit: 'shrink'
  });
  s.addText('아이디어를 시각적으로 연결하는\n나만의 지식 캔버스', {
    x: L.XL + 1.0, y: 2.70, w: L.W - 2.0, h: 1.0,
    fontSize: 24, color: 'BFDBFE', fontFace: F,
    align: 'center', valign: 'middle', wrap: true,
    lineSpacingMultiple: 1.5, fit: 'shrink'
  });
  s.addShape(pptx.ShapeType.rect, {
    x: SLIDE.W * 0.30, y: 3.85, w: SLIDE.W * 0.40, h: 0.04,
    fill: { color: C.accent }, line: { color: C.accent }
  });
  s.addText('메모  ·  일정  ·  이미지  ·  링크  ·  커넥션  ·  그룹', {
    x: L.XL, y: 4.05, w: L.W, h: 0.55,
    fontSize: 18, color: '93C5FD', fontFace: F,
    align: 'center', valign: 'middle', fit: 'shrink'
  });
  s.addText('감사합니다', {
    x: L.XL, y: 5.00, w: L.W, h: 0.60,
    fontSize: 28, bold: true, color: C.white, fontFace: F,
    align: 'center', valign: 'middle', fit: 'shrink'
  });
  s.addText('바이브코딩랩 — vibecodinglab.ai.kr', {
    x: L.XL, y: SLIDE.H - 0.65, w: L.W, h: 0.45,
    fontSize: 14, color: '6B7280', fontFace: F,
    align: 'center', valign: 'middle', fit: 'shrink'
  });
}

// ─────────────────────────────────────────────────────────────────────────
// 저장
// ─────────────────────────────────────────────────────────────────────────
const outputPath = resolveOutputPath(ROOT);
await pptx.writeFile({ fileName: outputPath });
console.log(`✅ PPT 저장 완료: ${outputPath}`);
