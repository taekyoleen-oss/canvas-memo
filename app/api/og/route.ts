import { NextRequest, NextResponse } from "next/server";
import { LinkData } from "@/types";

/** OG 메타데이터 fetch 타임아웃 (ms) */
const FETCH_TIMEOUT_MS = 5000;

/**
 * GET /api/og?url={encodedUrl}
 * URL의 HTML을 가져와 og:title, og:description, og:image, favicon을 추출합니다.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json(
      { error: "url parameter is required" },
      { status: 400 }
    );
  }

  // 빈 메타 기본값
  const emptyMeta: LinkData = {
    url,
    title: "",
    description: "",
    favicon: "",
    thumbnail: "",
  };

  try {
    const decodedUrl = decodeURIComponent(url);

    // URL 유효성 검증
    const parsedUrl = new URL(decodedUrl);
    const origin = parsedUrl.origin;

    // AbortController로 타임아웃 구현
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      FETCH_TIMEOUT_MS
    );

    let html: string;
    try {
      const response = await fetch(decodedUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; MindCanvas/1.0; +https://mindcanvas.app)",
        },
      });

      if (!response.ok) {
        return NextResponse.json(emptyMeta);
      }

      html = await response.text();
    } finally {
      clearTimeout(timeoutId);
    }

    // OG 메타 추출
    const title = extractOGTag(html, "og:title") ?? extractTitle(html) ?? "";
    const description =
      extractOGTag(html, "og:description") ??
      extractMetaName(html, "description") ??
      "";
    const thumbnail = resolveUrl(
      extractOGTag(html, "og:image") ?? "",
      origin
    );
    const favicon = resolveUrl(extractFavicon(html) ?? "/favicon.ico", origin);

    const result: LinkData = {
      url: decodedUrl,
      title,
      description,
      favicon,
      thumbnail,
    };

    return NextResponse.json(result);
  } catch (err) {
    // 타임아웃 또는 네트워크 오류 시 빈 메타 반환
    if (err instanceof Error && err.name === "AbortError") {
      console.warn("[MindCanvas] OG fetch timed out for:", url);
    } else {
      console.error("[MindCanvas] OG fetch error:", err);
    }
    return NextResponse.json(emptyMeta);
  }
}

// ─── 헬퍼 함수 ───────────────────────────────────────────────────────────────

/** og:xxx 메타 태그의 content 값을 추출합니다 */
function extractOGTag(html: string, property: string): string | null {
  const regex = new RegExp(
    `<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`,
    "i"
  );
  const match = html.match(regex);
  if (match) return match[1];

  // content가 앞에 오는 경우도 처리
  const regex2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`,
    "i"
  );
  const match2 = html.match(regex2);
  return match2 ? match2[1] : null;
}

/** name 메타 태그의 content 값을 추출합니다 */
function extractMetaName(html: string, name: string): string | null {
  const regex = new RegExp(
    `<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`,
    "i"
  );
  const match = html.match(regex);
  if (match) return match[1];

  const regex2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`,
    "i"
  );
  const match2 = html.match(regex2);
  return match2 ? match2[1] : null;
}

/** <title> 태그 내용을 추출합니다 */
function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim() : null;
}

/** favicon URL을 추출합니다 */
function extractFavicon(html: string): string | null {
  // <link rel="icon"> 또는 <link rel="shortcut icon">
  const regex =
    /<link[^>]+rel=["'](?:shortcut icon|icon)["'][^>]+href=["']([^"']+)["']/i;
  const match = html.match(regex);
  if (match) return match[1];

  // href가 앞에 오는 경우
  const regex2 =
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut icon|icon)["']/i;
  const match2 = html.match(regex2);
  return match2 ? match2[1] : null;
}

/** 상대 경로 URL을 절대 경로로 변환합니다 */
function resolveUrl(url: string, origin: string): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return `${origin}${url}`;
  return `${origin}/${url}`;
}
