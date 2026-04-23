/** 클립보드에서 이미지 File만 추출 (브라우저별 차이 흡수) */

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

export function getImageFileFromClipboardEvent(e: {
  clipboardData: DataTransfer | null;
}): File | null {
  const cd = e.clipboardData;
  if (!cd) return null;
  const files = cd.files;
  if (files?.length) {
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f?.type.startsWith("image/")) return f;
    }
  }
  const items = cd.items;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const f = item.getAsFile();
      if (f) return f;
    }
  }
  return null;
}

export async function readImageFromNavigatorClipboard(): Promise<File | null> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.read) return null;
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      for (const type of item.types) {
        if (type.startsWith("image/")) {
          const blob = await item.getType(type);
          const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
          return new File([blob], `clipboard.${ext}`, { type: blob.type || type });
        }
      }
    }
  } catch {
    return null;
  }
  return null;
}
