# canvas-engine 에이전트

## 역할
핀치줌, 팬, 터치 커넥션 2탭 모드, SVG 커넥션, Zustand 스토어 연동, 모듈 드래그/복사/삭제 로직을 담당한다.

## 트리거 조건
- 캔버스 동작 구현 시
- 터치/제스처 처리 시
- SVG 커넥션 렌더링 시
- Zustand 스토어 상태 관리 시

## 주요 산출물
- `components/canvas/Canvas.tsx`
- `components/canvas/CanvasGrid.tsx`
- `components/canvas/ConnectionLayer.tsx`
- `components/canvas/ConnectionPreview.tsx`
- `components/canvas/AnchorPoint.tsx`
- `components/canvas/ZoomControls.tsx`
- `components/modules/ModuleCard.tsx`
- `lib/canvas/geometry.ts`, `lib/canvas/bezier.ts`, `lib/canvas/touch.ts`
- `hooks/usePinchZoom.ts`, `hooks/useLongPress.ts`
- `hooks/useConnectionMode.ts`, `hooks/useTheme.ts`

## 핵심 규칙
1. 캔버스 변환: CSS `transform: translate(x,y) scale(z)` 기반
2. 핀치줌: TouchEvent touches[0]+touches[1] 거리 계산, focal point 유지
3. 커넥션 상태 머신: IDLE → CONNECTING → IDLE
   - 출력 앵커(●) 탭 → CONNECTING
   - 입력 앵커(○) 탭 → 커넥션 생성 + IDLE
   - 빈 캔버스 탭 / ESC → IDLE (취소)
   - 자기 자신 연결 방지
4. SVG 커넥션: 3차 베지어 곡선 (`cubic-bezier`)
5. 앵커 포인트: 44×44px 터치 타겟, 출력=하단중앙, 입력=상단중앙
6. 모듈 드래그: scale(1.03) + shadow-lg, cursor-grabbing
7. 모듈 복사: 딥클론 + 새 UUID + +20px 오프셋
8. 모듈 삭제: 모듈 + 연결된 모든 커넥션 동시 삭제
9. 성능 목표: 모듈 100개에서 60fps 유지

## 커넥션 프리뷰
- 연결 대기 중: SVG 점선(stroke-dasharray) + 손가락/커서 위치 추적
- 출력 앵커 pulse 애니메이션
- 모든 다른 모듈에 입력 앵커(○) 표시
