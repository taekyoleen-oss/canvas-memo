"use client";

import { useState } from "react";
import type { LinkData } from "@/types";
import { fetchOGMeta } from "@/lib/og/fetcher";

interface LinkModuleProps {
  data: LinkData;
  isExpanded: boolean;
  onChange: (data: LinkData) => void;
}

export default function LinkModule({
  data,
  isExpanded,
  onChange,
}: LinkModuleProps) {
  const [urlInput, setUrlInput] = useState(data.url);
  const [loading, setLoading] = useState(false);

  async function handleFetchMeta() {
    if (!urlInput.trim()) return;
    setLoading(true);
    try {
      const meta = await fetchOGMeta(urlInput.trim());
      onChange({ ...meta, url: urlInput.trim() });
    } finally {
      setLoading(false);
    }
  }

  if (!isExpanded) {
    return (
      <div className="px-3 py-2 flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          {data.favicon && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.favicon} alt="favicon" width={14} height={14} />
          )}
          <p
            className="text-sm font-medium truncate"
            style={{ color: "var(--text-primary)" }}
          >
            {data.title || data.url || "URL 없음"}
          </p>
        </div>
        {data.url && (
          <p
            className="text-xs truncate"
            style={{ color: "var(--text-muted)" }}
          >
            {data.url}
          </p>
        )}
        {data.thumbnail && (
          <div
            className="rounded overflow-hidden mt-1"
            style={{ height: 60, background: "var(--surface-hover)" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={data.thumbnail}
              alt={data.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="px-3 py-2 flex flex-col gap-2">
      <div className="flex gap-1">
        <input
          type="url"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleFetchMeta();
            }
          }}
          placeholder="https://example.com"
          className="flex-1 text-sm rounded px-2"
          style={{
            height: 36,
            background: "transparent",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
            outline: "none",
          }}
        />
        <button
          onClick={handleFetchMeta}
          disabled={loading}
          className="rounded px-2 text-xs font-medium"
          style={{
            height: 36,
            background: "var(--primary)",
            color: "var(--primary-fg)",
            border: "none",
            cursor: loading ? "wait" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "..." : "가져오기"}
        </button>
      </div>

      {data.thumbnail && (
        <div
          className="rounded overflow-hidden"
          style={{ height: 120, background: "var(--surface-hover)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.thumbnail}
            alt={data.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {data.title && (
        <p
          className="text-sm font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          {data.title}
        </p>
      )}

      {data.description && (
        <p
          className="text-xs"
          style={{
            color: "var(--text-secondary)",
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
          }}
        >
          {data.description}
        </p>
      )}
    </div>
  );
}
