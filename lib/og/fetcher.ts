import { LinkData } from "@/types";

/**
 * /api/og 엔드포인트를 호출하여 URL의 OG 메타데이터를 가져옵니다.
 */
export async function fetchOGMeta(url: string): Promise<LinkData> {
  const emptyResult: LinkData = {
    url,
    title: "",
    description: "",
    favicon: "",
    thumbnail: "",
  };

  try {
    const encodedUrl = encodeURIComponent(url);
    const res = await fetch(`/api/og?url=${encodedUrl}`);

    if (!res.ok) {
      console.warn("[MindCanvas] OG fetch failed:", res.status);
      return emptyResult;
    }

    const data: LinkData = await res.json();
    return data;
  } catch (err) {
    console.error("[MindCanvas] fetchOGMeta error:", err);
    return emptyResult;
  }
}
