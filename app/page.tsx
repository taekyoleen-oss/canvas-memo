"use client";

import { useEffect, useState } from "react";
import { useCanvasStore } from "@/store/canvas";
import TopHeader from "@/components/layout/TopHeader";
import BottomTabBar from "@/components/layout/BottomTabBar";
import Sidebar from "@/components/layout/Sidebar";
import Canvas from "@/components/canvas/Canvas";
import ModuleFAB from "@/components/ui-overlays/ModuleFAB";

interface AddBoardDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (name: string, icon: string) => void;
}

function AddBoardDialog({ isOpen, onClose, onConfirm }: AddBoardDialogProps) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("📋");

  if (!isOpen) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onConfirm(name.trim(), icon || "📋");
    setName("");
    setIcon("📋");
    onClose();
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 100, background: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl p-6 flex flex-col gap-4 w-full max-w-sm mx-4"
        style={{
          background: "var(--surface-elevated)",
          boxShadow: "var(--shadow-lg)",
          border: "1px solid var(--border)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          className="text-lg font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          새 보드 만들기
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="🗂"
              maxLength={2}
              className="rounded-lg px-3 text-center text-2xl"
              style={{
                width: 56,
                height: 44,
                background: "var(--surface-hover)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
                outline: "none",
              }}
            />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="보드 이름"
              autoFocus
              className="flex-1 rounded-lg px-3"
              style={{
                height: 44,
                background: "var(--surface-hover)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
                fontSize: 15,
                outline: "none",
              }}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4"
              style={{
                height: 44,
                background: "var(--surface-hover)",
                border: "1px solid var(--border)",
                color: "var(--text-secondary)",
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              취소
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="rounded-lg px-5 font-medium"
              style={{
                height: 44,
                background: name.trim() ? "var(--primary)" : "var(--border)",
                color: name.trim() ? "var(--primary-fg)" : "var(--text-muted)",
                border: "none",
                cursor: name.trim() ? "pointer" : "not-allowed",
                fontSize: 14,
              }}
            >
              만들기
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Home() {
  const { boards, activeBoardId, addBoard, addModule, setActiveBoard, hydrate } =
    useCanvasStore();
  const [showAddBoard, setShowAddBoard] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const activeBoard = boards.find((b) => b.id === activeBoardId);

  function handleAddBoard(name: string, icon: string) {
    addBoard({ name, icon, color: "#6366F1" });
  }

  function handleAddModule(
    type: import("@/types").ModuleType,
    position?: { x: number; y: number }
  ) {
    if (!activeBoardId) return;
    const defaultData =
      type === "memo"
        ? { title: "새 메모", content: "", previewLines: 2 }
        : type === "schedule"
        ? { title: "새 일정", items: [], previewCount: 3 }
        : type === "image"
        ? { title: "이미지", src: "", caption: "" }
        : { url: "", title: "링크", description: "", favicon: "", thumbnail: "" };
    const pos = position ?? {
      x: 80 + Math.random() * 200,
      y: 80 + Math.random() * 120,
    };
    addModule(activeBoardId, {
      type,
      position: pos,
      size: { width: 260, height: 200 },
      zIndex: 1,
      color: "default",
      isExpanded: false,
      data: defaultData,
    });
  }

  // 온보딩 화면 (보드 없음)
  if (boards.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-screen gap-6 px-4"
        style={{ background: "var(--background)" }}
      >
        <div className="text-center flex flex-col items-center gap-4">
          <span style={{ fontSize: 64 }}>🧠</span>
          <h1
            className="text-2xl font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            MindCanvas에 오신 걸 환영해요
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: 15 }}>
            생각을 캔버스 위에 자유롭게 펼쳐보세요.
            <br />
            첫 번째 보드를 만들어 시작하세요.
          </p>
          <button
            onClick={() => setShowAddBoard(true)}
            className="rounded-xl px-8 font-semibold"
            style={{
              height: 52,
              background: "var(--primary)",
              color: "var(--primary-fg)",
              border: "none",
              cursor: "pointer",
              fontSize: 16,
              boxShadow: "var(--shadow-md)",
            }}
          >
            + 첫 보드 만들기
          </button>
        </div>
        <AddBoardDialog
          isOpen={showAddBoard}
          onClose={() => setShowAddBoard(false)}
          onConfirm={handleAddBoard}
        />
      </div>
    );
  }

  return (
    <>
      {/* 모바일 레이아웃 */}
      <div
        className="flex flex-col h-screen md:hidden"
        style={{ background: "var(--background)" }}
      >
        <TopHeader
          boardName={activeBoard?.name ?? "보드"}
          onAddModule={() => handleAddModule("memo")}
        />
        <div className="flex-1 relative overflow-hidden">
          {activeBoardId ? (
            <Canvas boardId={activeBoardId} onAddModule={handleAddModule} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <span style={{ color: "var(--text-muted)", fontSize: 14 }}>
                하단에서 보드를 선택하세요
              </span>
            </div>
          )}
        </div>
        <BottomTabBar
          boards={boards}
          activeBoardId={activeBoardId}
          onSelect={setActiveBoard}
          onAdd={() => setShowAddBoard(true)}
        />
      </div>

      {/* PC 레이아웃 */}
      <div
        className="hidden md:flex h-screen"
        style={{ background: "var(--background)" }}
      >
        <Sidebar
          boards={boards}
          activeBoardId={activeBoardId}
          onSelect={setActiveBoard}
          onAdd={() => setShowAddBoard(true)}
        />
        <div className="flex-1 relative overflow-hidden">
          {activeBoardId ? (
            <Canvas boardId={activeBoardId} onAddModule={handleAddModule} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <span style={{ color: "var(--text-muted)", fontSize: 14 }}>
                좌측에서 보드를 선택하세요
              </span>
            </div>
          )}
        </div>
      </div>

      {/* FAB — 보드가 선택되어 있을 때만 표시 */}
      {activeBoardId && <ModuleFAB onAdd={handleAddModule} />}

      {/* 보드 추가 다이얼로그 */}
      <AddBoardDialog
        isOpen={showAddBoard}
        onClose={() => setShowAddBoard(false)}
        onConfirm={handleAddBoard}
      />
    </>
  );
}
