# MindCanvas — 오케스트레이터 CLAUDE.md

## 프로젝트 개요
카테고리별로 메모·일정·이미지·링크를 시각적 캔버스 위에 자유롭게 배치하고, 모듈 간에 연결선을 그어 관계를 표현하는 개인용 지식 관리 도구.

- **기술 스택**: Next.js 15 (App Router) · TailwindCSS · Zustand · Supabase (v2.0 예정)
- **모바일 퍼스트**: 터치 인터랙션 1순위

## 하네스: MindCanvas

**목표:** 캔버스/모듈/정리뷰/스토어/타입/저장/UI 작업을 전문 에이전트 파이프라인으로 일관되게 구현·수정한다.

**트리거:** 기능 구현/추가/수정/보완(정리 뷰, 캔버스, 모듈, 스토어, 타입, 저장 등) 요청 시
`mindcanvas-build` 오케스트레이터 스킬을 사용하라. 단순 단일 파일 질문·읽기 전용 조회는 직접 응답 가능.
에이전트 정의는 `.claude/agents/`(data-layer·canvas-engine·ui-builder·qa), 워크플로우는 해당 스킬에 있다.

**변경 이력:**
| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-06-06 | 초기 구성(레거시 AGENT.md → 표준 .md, qa 추가, 오케스트레이터 신설) | 전체 | 정리 뷰 기능 + 하네스 요청 |

## 전역 규칙
- TypeScript strict 모드 — 타입 오류 0개 유지
- 모바일 터치 타겟 최소 44×44px
- CSS 변수(--module-*, --primary 등)만 사용, 하드코딩 금지
- Zustand store 상태 변경 → debounce(500ms) → localStorage 저장
- async/await 사용, callback 패턴 지양
