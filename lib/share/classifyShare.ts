import type {
  FileData,
  ImageData,
  LinkData,
  MemoData,
  Module,
  ModuleColor,
  PendingShareItem,
} from "@/types";

export const MAX_SHARE_FILE_BYTES = 8 * 1024 * 1024;

/** Module의 id/createdAt/updatedAt은 store가 채움 */
export type SharedModuleInput = Omit<Module, "id" | "createdAt" | "updatedAt">;

export interface ClassifyResult {
  accepted: SharedModuleInput[];
  rejected: PendingShareItem[];
}

const URL_REGEX = /^(https?:\/\/[^\s]+)$/i;

function isUrlString(s: string): boolean {
  const trimmed = s.trim();
  if (URL_REGEX.test(trimmed)) return true;
  try {
    const u = new URL(trimmed);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

const DEFAULT_SIZE = { width: 260, height: 200 };
const DEFAULT_COLOR: ModuleColor = "default";

function memoFromText(text: string, title?: string): SharedModuleInput {
  const firstLine = text.split(/\r?\n/, 1)[0].trim();
  const data: MemoData = {
    title: title?.trim() || firstLine.slice(0, 60) || "공유 메모",
    content: text,
    previewLines: 2,
  };
  return {
    type: "memo",
    position: { x: 0, y: 0 },
    size: DEFAULT_SIZE,
    zIndex: 1,
    color: DEFAULT_COLOR,
    isExpanded: false,
    data,
  };
}

function linkFromUrl(url: string, title?: string): SharedModuleInput {
  const data: LinkData = {
    url: url.trim(),
    title: title?.trim() || url.trim(),
    description: "",
    favicon: "",
    thumbnail: "",
  };
  return {
    type: "link",
    position: { x: 0, y: 0 },
    size: DEFAULT_SIZE,
    zIndex: 1,
    color: DEFAULT_COLOR,
    isExpanded: false,
    data,
  };
}

function imageFromDataUrl(dataUrl: string, fileName?: string): SharedModuleInput {
  const data: ImageData = {
    title: fileName?.replace(/\.[^.]+$/, "") || "공유 이미지",
    src: dataUrl,
    srcs: [dataUrl],
    caption: "",
    description: "",
  };
  return {
    type: "image",
    position: { x: 0, y: 0 },
    size: DEFAULT_SIZE,
    zIndex: 1,
    color: DEFAULT_COLOR,
    isExpanded: false,
    data,
  };
}

function fileFromDataUrl(item: PendingShareItem): SharedModuleInput {
  const data: FileData = {
    title: item.fileName?.replace(/\.[^.]+$/, "") || "공유 파일",
    fileName: item.fileName || "file",
    fileType: item.fileType || "application/octet-stream",
    fileSize: item.fileSize ?? 0,
    src: item.dataUrl ?? "",
  };
  return {
    type: "file",
    position: { x: 0, y: 0 },
    size: DEFAULT_SIZE,
    zIndex: 1,
    color: DEFAULT_COLOR,
    isExpanded: false,
    data,
  };
}

export function classifyShare(items: PendingShareItem[]): ClassifyResult {
  const accepted: SharedModuleInput[] = [];
  const rejected: PendingShareItem[] = [];

  for (const it of items) {
    if (it.rejectedReason) { rejected.push(it); continue; }

    if (it.kind === "url" && it.url && isUrlString(it.url)) {
      accepted.push(linkFromUrl(it.url, it.title));
      continue;
    }
    if (it.kind === "text" && it.text) {
      const t = it.text.trim();
      if (isUrlString(t)) accepted.push(linkFromUrl(t, it.title));
      else accepted.push(memoFromText(it.text, it.title));
      continue;
    }
    if (it.kind === "image" && it.dataUrl) {
      accepted.push(imageFromDataUrl(it.dataUrl, it.fileName));
      continue;
    }
    if (it.kind === "file" && it.dataUrl) {
      accepted.push(fileFromDataUrl(it));
      continue;
    }
    rejected.push({ ...it, rejectedReason: it.rejectedReason ?? "unsupported" });
  }
  return { accepted, rejected };
}
