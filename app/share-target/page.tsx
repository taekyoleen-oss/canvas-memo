"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { useCanvasStore } from "@/store/canvas";
import { ensureInboxBoard } from "@/lib/inboxBoard";
import { drainPendingShareItems } from "@/lib/share/pendingShareStore";
import {
  classifyShare,
  type SharedModuleInput,
} from "@/lib/share/classifyShare";
import type { LinkData, PendingShareItem } from "@/types";

async function enrichLinkMetadata(modules: SharedModuleInput[]): Promise<SharedModuleInput[]> {
  return Promise.all(
    modules.map(async (m) => {
      if (m.type !== "link") return m;
      const url = (m.data as LinkData).url;
      if (!url) return m;
      try {
        const res = await fetch(`/api/og?url=${encodeURIComponent(url)}`);
        if (!res.ok) return m;
        const data = (await res.json()) as LinkData;
        return {
          ...m,
          data: {
            url: data.url || url,
            title: data.title || (m.data as LinkData).title || url,
            description: data.description || "",
            favicon: data.favicon || "",
            thumbnail: data.thumbnail || "",
          } satisfies LinkData,
        };
      } catch {
        return m;
      }
    })
  );
}

export default function ShareTargetPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading: authLoading } = useAuthStore();
  const addSharedModulesToInbox = useCanvasStore((s) => s.addSharedModulesToInbox);
  const processingRef = useRef(false);
  const [message, setMessage] = useState("공유 항목을 정리 중이에요…");

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace("/auth/login?next=/share-target?ok=1");
      return;
    }

    if (processingRef.current) return;
    processingRef.current = true;

    (async () => {
      const items = await drainPendingShareItems();
      if (items.length === 0) {
        router.replace("/");
        return;
      }

      const inboxId = await ensureInboxBoard(user.id);
      if (!inboxId) {
        setMessage("받은 메모 보드를 준비하지 못했어요. 잠시 후 다시 시도해 주세요.");
        window.setTimeout(() => router.replace("/"), 3000);
        return;
      }

      const { accepted, rejected } = classifyShare(items);
      const enriched = await enrichLinkMetadata(accepted);

      let count = 0;
      if (enriched.length > 0) {
        const ids = addSharedModulesToInbox(inboxId, enriched);
        count = ids.length;
      }

      const tooLarge = rejected.filter(
        (r: PendingShareItem) => r.rejectedReason === "too_large"
      ).length;

      const search = new URLSearchParams();
      search.set("board", inboxId);
      if (count > 0) {
        search.set("toast", "share-ok");
        search.set("count", String(count));
      }
      if (tooLarge > 0) search.set("rejectedTooLarge", String(tooLarge));
      router.replace(`/?${search.toString()}`);
    })().catch((err) => {
      console.error("[share-target]", err);
      setMessage("공유 처리 중 오류가 났어요. 홈으로 이동합니다.");
      window.setTimeout(() => router.replace("/"), 1500);
    });
  }, [authLoading, user, router, addSharedModulesToInbox]);

  useEffect(() => {
    void params;
  }, [params]);

  return (
    <div
      style={{
        height: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--background)",
        color: "var(--text-primary)",
        padding: 24,
        textAlign: "center",
      }}
    >
      <div>
        <div style={{ fontSize: 48, marginBottom: 12 }}>📥</div>
        <div style={{ fontSize: 15 }}>{message}</div>
      </div>
    </div>
  );
}
