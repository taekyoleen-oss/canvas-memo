import type { ImageData } from "@/types";

/**
 * `ImageData`에서 이미지 URL 목록을 반환합니다.
 * - `srcs`가 있으면 그대로 사용
 * - 없거나 비어 있으면 레거시 `src`가 있을 때 단일 요소 배열로 반환
 */
export function getImageSrcs(data: Pick<ImageData, "src" | "srcs">): string[] {
  if (Array.isArray(data.srcs) && data.srcs.length > 0) {
    return data.srcs.filter((s) => typeof s === "string" && s.length > 0);
  }
  if (typeof data.src === "string" && data.src.length > 0) return [data.src];
  return [];
}

/**
 * 기존 데이터에 이미지 URL을 추가(append)합니다.
 * 항상 `srcs`를 정규화해서 반환하며 레거시 `src`는 첫 항목으로 흡수합니다.
 */
export function appendImageSrcs(
  data: ImageData,
  newSrcs: string[]
): ImageData {
  const existing = getImageSrcs(data);
  const combined = [...existing, ...newSrcs].filter(
    (s) => typeof s === "string" && s.length > 0
  );
  const head = combined[0] ?? "";
  return {
    ...data,
    src: head,
    srcs: combined.length > 1 ? combined : combined.length === 1 ? undefined : undefined,
  };
}

/** 특정 인덱스의 이미지를 제거하고 정규화된 ImageData를 반환합니다. */
export function removeImageAt(data: ImageData, index: number): ImageData {
  const list = getImageSrcs(data).slice();
  if (index < 0 || index >= list.length) return data;
  list.splice(index, 1);
  return {
    ...data,
    src: list[0] ?? "",
    srcs: list.length > 1 ? list : undefined,
  };
}

/** 단일 src로 ImageData를 갱신(레거시 호환) — 기존 동작과 동일하게 한 장으로 덮어씁니다. */
export function setSingleImageSrc(data: ImageData, src: string): ImageData {
  return { ...data, src, srcs: undefined };
}
