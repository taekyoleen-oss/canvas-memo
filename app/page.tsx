"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCanvasStore, initSupabaseSync } from "@/store/canvas";
import { useAuthStore } from "@/store/auth";
import type { BoardCategory, ModuleType } from "@/types";
import { normalizeBoardCategory } from "@/lib/boardCategory";
import { isModuleTypeAllowedOnCategory } from "@/lib/boardModulePolicy";
import TopHeader from "@/components/layout/TopHeader";
import BottomTabBar from "@/components/layout/BottomTabBar";
import Sidebar from "@/components/layout/Sidebar";
import MobileDrawer from "@/components/layout/MobileDrawer";
import Canvas from "@/components/canvas/Canvas";
import ModuleToolbar from "@/components/ui-overlays/ModuleToolbar";
import RichTextToolbar from "@/components/ui-overlays/RichTextToolbar";
import ModuleSearch from "@/components/ui-overlays/ModuleSearch";

interface AddBoardDialogProps {
  isOpen: boolean;
  initialCategory: BoardCategory;
  onClose: () => void;
  onConfirm: (name: string, icon: string, category: BoardCategory) => void;
}

function AddBoardDialog({
  isOpen,
  initialCategory,
  onClose,
  onConfirm,
}: AddBoardDialogProps) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("📋");
  const [category, setCategory] = useState<BoardCategory>(initialCategory);

  useEffect(() => {
    if (!isOpen) return;
    setCategory(initialCategory);
    setIcon(initialCategory === "thinking" ? "💡" : "📋");
    setName("");
  }, [isOpen, initialCategory]);

  if (!isOpen) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onConfirm(
      name.trim(),
      icon || (category === "thinking" ? "💡" : "📋"),
      category
    );
    setName("");
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
        <div className="flex rounded-lg p-0.5" style={{ background: "var(--surface-hover)" }}>
          {(
            [
              { id: "memo_schedule" as const, label: "메모 및 일정" },
              { id: "thinking" as const, label: "생각정리" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setCategory(tab.id);
                if (tab.id === "thinking") setIcon((ic) => (ic === "📋" ? "💡" : ic));
              }}
              className="flex-1 rounded-md py-2 text-sm font-medium"
              style={{
                background: category === tab.id ? "var(--surface-elevated)" : "transparent",
                color: category === tab.id ? "var(--primary)" : "var(--text-secondary)",
                border:
                  category === tab.id ? "1px solid var(--border)" : "1px solid transparent",
                boxShadow: category === tab.id ? "var(--shadow-sm)" : "none",
                cursor: "pointer",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
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
  const router = useRouter();
  const {
    boards,
    activeBoardId,
    addBoard,
    addModule,
    setActiveBoard,
    hydrateForUser,
    hydrateFromSupabase,
    resetForLogout,
  } = useCanvasStore();
  const { user, loading: authLoading, init: initAuth } = useAuthStore();
  const [addBoardState, setAddBoardState] = useState<{
    open: boolean;
    category: BoardCategory;
  }>({ open: false, category: "memo_schedule" });
  const [showMobileDrawer, setShowMobileDrawer] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [appReady, setAppReady] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const exitConfirmedRef = useRef(false);

  // auth 초기화 (1회)
  useEffect(() => {
    initAuth();
  }, [initAuth]);

  // 로그인한 사용자만 계정별 로컬 캐시 로드 (비로그인 시 캔버스 데이터는 로드하지 않음)
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      resetForLogout();
      setAppReady(true);
      return;
    }
    hydrateForUser(user.id);
    setAppReady(true);
  }, [user, authLoading, hydrateForUser, resetForLogout]);

  // 로그인 상태에서 Supabase와 동기화
  useEffect(() => {
    if (!user || authLoading) return;
    initSupabaseSync(user.id);
    hydrateFromSupabase(user.id);
  }, [user, authLoading, hydrateFromSupabase]);

  // 미들웨어가 없는 환경(로컬 env 미설정 등)에서도 비로그인 시 로그인으로 이동
  useEffect(() => {
    if (!authLoading && appReady && !user) {
      router.replace("/auth/login");
    }
  }, [authLoading, appReady, user, router]);

  // Ctrl+K: 검색 열기
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setShowSearch((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 뒤로가기(Back) 버튼 → 항상 앱 종료 확인 다이얼로그 표시
  useEffect(() => {
    // 더미 히스토리 상태를 쌓아 뒤로가기를 가로챔
    window.history.pushState({ appGuard: true }, "");

    function handlePopState() {
      if (exitConfirmedRef.current) {
        // 종료가 승인된 상태이므로 이후의 라우팅/종료 처리를 방해하지 않음
        return;
      }
      // 다시 더미 상태를 쌓아 다음 뒤로가기도 가로챔
      window.history.pushState({ appGuard: true }, "");
      setShowExitConfirm(true);
    }

    // 브라우저 탭 닫기 / 새로고침 시 종료 확인
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (exitConfirmedRef.current) return;
      e.preventDefault();
    }

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  const activeBoard = boards.find((b) => b.id === activeBoardId);
  const activeBoardCategory: BoardCategory = activeBoard
    ? normalizeBoardCategory(activeBoard)
    : "memo_schedule";

  function handleAddBoard(
    name: string,
    icon: string,
    category: BoardCategory
  ) {
    addBoard({
      name,
      icon,
      color: category === "thinking" ? "#7C3AED" : "#6366F1",
      category,
    });
  }

  function handleAddModule(
    type: ModuleType,
    position?: { x: number; y: number }
  ) {
    if (!activeBoardId) return;
    const catBoard = boards.find((b) => b.id === activeBoardId);
    const cat = catBoard ? normalizeBoardCategory(catBoard) : "memo_schedule";
    if (!isModuleTypeAllowedOnCategory(type, cat)) return;
    const defaultData =
      type === "memo"
        ? { title: "새 메모", content: "", previewLines: 2 }
        : type === "schedule"
        ? { title: "새 일정", items: [], previewCount: 3 }
        : type === "brainstorm"
        ? { title: "브레인스토밍", items: [], previewCount: 4 }
        : type === "image"
        ? { title: "이미지", src: "", caption: "" }
        : type === "link"
        ? { url: "", title: "링크", description: "", favicon: "", thumbnail: "" }
        : { title: "파일", fileName: "", fileType: "", fileSize: 0, src: "" };
    const pos = position ?? {
      x: 80 + Math.random() * 200,
      y: 80 + Math.random() * 120,
    };
    const boardForZ = boards.find((b) => b.id === activeBoardId);
    const maxZIndex =
      boardForZ?.modules.reduce((max, m) => Math.max(max, Number(m.zIndex) || 0), 0) ?? 0;
    addModule(activeBoardId, {
      type,
      position: pos,
      size: { width: 260, height: 200 },
      zIndex: maxZIndex + 1,
      color: "default",
      isExpanded: false,
      data: defaultData,
    });
  }

  // 인증·로컬 캐시 준비 전
  if (!appReady || authLoading) {
    return <div style={{ width: "100%", height: "100dvh", background: "var(--background)" }} />;
  }

  // 비로그인(리다이렉트 중)
  if (!user) {
    return <div style={{ width: "100%", height: "100dvh", background: "var(--background)" }} />;
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
            메모·일정 보드와 생각정리(브레인스토밍) 보드를 나눠 쓸 수 있어요.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md justify-center">
            <button
              type="button"
              onClick={() =>
                setAddBoardState({ open: true, category: "memo_schedule" })
              }
              className="rounded-xl px-6 font-semibold"
              style={{
                height: 52,
                background: "var(--primary)",
                color: "var(--primary-fg)",
                border: "none",
                cursor: "pointer",
                fontSize: 15,
                boxShadow: "var(--shadow-md)",
              }}
            >
              + 메모·일정 첫 보드
            </button>
            <button
              type="button"
              onClick={() =>
                setAddBoardState({ open: true, category: "thinking" })
              }
              className="rounded-xl px-6 font-semibold"
              style={{
                height: 52,
                background: "var(--surface-elevated)",
                color: "var(--primary)",
                border: "2px solid var(--primary)",
                cursor: "pointer",
                fontSize: 15,
                boxShadow: "var(--shadow-md)",
              }}
            >
              + 생각정리 첫 보드
            </button>
          </div>
        </div>
        <AddBoardDialog
          isOpen={addBoardState.open}
          initialCategory={addBoardState.category}
          onClose={() => setAddBoardState((s) => ({ ...s, open: false }))}
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
          onAddModule={() =>
            handleAddModule(
              activeBoardCategory === "thinking" ? "brainstorm" : "memo"
            )
          }
          onMenuClick={() => setShowMobileDrawer(true)}
        />
        {activeBoardId && (
          <ModuleToolbar
            boardCategory={activeBoardCategory}
            onAdd={handleAddModule}
            onSearch={() => setShowSearch(true)}
          />
        )}
        {activeBoardId && <RichTextToolbar />}
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
          onAdd={(category) =>
            setAddBoardState({ open: true, category })
          }
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
          onAdd={(category) =>
            setAddBoardState({ open: true, category })
          }
        />
        <div className="flex-1 flex flex-col overflow-hidden">
          {activeBoardId && (
            <ModuleToolbar
              boardCategory={activeBoardCategory}
              onAdd={handleAddModule}
              onSearch={() => setShowSearch(true)}
            />
          )}
          {activeBoardId && <RichTextToolbar />}
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
      </div>

      {/* 보드 추가 다이얼로그 */}
      <AddBoardDialog
        isOpen={addBoardState.open}
        initialCategory={addBoardState.category}
        onClose={() => setAddBoardState((s) => ({ ...s, open: false }))}
        onConfirm={handleAddBoard}
      />

      {/* 모듈 검색 */}
      <ModuleSearch isOpen={showSearch} onClose={() => setShowSearch(false)} />

      {/* 앱 종료 확인 다이얼로그 */}
      {showExitConfirm && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ zIndex: 500, background: "rgba(0,0,0,0.5)" }}
          onClick={() => setShowExitConfirm(false)}
        >
          <div
            className="rounded-2xl p-6 flex flex-col gap-4 mx-4"
            style={{
              width: 288,
              background: "var(--surface-elevated)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-lg)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <span style={{ fontSize: 36 }}>👋</span>
              <p className="text-base font-semibold mt-2" style={{ color: "var(--text-primary)" }}>
                앱을 종료하시겠습니까?
              </p>
              <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                변경 사항은 자동 저장됩니다.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 py-2 rounded-xl text-sm font-medium transition-colors"
                style={{
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                }}
              >
                취소
              </button>
              <button
                onClick={() => {
                  exitConfirmedRef.current = true;
                  setShowExitConfirm(false);

                  // 1. 일반적인 탭/창 종료 시도
                  window.close();

                  // 2. 모바일 브라우저 우회 닫기 시도
                  try {
                    window.opener = null;
                    window.open("", "_self");
                    window.close();
                  } catch (e) {}

                  // 3. 외부 앱/웹뷰 등 네이티브 환경 우회
                  try {
                    if ((navigator as any).app && (navigator as any).app.exitApp) {
                      (navigator as any).app.exitApp();
                    } else if ((window as any).ReactNativeWebView) {
                      (window as any).ReactNativeWebView.postMessage("exitApp");
                    }
                  } catch (e) {}

                  // 4. 강제 뒤로가기로 앱/브라우저 이탈
                  // 팝업이 띄워지면서 더미 state가 추가된 상태이므로 2칸 뒤로가기 실행
                  window.history.go(-2);

                  // 위 방법들이 혹시라도 모두 실패했다면, 다음 뒤로가기 시 팝업을 띄우기 위해 일정 시간 뒤 ref 초기화
                  setTimeout(() => {
                    exitConfirmedRef.current = false;
                  }, 1500);
                }}
                className="flex-1 py-2 rounded-xl text-sm font-semibold"
                style={{
                  background: "var(--primary)",
                  color: "var(--primary-fg)",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                종료
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 모바일 드로어 */}
      <MobileDrawer
        isOpen={showMobileDrawer}
        onClose={() => setShowMobileDrawer(false)}
        boards={boards}
        activeBoardId={activeBoardId}
        onSelect={(id) => { setActiveBoard(id); }}
        onAdd={(category) =>
          setAddBoardState({ open: true, category })
        }
      />
    </>
  );
}
