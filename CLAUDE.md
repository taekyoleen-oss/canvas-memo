# MindCanvas — 오케스트레이터 CLAUDE.md

## 프로젝트 개요
카테고리별로 메모·일정·이미지·링크를 시각적 캔버스 위에 자유롭게 배치하고, 모듈 간에 연결선을 그어 관계를 표현하는 개인용 지식 관리 도구.

- **기술 스택**: Next.js 15 (App Router) · TailwindCSS · Zustand · Supabase (v2.0 예정)
- **모바일 퍼스트**: 터치 인터랙션 1순위

## 에이전트 라우팅 규칙

| 요청 유형 | 담당 에이전트 |
|----------|-------------|
| 컴포넌트 UI, 테마, 레이아웃, 바텀시트, 색상 팔레트 | `ui-builder` |
| 핀치줌, 팬, 터치 커넥션, SVG, Zustand 스토어, 드래그 | `canvas-engine` |
| localStorage, 타입 정의, OG API, 마이그레이션 | `data-layer` |

## 빌드 시퀀스
Phase 1(data-layer) → Phase 2(ui-builder) → Phase 3(canvas-engine) → Phase 4(ui-builder) → Phase 5(canvas-engine) → Phase 6

## 전역 규칙
- TypeScript strict 모드 — 타입 오류 0개 유지
- 모바일 터치 타겟 최소 44×44px
- CSS 변수(--module-*, --primary 등)만 사용, 하드코딩 금지
- Zustand store 상태 변경 → debounce(500ms) → localStorage 저장
- async/await 사용, callback 패턴 지양
