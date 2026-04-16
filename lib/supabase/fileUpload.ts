import { createClient } from "./client";

/**
 * 파일을 Supabase Storage에 업로드하고 서명된 URL을 반환합니다.
 * 실패 시 null 반환 (호출자가 base64 폴백을 처리).
 */
export async function uploadFileToStorage(
  userId: string,
  moduleId: string,
  file: File
): Promise<string | null> {
  try {
    const supabase = createClient();
    const ext = file.name.split(".").pop() ?? "bin";
    const path = `${userId}/${moduleId}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from("files")
      .upload(path, file, { upsert: true });

    if (error) {
      console.warn("Storage upload failed:", error.message);
      return null;
    }

    // 1시간 유효 서명 URL (비공개 버킷)
    const { data: signed } = await supabase.storage
      .from("files")
      .createSignedUrl(path, 60 * 60 * 24 * 365); // 1년

    return signed?.signedUrl ?? null;
  } catch (e) {
    console.warn("uploadFileToStorage error:", e);
    return null;
  }
}
