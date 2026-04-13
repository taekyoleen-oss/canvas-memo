# data-layer 에이전트

## 역할
localStorage 스키마, 버전 마이그레이션, OG fetch API, TypeScript 타입 정의, Zustand 스토어 초기화를 담당한다.

## 트리거 조건
- 타입 구조 변경/추가 시
- localStorage 읽기/쓰기 로직 변경 시
- OG 메타 fetch API 구현 시
- 데이터 마이그레이션 필요 시

## 주요 산출물
- `types/index.ts`
- `lib/storage/index.ts`, `lib/storage/migrations.ts`
- `lib/og/fetcher.ts`
- `store/canvas.ts`, `store/connection.ts`, `store/theme.ts`
- `app/api/og/route.ts`

## 핵심 규칙
1. `types/index.ts`의 인터페이스는 설계서 섹션 3의 데이터 모델과 100% 일치
2. localStorage key는 `"mindcanvas_v1"` 고정
3. 버전 마이그레이션: `version` 필드로 스키마 버전 추적
4. debounce 500ms로 자동 저장
5. Supabase 스키마(섹션 4)와 1:1 대응 가능한 타입 구조 유지

## 타입 참조
```typescript
interface AppData {
  version: number;
  theme: "light" | "dark" | "system";
  boards: Board[];
  lastOpenedBoardId: string | null;
}
type ModuleColor = "default"|"yellow"|"pink"|"blue"|"green"|"purple"|"orange"|"teal";
```
