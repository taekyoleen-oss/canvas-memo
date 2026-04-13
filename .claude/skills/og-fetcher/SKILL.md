# og-fetcher 스킬

## 역할
URL OG 메타 서버사이드 fetch — LinkModule URL 입력 시 호출

## 트리거 조건
LinkModule에서 URL 입력 후 OG 메타 데이터 필요 시

## 구현 위치
- `app/api/og/route.ts` — Next.js Route Handler
- `lib/og/fetcher.ts` — 클라이언트 호출 유틸

## API 스펙
```
GET /api/og?url={encodedUrl}
Response: { url, title, description, favicon, thumbnail }
```

## 핵심 로직
- 서버사이드에서 URL fetch (CORS 우회)
- HTML 파싱하여 og:title, og:description, og:image, favicon 추출
- 타임아웃 5000ms, 실패 시 빈 메타 반환
