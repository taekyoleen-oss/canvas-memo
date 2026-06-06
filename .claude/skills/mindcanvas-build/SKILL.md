---
name: mindcanvas-build
description: MindCanvas 기능을 전문 에이전트 파이프라인(data-layer → canvas-engine → ui-builder → qa)으로 구현·수정하는 오케스트레이터. 캔버스/모듈/정리뷰/스토어/타입/저장(IndexedDB·Supabase)/UI 작업을 요청하면 사용. "기능 구현/추가/수정/보완", "정리 뷰", "다시 실행/재실행/이어서", "이전 결과 기반으로", "OO만 다시" 같은 후속 요청에도 사용. 단순 단일 파일 질문·읽기 전용 조회는 직접 응답 가능.
---

# MindCanvas Build 오케스트레이터

전문 에이전트(`data-layer`, `canvas-engine`, `ui-builder`, `qa`)를 **순차 파이프라인**으로
엮어 기능을 구현한다. 실행 모드는 **서브 에이전트**(이 환경엔 TeamCreate/SendMessage 미제공 →
`Agent` 도구 + 공유 `TaskCreate` + 파일 기반 `_workspace/` 전달).

모든 `Agent` 호출에 **`model: "opus"`** 와 해당 `subagent_type`(에이전트 이름)을 지정한다.

## Phase 0: 컨텍스트 확인
1. `docs/superpowers/specs/`에서 관련 설계 스펙을 읽는다(없으면 brainstorming부터).
2. `_workspace/` 존재 여부로 실행 모드 판별:
   - 미존재 → **초기 실행**
   - 존재 + 부분 수정 요청 → **부분 재실행**(해당 에이전트만 재호출)
   - 존재 + 새 입력 → 기존을 `_workspace_prev/`로 이동 후 **새 실행**
3. `TaskList`로 잔여 작업을 확인하고, 단계별 작업을 `TaskCreate`로 등록(의존관계 설정).

## 파이프라인 (순차, 의존)
각 단계는 이전 단계의 `_workspace/` 산출물을 입력으로 받는다. 단계 완료 직후 qa를 점진 호출한다.

1. **data-layer** — 타입·스토어·영속화(IndexedDB 이전 포함)·마이그레이션.
   → 산출: 변경 파일 + `_workspace/01_data-layer_contract.md`(타입/액션 시그니처).
   → 직후 qa 점진 검증(저장 라운드트립·tsc).
2. **canvas-engine** — 그룹화·대표 선정·정렬 순수 로직, 캔버스 연동.
   → 산출: 변경 파일 + `_workspace/02_canvas-engine_api.md`. → qa 점진 검증(결정성·엣지).
3. **ui-builder** — 정리 뷰 UI·page.tsx 분기·뒤로가기 스택·반응형.
   → 산출: 변경 파일 + `_workspace/03_ui-builder_notes.md`. → qa 점진 검증(렌더·터치·반응형).
4. **qa** — 통합 회귀: tsc 0 오류, (가능 시) build 통과, 기존 캔버스/동기화 회귀 없음.
   → 산출: `_workspace/04_qa_report.md`.

## 데이터 전달 프로토콜
- **파일 기반**(주): `_workspace/{NN}_{agent}_{artifact}.md`. 중간 산출물 보존(감사 추적).
- **태스크 기반**: `TaskCreate`/`TaskUpdate`로 단계 상태·의존 관리.
- 최종 코드만 실제 경로에 출력. `_workspace/`는 삭제하지 않는다.

## 에러 핸들링
- 한 에이전트 실패 시 1회 재시도. 재실패면 해당 결과 없이 진행하되 `_workspace/`와 사용자 보고에 누락 명시.
- 계약 충돌(타입↔소비처)은 삭제하지 말고 출처 병기 후 data-layer에 반환해 해소.
- qa가 결함 보고 시 책임 에이전트를 **부분 재실행**(Phase 0의 부분 재실행 경로).

## 산출물 게이트
- 단계 산출물이 다음 단계 입력과 매칭되는지(빈 구간 없음) 확인 후 진행.
- 최종 단계 후 사용자에게 변경 요약 + 검증 증거(tsc/build 출력)를 보고하고 피드백을 요청한다.

## 테스트 시나리오
- **정상 흐름**: 스펙 → data-layer 계약 → canvas-engine API → ui-builder 화면 → qa 통과 → 보고.
- **에러 흐름**: ui-builder가 계약에 없는 필드 요구 → qa가 경계면 불일치 탐지 → data-layer 부분
  재실행으로 계약 보강 → ui-builder 재개. `_workspace/`에 모든 전이 기록.

## 진화
- 실행 후 사용자 피드백을 받아 에이전트 정의/스킬/CLAUDE.md 변경 이력을 갱신한다(`harness` 스킬 Phase 7).
