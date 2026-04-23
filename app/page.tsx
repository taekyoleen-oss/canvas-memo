"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCanvasStore, initSupabaseSync } from "@/store/canvas";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/store/auth";
import type { BoardCategory, ModuleType } from "@/types";
import { boardsForWorkspace, normalizeBoardCategory } from "@/lib/boardCategory";
import { isModuleTypeAllowedOnCategory } from "@/lib/boardModulePolicy";
import { screenToCanvas } from "@/lib/canvas/geometry";
import TopHeader from "@/components/layout/TopHeader";
import BottomTabBar from "@/components/layout/BottomTabBar";
import Sidebar from "@/components/layout/Sidebar";
import MobileDrawer from "@/components/layout/MobileDrawer";
import WorkspaceSwitcher from "@/components/layout/WorkspaceSwitcher";
import Canvas from "@/components/canvas/Canvas";
import ModuleToolbar from "@/components/ui-overlays/ModuleToolbar";
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
    setIcon(
      initialCategory === "thinking"
        ? "💡"
        : initialCategory === "topic_notes"
          ? "📓"
          : "📋"
    );
    setName("");
  }, [isOpen, initialCategory]);

  if (!isOpen) return null;

  const canSubmit = category === "topic_notes" || !!name.trim();

  const categoryLabel =
    category === "memo_schedule"
      ? "메모/할일"
      : category === "thinking"
        ? "생각정리"
        : "주제별";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    onConfirm(
      name.trim() ||
        (category === "topic_notes" ? "주제별" : ""),
      icon ||
        (category === "thinking" ? "💡" : category === "topic_notes" ? "📓" : "📋"),
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
        <div
          className="flex flex-wrap rounded-lg p-0.5 gap-0.5"
          style={{ background: "var(--surface-hover)" }}
        >
          {(
            [
              { id: "memo_schedule" as const, label: "메모/할일" },
              { id: "thinking" as const, label: "생각정리" },
              { id: "topic_notes" as const, label: "주제별" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setCategory(tab.id);
                if (tab.id === "thinking") setIcon((ic) => (ic === "📋" || ic === "📓" ? "💡" : ic));
                else if (tab.id === "topic_notes") setIcon((ic) => (ic === "📋" || ic === "💡" ? "📓" : ic));
                else setIcon((ic) => (ic === "💡" || ic === "📓" ? "📋" : ic));
              }}
              className="min-w-[30%] flex-1 rounded-md py-2 text-xs sm:text-sm font-medium"
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
        <div
          className="rounded-lg px-3 py-2 text-xs font-medium"
          style={{
            background: "var(--surface-hover)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
          }}
        >
          추가 영역: <span style={{ color: "var(--primary)" }}>{categoryLabel}</span>
          {name.trim() ? (
            <>
              {" "}
              · 이름: <span style={{ color: "var(--text-secondary)" }}>{name.trim()}</span>
            </>
          ) : null}
        </div>
        {category === "topic_notes" ? (
          <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
            「클로드」「커서 AI」 기본 두 보드는 이미 준비돼 있어요. 여기서 만드는 것은 그 아래에 붙는{" "}
            <strong>새 주제별 보드 한 개</strong>예요. 이름·아이콘은 그 새 보드에만 적용돼요.
          </p>
        ) : null}
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
              placeholder={
                category === "topic_notes" ? "이름(선택)" : "보드 이름"
              }
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
              disabled={!canSubmit}
              className="rounded-lg px-5 font-medium"
              style={{
                height: 44,
                background: canSubmit ? "var(--primary)" : "var(--border)",
                color: canSubmit ? "var(--primary-fg)" : "var(--text-muted)",
                border: "none",
                cursor: canSubmit ? "pointer" : "not-allowed",
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
    activeWorkspace,
    canvasInnerByBoardId,
    addBoard,
    addModule,
    setActiveBoard,
    seedTopicNotesDefaults,
    hydrateForUser,
    hydrateFromSupabase,
    repairEmptyBoardsFromSupabase,
    recoverFromBrowserCaches,
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

  // 로그인: 원격에 보드가 있으면 Supabase → repair → 로컬은 탭/마지막 보드만 병합(보드 그래프 덮어쓰기 방지)
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      resetForLogout();
      setAppReady(true);
      return;
    }

    let cancelled = false;
    void (async () => {
      initSupabaseSync(user.id);
      const supabase = createClient();
      const { count, error } = await supabase
        .from("boards")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      if (cancelled) return;

      const remoteHasBoards = !error && (count ?? 0) > 0;

      if (remoteHasBoards) {
        await hydrateFromSupabase(user.id);
        if (cancelled) return;
        await repairEmptyBoardsFromSupabase(user.id);
        if (cancelled) return;
        await recoverFromBrowserCaches(user.id);
        if (cancelled) return;
        hydrateForUser(user.id, { preferRemoteBoards: true });
      } else {
        hydrateForUser(user.id);
        if (cancelled) return;
        await hydrateFromSupabase(user.id);
        if (cancelled) return;
        await repairEmptyBoardsFromSupabase(user.id);
        if (cancelled) return;
        await recoverFromBrowserCaches(user.id);
      }

      if (!cancelled) setAppReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    user,
    authLoading,
    hydrateForUser,
    hydrateFromSupabase,
    repairEmptyBoardsFromSupabase,
    recoverFromBrowserCaches,
    resetForLogout,
  ]);

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

  const workspaceBoards = useMemo(
    () => boardsForWorkspace(boards, activeWorkspace),
    [boards, activeWorkspace]
  );

  const workspaceLabel =
    activeWorkspace === "memo_schedule"
      ? "메모/할일"
      : activeWorkspace === "thinking"
        ? "생각정리"
        : "주제별";

  function handleAddBoard(
    name: string,
    icon: string,
    category: BoardCategory
  ) {
    addBoard({
      name,
      icon,
      color:
        category === "thinking"
          ? "#7C3AED"
          : category === "topic_notes"
            ? "#0d9488"
            : "#6366F1",
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
        ? {
            title: cat === "topic_notes" ? "노트" : "새 메모",
            content: "",
            previewLines: cat === "topic_notes" ? 6 : 2,
          }
        : type === "schedule"
        ? { title: "새 일정", items: [], previewCount: 3 }
        : type === "brainstorm"
        ? { title: "브레인스토밍", items: [], previewCount: 4 }
        : type === "image"
        ? { title: "이미지", src: "", caption: "" }
        : type === "link"
        ? { url: "", title: "링크", description: "", favicon: "", thumbnail: "" }
        : type === "table"
        ? {
            title: "표",
            rowCount: 3,
            colCount: 3,
            cells: Array(9).fill(""),
          }
        : { title: "파일", fileName: "", fileType: "", fileSize: 0, src: "" };
    const boardForZ = boards.find((b) => b.id === activeBoardId);
    const maxZIndex =
      boardForZ?.modules.reduce((max, m) => Math.max(max, Number(m.zIndex) || 0), 0) ?? 0;
    const defaultSize =
      type === "table"
        ? { width: 360, height: 280 }
        : cat === "topic_notes" && type === "memo"
          ? { width: 620, height: 500 }
          : { width: 260, height: 200 };
    const pos =
      position ??
      (() => {
        const brd = boards.find((b) => b.id === activeBoardId);
        const vp = brd?.viewport ?? { x: 0, y: 0, zoom: 1 };
        const inner = canvasInnerByBoardId[activeBoardId] ?? { w: 900, h: 560 };
        const center = screenToCanvas(inner.w / 2, inner.h / 2, vp);
        return {
          x: Math.round(center.x - defaultSize.width / 2 + (Math.random() * 24 - 12)),
          y: Math.round(center.y - defaultSize.height / 2 + (Math.random() * 24 - 12)),
        };
      })();
    addModule(activeBoardId, {
      type,
      position: pos,
      size: defaultSize,
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
            메모/할일, 생각정리, 주제별(노트·명령 모음)을 탭으로 나눠 쓸 수 있어요.
          </p>
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 w-full max-w-lg justify-center">
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
              + 메모/할일
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
              + 생각정리
            </button>
            <button
              type="button"
              onClick={() => seedTopicNotesDefaults()}
              className="rounded-xl px-6 font-semibold"
              style={{
                height: 52,
                background: "var(--surface-elevated)",
                color: "#0d9488",
                border: "2px solid #0d9488",
                cursor: "pointer",
                fontSize: 15,
                boxShadow: "var(--shadow-md)",
              }}
            >
              + 주제별
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
          workspaceLabel={workspaceLabel}
          onAddModule={() =>
            handleAddModule(
              activeBoardCategory === "thinking" ? "brainstorm" : "memo"
            )
          }
          onMenuClick={() => setShowMobileDrawer(true)}
        />
        <div
          className="flex min-w-0 flex-shrink-0 flex-col border-b"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
          }}
        >
          <WorkspaceSwitcher />
          {activeBoardId ? (
            <ModuleToolbar
              boardCategory={activeBoardCategory}
              onAdd={handleAddModule}
              onSearch={() => setShowSearch(true)}
            />
          ) : null}
        </div>
        <div className="flex-1 relative overflow-hidden">
            {activeBoardId ? (
            <Canvas boardId={activeBoardId} onAddModule={handleAddModule} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 px-4">
              <span style={{ color: "var(--text-muted)", fontSize: 14, textAlign: "center" }}>
                이 탭에 아직 보드가 없어요. 하단 + 또는 메뉴에서 새 보드를 만드세요.
              </span>
            </div>
          )}
        </div>
        <BottomTabBar
          boards={workspaceBoards}
          activeBoardId={activeBoardId}
          activeWorkspace={activeWorkspace}
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
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div
            className="flex min-w-0 flex-shrink-0 flex-col"
            style={{
              background: "var(--surface)",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <WorkspaceSwitcher />
            {activeBoardId ? (
              <ModuleToolbar
                boardCategory={activeBoardCategory}
                onAdd={handleAddModule}
                onSearch={() => setShowSearch(true)}
              />
            ) : (
              <div
                className="flex min-h-[48px] flex-1 items-center px-4 text-xs font-medium"
                style={{ color: "var(--text-muted)" }}
              >
                좌측 사이드바에서 보드를 선택하세요
              </div>
            )}
          </div>
          <div className="flex-1 relative overflow-hidden">
            {activeBoardId ? (
              <Canvas boardId={activeBoardId} onAddModule={handleAddModule} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-3 px-4">
                <span style={{ color: "var(--text-muted)", fontSize: 14, textAlign: "center" }}>
                  이 탭에 보드가 없습니다. 좌측 상단 + 로 새 보드를 추가하세요.
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
