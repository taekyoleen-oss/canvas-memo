"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "signup";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const supabase = createClient();

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage({ type: "error", text: "이메일 또는 비밀번호가 올바르지 않습니다." });
      } else {
        window.location.href = "/";
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) {
        setMessage({ type: "error", text: error.message });
      } else {
        setMessage({ type: "success", text: "확인 이메일을 발송했습니다. 받은 편지함을 확인해 주세요." });
      }
    }

    setLoading(false);
  }

  async function handleMagicLink() {
    if (!email) {
      setMessage({ type: "error", text: "이메일을 입력해 주세요." });
      return;
    }
    setLoading(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setMessage({ type: "error", text: error.message });
    } else {
      setMessage({ type: "success", text: `${email}로 로그인 링크를 발송했습니다.` });
    }
    setLoading(false);
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--background)" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8 flex flex-col gap-6"
        style={{
          background: "var(--surface-elevated)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        {/* 로고 */}
        <div className="flex flex-col items-center gap-2">
          <span style={{ fontSize: 40 }}>🧠</span>
          <h1
            className="text-xl font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            MindCanvas
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            시각적 지식 캔버스
          </p>
        </div>

        {/* 탭 */}
        <div
          className="flex rounded-lg overflow-hidden"
          style={{ border: "1px solid var(--border)" }}
        >
          {(["login", "signup"] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setMessage(null); }}
              className="flex-1"
              style={{
                height: 40,
                background: mode === m ? "var(--primary)" : "transparent",
                color: mode === m ? "var(--primary-fg)" : "var(--text-secondary)",
                border: "none",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: mode === m ? 600 : 400,
                transition: "all 150ms",
              }}
            >
              {m === "login" ? "로그인" : "회원가입"}
            </button>
          ))}
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="rounded-lg px-4"
            style={{
              height: 48,
              background: "var(--surface-hover)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
              fontSize: 14,
              outline: "none",
            }}
          />
          <input
            type="password"
            placeholder="비밀번호 (6자 이상)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="rounded-lg px-4"
            style={{
              height: 48,
              background: "var(--surface-hover)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
              fontSize: 14,
              outline: "none",
            }}
          />

          <button
            type="submit"
            disabled={loading}
            className="rounded-lg font-semibold"
            style={{
              height: 48,
              background: "var(--primary)",
              color: "var(--primary-fg)",
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: 15,
              opacity: loading ? 0.7 : 1,
              marginTop: 4,
            }}
          >
            {loading ? "처리 중..." : mode === "login" ? "로그인" : "회원가입"}
          </button>
        </form>

        {/* 구분선 */}
        <div className="flex items-center gap-3">
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>또는</span>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        </div>

        {/* 매직링크 */}
        <button
          onClick={handleMagicLink}
          disabled={loading}
          className="rounded-lg"
          style={{
            height: 48,
            background: "transparent",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
            cursor: loading ? "not-allowed" : "pointer",
            fontSize: 14,
            opacity: loading ? 0.7 : 1,
          }}
        >
          ✉️ 이메일 링크로 로그인
        </button>

        {/* 메시지 */}
        {message && (
          <p
            className="text-center rounded-lg px-3 py-2"
            style={{
              fontSize: 13,
              color: message.type === "success" ? "#16a34a" : "#dc2626",
              background: message.type === "success" ? "#f0fdf4" : "#fef2f2",
              border: `1px solid ${message.type === "success" ? "#bbf7d0" : "#fecaca"}`,
            }}
          >
            {message.text}
          </p>
        )}

        {/* 비로그인 계속 */}
        <button
          onClick={() => { window.location.href = "/"; }}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontSize: 13,
            color: "var(--text-muted)",
            textAlign: "center",
          }}
        >
          로그인 없이 계속하기 →
        </button>
      </div>
    </div>
  );
}
