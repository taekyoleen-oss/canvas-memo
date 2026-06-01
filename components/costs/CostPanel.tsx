"use client";

import { useCallback, useEffect, useState } from "react";
import DailyBars, { type SeriesPoint } from "./DailyBars";

type Budget = {
  provider: string;
  monthly_limit_usd: number;
  alert_threshold: number;
};
type CostData = {
  series: SeriesPoint[];
  mtd: { anthropic: number; openai: number };
  budgets: Budget[];
};

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const PROVIDERS = [
  { key: "anthropic" as const, label: "Claude", colorVar: "var(--cost-anthropic)" },
  { key: "openai" as const, label: "OpenAI", colorVar: "var(--cost-openai)" },
];

function BudgetCard({
  label,
  spent,
  budget,
  color,
  onSaveBudget,
}: {
  label: string;
  spent: number;
  budget?: Budget;
  color: string;
  onSaveBudget: (limit: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const limit = budget?.monthly_limit_usd ?? 0;
  const threshold = budget?.alert_threshold ?? 0.8;
  const pct = limit > 0 ? Math.min(spent / limit, 1) : 0;
  const over = limit > 0 && spent / limit >= threshold;
  const remaining = limit - spent;

  function startEdit() {
    setDraft(limit > 0 ? String(limit) : "");
    setEditing(true);
  }
  async function save() {
    const v = Number(draft);
    if (!Number.isFinite(v) || v < 0) return;
    setSaving(true);
    try {
      await onSaveBudget(v);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="flex flex-col rounded-xl p-4"
      style={{
        background: "var(--surface-hover)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="flex items-center justify-between">
        <span
          className="flex items-center gap-1.5 text-xs font-semibold tracking-wide"
          style={{ color: "var(--text-secondary)" }}
        >
          <span style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
          {label} · 이번 달
        </span>
      </div>

      <div className="mt-1 text-2xl font-semibold" style={{ color: "var(--text-primary)" }}>
        {usd(spent)}
      </div>

      {editing ? (
        <div className="mt-3 flex items-center gap-2">
          <span style={{ color: "var(--text-muted)", fontSize: 13 }}>월 예산 $</span>
          <input
            type="number"
            min={0}
            step="1"
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void save();
              if (e.key === "Escape") setEditing(false);
            }}
            className="w-24 rounded-lg px-2"
            style={{
              height: 36,
              background: "var(--surface)",
              border: "1px solid var(--border-strong)",
              color: "var(--text-primary)",
              outline: "none",
            }}
          />
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="rounded-lg px-3 text-sm font-medium"
            style={{
              height: 36,
              background: "var(--primary)",
              color: "var(--primary-fg)",
              border: "none",
              cursor: "pointer",
            }}
          >
            저장
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-lg px-2 text-sm"
            style={{
              height: 36,
              background: "transparent",
              color: "var(--text-muted)",
              border: "none",
              cursor: "pointer",
            }}
          >
            취소
          </button>
        </div>
      ) : limit > 0 ? (
        <>
          <div
            className="mt-3 overflow-hidden rounded-full"
            style={{ height: 8, background: "var(--border)" }}
          >
            <div
              style={{
                width: `${pct * 100}%`,
                height: "100%",
                background: over ? "var(--danger)" : color,
                transition: "width .3s",
              }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span style={{ color: over ? "var(--danger)" : "var(--text-muted)" }}>
              한도 {usd(limit)} 중 {(pct * 100).toFixed(0)}%
              {over ? " · 경고 임계 초과" : ""}
            </span>
            <button
              type="button"
              onClick={startEdit}
              className="rounded px-1.5"
              style={{ color: "var(--primary)", background: "transparent", border: "none", cursor: "pointer" }}
            >
              예산 수정
            </button>
          </div>
          <div
            className="mt-1 text-sm font-medium"
            style={{ color: remaining < 0 ? "var(--danger)" : "var(--text-primary)" }}
          >
            남은 금액 {usd(remaining)}
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={startEdit}
          className="mt-3 self-start rounded-lg px-3 text-sm font-medium"
          style={{
            height: 36,
            background: "var(--primary-soft)",
            color: "var(--primary)",
            border: "none",
            cursor: "pointer",
          }}
        >
          + 월 예산 설정 (남은 금액 표시)
        </button>
      )}
    </div>
  );
}

export default function CostPanel({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [data, setData] = useState<CostData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/costs", { cache: "no-store" });
      if (res.status === 401) {
        setError("로그인이 필요합니다.");
        setData(null);
        return;
      }
      if (!res.ok) throw new Error(`조회 실패 (${res.status})`);
      setData((await res.json()) as CostData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "조회 중 오류");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) void load();
  }, [isOpen, load]);

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/costs/refresh", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `동기화 실패 (${res.status})`);
      const failed = Object.entries(json?.results ?? {})
        .filter(([, v]) => typeof v === "string" && v.startsWith("error"))
        .map(([k, v]) => `${k}: ${v}`);
      if (failed.length) setError(failed.join(" · "));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "동기화 중 오류");
    } finally {
      setRefreshing(false);
    }
  }

  async function saveBudget(provider: "anthropic" | "openai", limit: number) {
    const res = await fetch("/api/costs/budget", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider, monthly_limit_usd: limit }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json?.error || "예산 저장 실패");
    }
    await load();
  }

  if (!isOpen) return null;

  const total = (data?.mtd.anthropic ?? 0) + (data?.mtd.openai ?? 0);

  return (
    <div
      className="fixed inset-0"
      style={{ zIndex: 200, background: "rgba(0,0,0,0.45)" }}
      onClick={onClose}
    >
      <div
        className="absolute right-0 top-0 flex h-full w-full flex-col sm:w-[440px]"
        style={{
          background: "var(--surface-elevated)",
          borderLeft: "1px solid var(--border)",
          boxShadow: "var(--shadow-lg)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div
          className="flex items-center justify-between px-5"
          style={{ height: 56, borderBottom: "1px solid var(--border)", flexShrink: 0 }}
        >
          <div className="flex flex-col">
            <span className="font-semibold" style={{ color: "var(--text-primary)", fontSize: 16 }}>
              💲 API 사용량
            </span>
            <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
              이번 달 합계 {usd(total)} · 최근 60일
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center justify-center rounded-lg"
              style={{
                minWidth: 44,
                height: 44,
                background: "transparent",
                border: "none",
                cursor: refreshing ? "wait" : "pointer",
                color: "var(--text-secondary)",
                fontSize: 18,
              }}
              title="지금 동기화"
              aria-label="새로고침"
            >
              {refreshing ? "⏳" : "↻"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex items-center justify-center rounded-lg"
              style={{
                width: 44,
                height: 44,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "var(--text-secondary)",
                fontSize: 20,
              }}
              aria-label="닫기"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {error ? (
            <div
              className="mb-4 rounded-lg px-3 py-2 text-sm"
              style={{
                background: "var(--surface-hover)",
                border: "1px solid var(--danger)",
                color: "var(--danger)",
              }}
            >
              {error}
            </div>
          ) : null}

          {loading && !data ? (
            <div className="py-12 text-center text-sm" style={{ color: "var(--text-muted)" }}>
              불러오는 중…
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3">
                {PROVIDERS.map((p) => (
                  <BudgetCard
                    key={p.key}
                    label={p.label}
                    color={p.colorVar}
                    spent={data?.mtd[p.key] ?? 0}
                    budget={data?.budgets.find((b) => b.provider === p.key)}
                    onSaveBudget={(limit) => saveBudget(p.key, limit)}
                  />
                ))}
              </div>

              <div className="mt-5">
                <div className="mb-2 text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  일별 비용 (USD)
                </div>
                <DailyBars series={data?.series ?? []} />
              </div>

              <p className="mt-5 text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                API는 사용액만 제공합니다. &quot;남은 금액&quot;은 설정한 월 예산에서 이번 달 사용액을 뺀 값입니다.
                데이터가 비어 보이면 새로고침(↻)을 눌러 동기화하세요.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
