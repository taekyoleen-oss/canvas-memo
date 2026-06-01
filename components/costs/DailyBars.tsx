"use client";

export type SeriesPoint = {
  date: string;
  anthropic: number;
  openai: number;
  total: number;
};

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

// recharts 없이 경량 스택 막대. 최근 60일 일별 합계(anthropic/openai).
export default function DailyBars({ series }: { series: SeriesPoint[] }) {
  if (series.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg text-xs"
        style={{
          height: 140,
          background: "var(--surface-hover)",
          color: "var(--text-muted)",
          border: "1px dashed var(--border)",
        }}
      >
        아직 데이터가 없어요. 위 새로고침을 한 번 눌러보세요.
      </div>
    );
  }

  const max = Math.max(...series.map((s) => s.total), 0.0001);

  return (
    <div className="flex flex-col gap-1">
      <div
        className="flex items-end gap-[2px]"
        style={{ height: 140 }}
        role="img"
        aria-label="일별 API 비용 막대 그래프"
      >
        {series.map((s) => {
          const aH = (s.anthropic / max) * 100;
          const oH = (s.openai / max) * 100;
          return (
            <div
              key={s.date}
              className="flex flex-1 flex-col justify-end"
              style={{ height: "100%", minWidth: 2 }}
              title={`${s.date} · ${usd(s.total)} (Claude ${usd(
                s.anthropic
              )} / OpenAI ${usd(s.openai)})`}
            >
              <div
                style={{
                  height: `${oH}%`,
                  background: "var(--cost-openai)",
                  borderTopLeftRadius: 2,
                  borderTopRightRadius: 2,
                }}
              />
              <div
                style={{
                  height: `${aH}%`,
                  background: "var(--cost-anthropic)",
                }}
              />
            </div>
          );
        })}
      </div>
      <div
        className="flex justify-between text-[10px]"
        style={{ color: "var(--text-muted)" }}
      >
        <span>{series[0]?.date.slice(5)}</span>
        <span>{series[series.length - 1]?.date.slice(5)}</span>
      </div>
      <div className="mt-1 flex items-center gap-3 text-[11px]" style={{ color: "var(--text-secondary)" }}>
        <span className="flex items-center gap-1">
          <span
            style={{ width: 10, height: 10, borderRadius: 2, background: "var(--cost-anthropic)" }}
          />
          Claude
        </span>
        <span className="flex items-center gap-1">
          <span
            style={{ width: 10, height: 10, borderRadius: 2, background: "var(--cost-openai)" }}
          />
          OpenAI
        </span>
      </div>
    </div>
  );
}
