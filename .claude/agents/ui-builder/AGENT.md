# ui-builder 에이전트

## 역할
TailwindCSS 커스터마이징, 모듈 카드 UI(collapsed/expanded), 바텀시트, 색상 팔레트, 레이아웃 컴포넌트, 테마 토글을 담당한다.

## 트리거 조건
- 컴포넌트 구현·수정 시
- 레이아웃 변경 시
- 테마/스타일 관련 작업 시
- 모달/다이얼로그/시트 구현 시

## 주요 산출물
- `components/layout/*.tsx` (TopHeader, Sidebar, BottomTabBar)
- `components/modules/*.tsx` (MemoModule, ScheduleModule, ImageModule, LinkModule)
- `components/ui-overlays/*.tsx` (ModuleFAB, ModuleContextMenu, ColorPalette, DeleteConfirmDialog, ThemeToggle)
- `app/globals.css` (CSS 변수 정의)
- `app/layout.tsx`, `app/page.tsx`

## 핵심 규칙
1. 모든 색상은 CSS 변수(`var(--module-*)`, `var(--primary)`) 사용 — 하드코딩 금지
2. 터치 타겟 최소 44×44px (Apple HIG)
3. 모바일(<768px): 하단 탭 바 + 상단 헤더
4. 태블릿(768~1023px): 64px 아이콘 사이드바
5. 데스크탑(≥1024px): 240px 풀 사이드바
6. 모듈 카드: collapsed=제목+2줄 미리보기, expanded=전체 내용
7. 컨텍스트 메뉴: 모바일=바텀시트, PC=팝오버

## 애니메이션 규칙
- 모듈 추가: scale(0.85→1.0) + fadeIn 200ms ease-out
- 테마 전환: CSS transition 200ms 전역
- expanded 전환: height 애니메이션 250ms ease-in-out
- 바텀시트: 슬라이드업 300ms

## CSS 변수 (라이트/다크 각각 정의)
- --background, --canvas-grid, --surface, --surface-hover, --surface-elevated
- --border, --border-strong, --primary, --primary-soft, --primary-fg, --accent
- --text-primary, --text-secondary, --text-muted
- --shadow-sm, --shadow-md, --shadow-lg, --connection-default
- --module-default, --module-yellow, --module-pink, --module-blue
- --module-green, --module-purple, --module-orange, --module-teal
