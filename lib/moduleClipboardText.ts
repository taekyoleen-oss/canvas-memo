import type {
  Module,
  MemoData,
  ScheduleData,
  ImageData,
  LinkData,
  FileData,
  TableData,
  BrainstormData,
} from "@/types";

/**
 * 모듈 HTML 본문(메모 content 등)을 외부 앱에 붙여넣기 좋은 평문으로 변환.
 * - <br>·블록 요소는 줄바꿈으로 치환
 * - 태그 제거 후 textContent만 남김
 */
function htmlToPlainText(html: string): string {
  if (!html) return "";
  if (typeof document === "undefined") {
    // SSR/비DOM 환경 폴백 — 태그만 거칠게 제거
    return html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
  const div = document.createElement("div");
  div.innerHTML = html;
  div.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
  div
    .querySelectorAll("p, div, li, h1, h2, h3, h4, h5, h6, tr, blockquote")
    .forEach((el) => el.append("\n"));
  const text = div.textContent ?? "";
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

/** 비어 있지 않은 줄만 모아 합친다. */
function joinLines(...lines: Array<string | null | undefined>): string {
  return lines
    .map((l) => (l ?? "").trim())
    .filter((l) => l.length > 0)
    .join("\n");
}

/**
 * 모듈 type·data를 외부(메모장 등)에 붙여넣을 수 있는 평문으로 변환.
 * 이미지·파일의 base64 같은 거대 데이터는 제외하고 사람이 읽을 텍스트만 추출한다.
 */
export function moduleDataToPlainText(
  type: Module["type"],
  data: Module["data"]
): string {
  switch (type) {
    case "memo": {
      const d = data as MemoData;
      return joinLines(d.title, htmlToPlainText(d.content));
    }
    case "schedule": {
      const d = data as ScheduleData;
      const items = d.items.map((it) => {
        const box = it.done ? "[x]" : "[ ]";
        const due = it.dueDate ? ` (${it.dueDate})` : "";
        return `${box} ${it.text}${due}`;
      });
      return joinLines(d.title, ...items);
    }
    case "brainstorm": {
      const d = data as BrainstormData;
      const items = d.items.map((it) => `• ${it.text}`);
      return joinLines(d.title, ...items);
    }
    case "table": {
      const d = data as TableData;
      const rows: string[] = [];
      for (let r = 0; r < d.rowCount; r++) {
        const cols: string[] = [];
        for (let c = 0; c < d.colCount; c++) {
          cols.push((d.cells[r * d.colCount + c] ?? "").trim());
        }
        rows.push(cols.join("\t"));
      }
      return joinLines(d.title, ...rows);
    }
    case "link": {
      const d = data as LinkData;
      return joinLines(d.title, d.url, d.description);
    }
    case "image": {
      const d = data as ImageData;
      return joinLines(d.title, d.caption, d.description);
    }
    case "file": {
      const d = data as FileData;
      return joinLines(d.title, d.fileName);
    }
    default:
      return "";
  }
}

/**
 * 시스템 클립보드에 평문을 기록. navigator.clipboard 우선,
 * 실패 시 execCommand("copy") 폴백. 빈 문자열은 무시(false 반환).
 */
export async function writeTextToSystemClipboard(
  text: string
): Promise<boolean> {
  if (!text) return false;

  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function"
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // 비보안 컨텍스트·권한 거부 등 — 폴백으로 진행
    }
  }

  if (typeof document === "undefined") return false;
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.top = "-9999px";
    ta.style.left = "-9999px";
    ta.setAttribute("readonly", "");
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
