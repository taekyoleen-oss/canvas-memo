# local-storage 스킬

## 역할
localStorage 읽기/쓰기, 자동저장 debounce, 스키마 버전 관리

## 트리거 조건
모든 Zustand 상태 변경 후 자동 저장 시

## 구현 위치
- `lib/storage/index.ts` — 읽기/쓰기 API
- `lib/storage/migrations.ts` — 버전 마이그레이션

## 핵심 로직
```typescript
const STORAGE_KEY = "mindcanvas_v1";
const CURRENT_VERSION = 1;

// 저장: debounce 500ms
// 읽기: 버전 체크 후 마이그레이션 적용
// 마이그레이션: version 필드로 순차 적용
```
