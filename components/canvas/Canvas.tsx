"use client";

import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { useCanvasStore } from "@/store/canvas";
import { useConnectionStore } from "@/store/connection";
import { usePinchZoom } from "@/hooks/usePinchZoom";
import { screenToCanvas } from "@/lib/canvas/geometry";
import { computeMemoLikeLayout } from "@/lib/canvas/memoGridLayout";
import {
  computeArrangeLayout,
  type ArrangeMode,
  type ArrangeSortKey,
} from "@/lib/canvas/arrangeLayouts";
import { normalizeBoardCategory } from "@/lib/boardCategory";
import {
  isModuleTypeAllowedOnCategory,
  visibleModuleIdsForCanvas,
} from "@/lib/boardModulePolicy";
import { BRAINSTORM_MAP_OPTIONS } from "@/lib/brainstormMapMeta";
import {
  fileToDataUrl,
  getImageFileFromClipboardEvent,
} from "@/lib/imagePasteClipboard";
import { fetchOGMeta } from "@/lib/og/fetcher";
import type {
  Module,
  ModuleType,
  GroupColor,
  ImageData,
  LinkData,
  MemoData,
} from "@/types";
import CanvasGrid from "./CanvasGrid";
import ConnectionLayer from "./ConnectionLayer";
import ConnectionPreview from "./ConnectionPreview";
import GroupLayer from "./GroupLayer";
import ZoomControls from "./ZoomControls";
import ArrangeMenu from "./ArrangeMenu";
import MapTemplateWorkspaceChrome from "./MapTemplateWorkspaceChrome";
import MultiSelectActionBar from "./MultiSelectActionBar";
import MergeOrderBar from "./MergeOrderBar";
import ModuleCardWrapper from "@/components/modules/ModuleCardWrapper";
import { getImageSrcs } from "@/lib/imageData";
import type { ModuleColor } from "@/types";

interface CanvasProps {
  boardId: string;
  onAddModule: (type: ModuleType, position: { x: number; y: number }) => void;
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 1.2;

const GROUP_COLOR_CYCLE: GroupColor[] = ["yellow", "teal", "pink", "blue", "purple", "orange"];

// ── 그룹 이름 다이얼로그 ─────────────────────────────────────────────────
interface GroupNameDialogProps {
  moduleCount: number;
  groupCount: number;
  onConfirm: (name: string, color: GroupColor) => void;
  onCancel: () => void;
}

const COLOR_LABELS: Record<GroupColor, string> = {
  yellow: "노랑", pink: "핑크", teal: "청록", blue: "파랑", purple: "보라", orange: "주황",
};

const COLOR_VALUES: Record<GroupColor, string> = {
  yellow: "#fbbf24", pink: "#ec4899", teal: "#14b8a6",
  blue: "#6366f1", purple: "#a855f7", orange: "#f97316",
};

function GroupNameDialog({ moduleCount, groupCount, onConfirm, onCancel }: GroupNameDialogProps) {
  const [name, setName] = useState(`그룹 ${groupCount + 1}`);
  const [color, setColor] = useState<GroupColor>(GROUP_COLOR_CYCLE[groupCount % GROUP_COLOR_CYCLE.length]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: "var(--surface-elevated)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: 24,
          width: 320,
          boxShadow: "var(--shadow-lg)",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            그룹 만들기
          </h3>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4, marginBottom: 0 }}>
            {moduleCount}개 모듈을 묶습니다
          </p>
        </div>

        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) onConfirm(name.trim(), color);
            if (e.key === "Escape") onCancel();
          }}
          placeholder="그룹 이름"
          style={{
            height: 40,
            padding: "0 12px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--surface-hover)",
            color: "var(--text-primary)",
            fontSize: 14,
            outline: "none",
          }}
        />

        {/* 색상 선택 */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(Object.keys(COLOR_VALUES) as GroupColor[]).map((c) => (
            <button
              key={c}
              title={COLOR_LABELS[c]}
              onClick={() => setColor(c)}
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: COLOR_VALUES[c],
                border: color === c ? "3px solid var(--text-primary)" : "2px solid transparent",
                cursor: "pointer",
                outline: "none",
                transition: "border 0.1s",
              }}
            />
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{
              height: 36, padding: "0 16px", borderRadius: 8,
              border: "1px solid var(--border)", background: "transparent",
              color: "var(--text-secondary)", cursor: "pointer", fontSize: 13,
            }}
          >취소</button>
          <button
            disabled={!name.trim()}
            onClick={() => name.trim() && onConfirm(name.trim(), color)}
            style={{
              height: 36, padding: "0 20px", borderRadius: 8,
              border: "none",
              background: name.trim() ? "var(--primary)" : "var(--border)",
              color: name.trim() ? "var(--primary-fg)" : "var(--text-muted)",
              cursor: name.trim() ? "pointer" : "not-allowed",
              fontSize: 13, fontWeight: 600,
            }}
          >그룹 만들기</button>
        </div>
      </div>
    </div>
  );
}

// ── 그룹 초대 다이얼로그 ─────────────────────────────────────────────────
interface GroupInviteDialogProps {
  groupName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function GroupInviteDialog({ groupName, onConfirm, onCancel }: GroupInviteDialogProps) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div
        className="relative rounded-2xl p-6 flex flex-col gap-4"
        style={{
          width: 320,
          background: "var(--surface-elevated)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <p className="text-sm font-medium text-center" style={{ color: "var(--text-primary)" }}>
          <span style={{ fontWeight: 700, color: "var(--primary)" }}>&#39;{groupName}&#39;</span> 그룹에 추가하시겠습니까?
        </p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-xl text-sm transition-colors"
            style={{ border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer" }}
          >
            연결만
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2 rounded-xl text-sm font-semibold transition-opacity"
            style={{ background: "var(--primary)", color: "var(--primary-fg)", border: "none", cursor: "pointer" }}
          >
            그룹에 추가
          </button>
        </div>
      </div>
    </div>
  );
}

interface ModuleClipboardEntry {
  type: Module["type"];
  data: Module["data"];
  size: Module["size"];
  color: Module["color"];
  shape?: Module["shape"];
  isExpanded: boolean;
  isMinimized?: boolean;
  /** 기준 좌표(=클립보드 안 모듈들 중 최소 좌표)에서의 오프셋 */
  offset: { x: number; y: number };
}
/** 캔버스 내 다중 모듈 클립보드. 보드 간 이동/붙여넣기를 위해 모듈 외부에 둠 */
let _canvasMultiClipboard: { modules: ModuleClipboardEntry[] } | null = null;

/** 문자열 전체가 단일 URL인지 — 공백·줄바꿈을 포함한 본문은 false */
const URL_REGEX = /^https?:\/\/[\w.-]+(?:\.[\w.-]+)+[^\s]*$/i;
function isWholeStringSingleUrl(text: string): boolean {
  return URL_REGEX.test(text.trim());
}

// ── 메인 Canvas 컴포넌트 ────────────────────────────────────────────────
export default function Canvas({ boardId, onAddModule }: CanvasProps) {
  const board = useCanvasStore((s) => s.boards.find((b) => b.id === boardId));
  const updateViewport = useCanvasStore((s) => s.updateViewport);
  const updateModule = useCanvasStore((s) => s.updateModule);
  const removeModule = useCanvasStore((s) => s.removeModule);
  const addModulesBatch = useCanvasStore((s) => s.addModulesBatch);
  const addGroup = useCanvasStore((s) => s.addGroup);
  const updateGroup = useCanvasStore((s) => s.updateGroup);
  const focusGroupId = useCanvasStore((s) => s.focusGroupId);
  const setFocusGroup = useCanvasStore((s) => s.setFocusGroup);
  const focusModuleId = useCanvasStore((s) => s.focusModuleId);
  const setFocusModule = useCanvasStore((s) => s.setFocusModule);
  const mergeOrderRequestId = useCanvasStore((s) => s.mergeOrderRequestId);
  const undo = useCanvasStore((s) => s.undo);
  const pushHistory = useCanvasStore((s) => s.pushHistory);
  const pendingGroupInvite = useCanvasStore((s) => s.pendingGroupInvite);
  const clearGroupInvite = useCanvasStore((s) => s.clearGroupInvite);
  const scaleMapTemplateGroup = useCanvasStore((s) => s.scaleMapTemplateGroup);
  const appendMapToolModule = useCanvasStore((s) => s.appendMapToolModule);
  const setCanvasInnerSize = useCanvasStore((s) => s.setCanvasInnerSize);
  const cancelConnecting = useConnectionStore((s) => s.cancelConnecting);
  const updatePreviewPos = useConnectionStore((s) => s.updatePreviewPos);
  const connectionMode = useConnectionStore((s) => s.mode);

  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  // 뷰포트
  const [viewport, setViewport] = useState(() =>
    board?.viewport ?? { x: 0, y: 0, zoom: 1 }
  );

  useEffect(() => {
    if (board?.viewport) setViewport(board.viewport);
  }, [boardId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleViewportChange = useCallback(
    (vp: typeof viewport) => {
      setViewport(vp);
      updateViewport(boardId, vp);
    },
    [boardId, updateViewport]
  );

  usePinchZoom(containerRef, {
    onViewportChange: handleViewportChange,
    initialViewport: viewport,
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const report = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) setCanvasInnerSize(boardId, w, h);
    };
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, [boardId, setCanvasInnerSize]);

  // ── 라소(그룹 선택) 모드 ─────────────────────────────────────────
  const [lassoMode, setLassoMode] = useState(false);
  const [lasso, setLasso] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const lassoStartRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);

  // ── 다중 선택 ────────────────────────────────────────────────
  const [selectedMultiIds, setSelectedMultiIds] = useState<string[]>([]);
  // ── 순서 지정 합치기 ──────────────────────────────────────────
  const [mergeOrderMode, setMergeOrderMode] = useState(false);
  const [mergeOrderIds, setMergeOrderIds] = useState<string[]>([]);
  // 렌더링용 state + stale closure 방지용 ref 병행 사용
  const [selectionLasso, setSelectionLasso] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const selectionLassoRef = useRef<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const selectionStartRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const multiDragOriginsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // 그룹 이름 다이얼로그
  const [pendingModuleIds, setPendingModuleIds] = useState<string[]>([]);
  const [pendingBounds, setPendingBounds] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [showGroupDialog, setShowGroupDialog] = useState(false);

  // ── 정렬 메뉴 ──────────────────────────────────────────────────
  const [arrangeMenuAnchor, setArrangeMenuAnchor] = useState<
    { x: number; y: number } | null
  >(null);
  const [arrangeMode, setArrangeMode] = useState<ArrangeMode>("grid");
  const [arrangeSortKey, setArrangeSortKey] = useState<ArrangeSortKey>("updated");
  // 마지막 적용 안내 토스트
  const [arrangeFlash, setArrangeFlash] = useState<string | null>(null);
  useEffect(() => {
    if (!arrangeFlash) return;
    const id = window.setTimeout(() => setArrangeFlash(null), 2200);
    return () => window.clearTimeout(id);
  }, [arrangeFlash]);

  function handleEnterGroupMode() {
    setLassoMode(true);
    cancelConnecting();
    setSelectedModuleId(null);
  }

  function handleLassoPointerDown(e: React.PointerEvent) {
    if (!lassoMode) return;
    e.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const p = screenToCanvas(e.clientX - rect.left, e.clientY - rect.top, viewport);
    lassoStartRef.current = { x: p.x, y: p.y, pointerId: e.pointerId };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setLasso({ x1: p.x, y1: p.y, x2: p.x, y2: p.y });
  }

  function handleLassoPointerMove(e: React.PointerEvent) {
    if (!lassoMode || !lassoStartRef.current) return;
    if (lassoStartRef.current.pointerId !== e.pointerId) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const p = screenToCanvas(e.clientX - rect.left, e.clientY - rect.top, viewport);
    setLasso({ x1: lassoStartRef.current.x, y1: lassoStartRef.current.y, x2: p.x, y2: p.y });
  }

  function handleLassoPointerUp(e: React.PointerEvent) {
    if (!lassoMode || !lassoStartRef.current) return;
    lassoStartRef.current = null;

    if (!lasso) {
      setLassoMode(false);
      return;
    }

    const lx = Math.min(lasso.x1, lasso.x2);
    const ly = Math.min(lasso.y1, lasso.y2);
    const lw = Math.abs(lasso.x2 - lasso.x1);
    const lh = Math.abs(lasso.y2 - lasso.y1);

    // 너무 작으면 취소
    if (lw < 20 || lh < 20) {
      setLasso(null);
      setLassoMode(false);
      return;
    }

    // 라소 안에 있는 모듈 찾기 (접힌 그룹의 모듈 제외)
    const collapsedIds = new Set(
      (board?.groups ?? []).filter((g) => g.isCollapsed).flatMap((g) => g.moduleIds)
    );
    const hit = (board?.modules ?? []).filter((m) => {
      if (collapsedIds.has(m.id)) return false;
      const mx = m.position.x, my = m.position.y, mw = m.size.width, mh = m.size.height;
      return mx < lx + lw && mx + mw > lx && my < ly + lh && my + mh > ly;
    });

    setLasso(null);
    setLassoMode(false);

    if (hit.length === 0) return;

    setPendingModuleIds(hit.map((m) => m.id));
    setPendingBounds({ x: lx, y: ly, w: lw, h: lh });
    setShowGroupDialog(true);
  }

  function handleGroupConfirm(name: string, color: GroupColor) {
    if (!pendingBounds || pendingModuleIds.length === 0) return;
    addGroup(boardId, {
      name,
      moduleIds: pendingModuleIds,
      position: { x: pendingBounds.x, y: pendingBounds.y },
      size: { width: pendingBounds.w, height: pendingBounds.h },
      color,
      isCollapsed: false,
    });
    setPendingModuleIds([]);
    setPendingBounds(null);
    setShowGroupDialog(false);
  }

  // ── 그룹 초대 dialog 핸들러 ──────────────────────────────────────
  function handleGroupInviteConfirm() {
    if (!pendingGroupInvite) return;
    const { groupId, candidateModuleId, boardId: inviteBoardId } = pendingGroupInvite;
    const targetBoard = useCanvasStore.getState().boards.find((b) => b.id === inviteBoardId);
    const group = targetBoard?.groups?.find((g) => g.id === groupId);
    if (group && !group.moduleIds.includes(candidateModuleId)) {
      updateGroup(inviteBoardId, groupId, {
        moduleIds: [...group.moduleIds, candidateModuleId],
      });
    }
    clearGroupInvite();
  }

  function handleGroupInviteCancel() {
    clearGroupInvite();
  }

  // ── 사이드바에서 그룹 포커스 요청 처리 ──────────────────────────
  useEffect(() => {
    if (!focusGroupId || !board) return;
    const g = board.groups?.find((gr) => gr.id === focusGroupId);
    if (!g) return;

    const container = containerRef.current;
    if (!container) return;
    const W = container.clientWidth;
    const H = container.clientHeight;
    const PADDING = 80;

    // 접혀있으면 펼치기
    if (g.isCollapsed) {
      useCanvasStore.getState().updateGroup(boardId, g.id, { isCollapsed: false });
    }

    const contentW = g.size.width;
    const contentH = g.size.height;
    const zoom = Math.min(
      MAX_ZOOM,
      Math.max(MIN_ZOOM, Math.min((W - PADDING * 2) / contentW, (H - PADDING * 2) / contentH))
    );
    const vp = {
      x: (W - contentW * zoom) / 2 - g.position.x * zoom,
      y: (H - contentH * zoom) / 2 - g.position.y * zoom,
      zoom,
    };
    setViewport(vp);
    updateViewport(boardId, vp);
    setFocusGroup(null);
  }, [focusGroupId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 검색에서 모듈 포커스 요청 처리 ────────────────────────────────
  useEffect(() => {
    if (!focusModuleId || !board) return;
    const m = board.modules.find((mod) => mod.id === focusModuleId);
    if (!m) return;
    const container = containerRef.current;
    if (!container) return;
    const W = container.clientWidth;
    const H = container.clientHeight;
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, 1));
    const vp = {
      x: W / 2 - (m.position.x + m.size.width / 2) * zoom,
      y: H / 2 - (m.position.y + m.size.height / 2) * zoom,
      zoom,
    };
    setViewport(vp);
    updateViewport(boardId, vp);
    setFocusModule(null);
  }, [focusModuleId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 툴바의 "순서대로 합치기" 시작 요청 처리 ──────────────────────
  useEffect(() => {
    if (mergeOrderRequestId === 0) return;
    startMergeOrder();
  }, [mergeOrderRequestId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 다중 모듈 복사/붙여넣기 콜백 ─────────────────────────────────
  /** 현재 선택된 모듈(단일+다중)을 클립보드에 저장. 화면 좌상단 기준 상대 좌표로 보관 */
  const copySelectedModules = useCallback((): number => {
    if (!board) return 0;
    const ids = new Set<string>([
      ...selectedMultiIds,
      ...(selectedModuleId ? [selectedModuleId] : []),
    ]);
    if (ids.size === 0) return 0;
    const collapsedIds = new Set(
      (board.groups ?? [])
        .filter((g) => g.isCollapsed)
        .flatMap((g) => g.moduleIds)
    );
    const targets = board.modules.filter(
      (m) => ids.has(m.id) && !collapsedIds.has(m.id)
    );
    if (targets.length === 0) return 0;
    const minX = Math.min(...targets.map((m) => m.position.x));
    const minY = Math.min(...targets.map((m) => m.position.y));
    _canvasMultiClipboard = {
      modules: targets.map((m) => ({
        type: m.type,
        data: JSON.parse(JSON.stringify(m.data)),
        size: { ...m.size },
        color: m.color,
        shape: m.shape,
        isExpanded: m.isExpanded,
        isMinimized: m.isMinimized,
        offset: { x: m.position.x - minX, y: m.position.y - minY },
      })),
    };
    return targets.length;
  }, [board, selectedMultiIds, selectedModuleId]);

  /** 클립보드 모듈을 캔버스 중앙(또는 origin 지정 시 거기)에 붙여넣기 — 단일 undo 단위 */
  const pasteClipboardModules = useCallback(
    (origin?: { x: number; y: number }) => {
      if (!_canvasMultiClipboard || _canvasMultiClipboard.modules.length === 0) {
        return 0;
      }
      const container = containerRef.current;
      if (!container) return 0;
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      const center = screenToCanvas(cw / 2, ch / 2, viewport);
      const cat = board ? normalizeBoardCategory(board) : "memo_schedule";

      const baseEntries = _canvasMultiClipboard.modules.filter((e) =>
        isModuleTypeAllowedOnCategory(e.type, cat)
      );
      if (baseEntries.length === 0) return 0;

      const w = Math.max(...baseEntries.map((e) => e.size.width));
      const h = Math.max(...baseEntries.map((e) => e.size.height));
      const ox = origin ? origin.x : Math.round(center.x - w / 2);
      const oy = origin ? origin.y : Math.round(center.y - h / 2);

      const maxZIndex =
        board?.modules.reduce(
          (max, m) => Math.max(max, Number(m.zIndex) || 0),
          0
        ) ?? 0;

      const newIds = addModulesBatch(
        boardId,
        baseEntries.map((e, i) => ({
          type: e.type,
          position: { x: ox + e.offset.x + 18, y: oy + e.offset.y + 18 },
          size: { ...e.size },
          zIndex: maxZIndex + 1 + i,
          color: e.color,
          shape: e.shape,
          isExpanded: e.isExpanded,
          isMinimized: e.isMinimized,
          data: JSON.parse(JSON.stringify(e.data)),
        }))
      );

      if (newIds.length > 0) {
        setSelectedMultiIds(newIds);
        setSelectedModuleId(null);
      }
      return newIds.length;
    },
    [board, boardId, viewport, addModulesBatch]
  );

  /** 외부 클립보드/드롭 페이로드를 받아 적절한 모듈을 만든다 */
  const createModuleFromPayload = useCallback(
    async (payload: {
      file?: File | null;
      text?: string | null;
      url?: string | null;
      canvasPos?: { x: number; y: number };
    }) => {
      if (!board) return false;
      const cat = normalizeBoardCategory(board);
      const container = containerRef.current;
      if (!container) return false;
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      const pos =
        payload.canvasPos ?? screenToCanvas(cw / 2, ch / 2, viewport);

      const file = payload.file ?? null;
      if (file && file.type.startsWith("image/")) {
        if (!isModuleTypeAllowedOnCategory("image", cat)) {
          setArrangeFlash("이 보드에는 이미지 모듈을 추가할 수 없어요");
          return false;
        }
        try {
          const src = await fileToDataUrl(file);
          onAddModule("image", {
            x: Math.round(pos.x - 130),
            y: Math.round(pos.y - 90),
          });
          const latest = useCanvasStore
            .getState()
            .boards.find((b) => b.id === boardId);
          const last = latest?.modules?.[latest.modules.length - 1];
          if (last?.type === "image") {
            updateModule(boardId, last.id, {
              data: { ...(last.data as ImageData), src },
            });
          }
          setArrangeFlash("붙여넣은 이미지로 새 카드를 만들었어요");
          return true;
        } catch (err) {
          console.warn("[MindCanvas] 이미지 붙여넣기 실패", err);
          return false;
        }
      }

      const text = payload.text?.trim() ?? "";
      const url =
        payload.url ?? (text && isWholeStringSingleUrl(text) ? text : null);

      if (url) {
        if (!isModuleTypeAllowedOnCategory("link", cat)) {
          setArrangeFlash("이 보드에는 링크 모듈을 추가할 수 없어요");
          return false;
        }
        onAddModule("link", {
          x: Math.round(pos.x - 130),
          y: Math.round(pos.y - 30),
        });
        const latest = useCanvasStore
          .getState()
          .boards.find((b) => b.id === boardId);
        const last = latest?.modules?.[latest.modules.length - 1];
        if (last?.type === "link") {
          updateModule(boardId, last.id, {
            data: { ...(last.data as LinkData), url },
          });
          void fetchOGMeta(url).then((meta) => {
            const cur = useCanvasStore
              .getState()
              .boards.find((b) => b.id === boardId)
              ?.modules.find((m) => m.id === last.id);
            if (!cur) return;
            updateModule(boardId, last.id, {
              data: {
                ...(cur.data as LinkData),
                url,
                title: meta.title || (cur.data as LinkData).title || "",
                description: meta.description || "",
                favicon: meta.favicon || "",
                thumbnail: meta.thumbnail || "",
              },
            });
          });
        }
        setArrangeFlash("링크 카드를 만들었어요 (자동으로 미리보기 가져오는 중)");
        return true;
      }

      if (text) {
        if (!isModuleTypeAllowedOnCategory("memo", cat)) {
          setArrangeFlash("이 보드에는 메모 모듈을 추가할 수 없어요");
          return false;
        }
        onAddModule("memo", {
          x: Math.round(pos.x - 130),
          y: Math.round(pos.y - 60),
        });
        const latest = useCanvasStore
          .getState()
          .boards.find((b) => b.id === boardId);
        const last = latest?.modules?.[latest.modules.length - 1];
        if (last?.type === "memo") {
          const html = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\n/g, "<br>");
          updateModule(boardId, last.id, {
            data: { ...(last.data as MemoData), content: html },
          });
        }
        setArrangeFlash("붙여넣은 텍스트로 메모를 만들었어요");
        return true;
      }
      return false;
    },
    [board, boardId, viewport, onAddModule, updateModule]
  );

  /** 여러 이미지 파일을 받아 단일 이미지 모듈에 모두 추가 */
  const createImageModuleFromFiles = useCallback(
    async (files: File[], canvasPos?: { x: number; y: number }) => {
      if (!board || files.length === 0) return false;
      const cat = normalizeBoardCategory(board);
      if (!isModuleTypeAllowedOnCategory("image", cat)) {
        setArrangeFlash("이 보드에는 이미지 모듈을 추가할 수 없어요");
        return false;
      }
      const container = containerRef.current;
      if (!container) return false;
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      const pos =
        canvasPos ?? screenToCanvas(cw / 2, ch / 2, viewport);

      try {
        const urls = await Promise.all(files.map(fileToDataUrl));
        onAddModule("image", {
          x: Math.round(pos.x - 130),
          y: Math.round(pos.y - 90),
        });
        const latest = useCanvasStore
          .getState()
          .boards.find((b) => b.id === boardId);
        const last = latest?.modules?.[latest.modules.length - 1];
        if (last?.type === "image") {
          updateModule(boardId, last.id, {
            data: {
              ...(last.data as ImageData),
              src: urls[0],
              srcs: urls.length > 1 ? urls : undefined,
            },
          });
        }
        setArrangeFlash(
          `${files.length}개 이미지를 한 카드에 추가했어요`
        );
        return true;
      } catch (err) {
        console.warn("[MindCanvas] 다중 이미지 드롭 실패", err);
        return false;
      }
    },
    [board, boardId, viewport, onAddModule, updateModule]
  );

  // ── 키보드 단축키 ────────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const active = document.activeElement;
      const isTyping =
        active &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          (active as HTMLElement).isContentEditable);

      if (e.key === "Escape") {
        if (mergeOrderMode) {
          setMergeOrderMode(false);
          setMergeOrderIds([]);
          return;
        }
        cancelConnecting();
        setSelectedModuleId(null);
        setLassoMode(false);
        setLasso(null);
        setSelectedMultiIds([]);
        selectionLassoRef.current = null;
        setSelectionLasso(null);
        return;
      }

      // Ctrl+Z: 실행취소
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !isTyping) {
        e.preventDefault();
        undo();
        return;
      }

      // 모듈 내부(예: ImageModule 포커스)에서는 모듈 자체 동작 우선 — 캔버스 단축키 양보
      const focusInsideModule =
        active instanceof Element &&
        !!active.closest("[data-module-wrapper-id]");

      // Ctrl+C: 선택한 모듈을 캔버스 클립보드에 복사 (다중 포함)
      if ((e.ctrlKey || e.metaKey) && e.key === "c" && !isTyping && !focusInsideModule) {
        const count = copySelectedModules();
        if (count > 0) {
          e.preventDefault();
          setArrangeFlash(`모듈 ${count}개를 복사했어요 — Ctrl+V로 붙여넣기`);
        }
        return;
      }

      // Ctrl+V: 캔버스 클립보드에서 붙여넣기 (외부 클립보드는 onPaste에서 처리)
      if ((e.ctrlKey || e.metaKey) && e.key === "v" && !isTyping && !focusInsideModule) {
        if (_canvasMultiClipboard && _canvasMultiClipboard.modules.length > 0) {
          const n = pasteClipboardModules();
          if (n > 0) {
            e.preventDefault();
            setArrangeFlash(`모듈 ${n}개를 붙여넣었어요`);
          }
        }
        return;
      }

      if ((e.key === "Delete" || e.key === "Backspace") && !isTyping) {
        if (selectedMultiIds.length > 0) {
          if (window.confirm(`선택한 ${selectedMultiIds.length}개 모듈을 삭제하시겠습니까?`)) {
            selectedMultiIds.forEach((id) => removeModule(boardId, id));
            setSelectedMultiIds([]);
          }
        } else if (selectedModuleId) {
          if (window.confirm("선택한 모듈을 삭제하시겠습니까?")) {
            removeModule(boardId, selectedModuleId);
            setSelectedModuleId(null);
          }
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    selectedModuleId,
    selectedMultiIds,
    boardId,
    cancelConnecting,
    removeModule,
    undo,
    copySelectedModules,
    pasteClipboardModules,
    mergeOrderMode,
  ]);

  // ── 외부 클립보드 붙여넣기 (이미지·URL·텍스트) ─────────────────
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const active = document.activeElement;
      const isTyping =
        active &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          (active as HTMLElement).isContentEditable);
      if (isTyping) return; // 입력 필드 안에서는 기본 붙여넣기 유지
      // 모듈 내부(ImageModule 등)에서 자체 onPaste를 처리한 경우 캔버스는 양보
      if (active instanceof Element && active.closest("[data-module-wrapper-id]"))
        return;
      const target = e.target;
      if (target instanceof Element && target.closest("[data-module-wrapper-id]"))
        return;
      if (!board) return;
      const cd = e.clipboardData;
      if (!cd) return;

      // 1) 이미지 파일 우선
      const file = getImageFileFromClipboardEvent({ clipboardData: cd });
      if (file) {
        e.preventDefault();
        void createModuleFromPayload({ file });
        return;
      }

      // 2) URL (text/uri-list 또는 텍스트 전체가 URL)
      const uriList = cd.getData("text/uri-list");
      const plainText = cd.getData("text/plain");
      const uriCandidate =
        (uriList && uriList.split(/\r?\n/).find((l) => l && !l.startsWith("#"))) ||
        null;
      if (uriCandidate && URL_REGEX.test(uriCandidate.trim())) {
        e.preventDefault();
        void createModuleFromPayload({ url: uriCandidate.trim() });
        return;
      }

      // 3) 텍스트 전체가 단일 URL인 경우 → 링크
      if (plainText && isWholeStringSingleUrl(plainText)) {
        e.preventDefault();
        void createModuleFromPayload({ url: plainText.trim() });
        return;
      }

      // 4) 일반 텍스트 → 메모 (단, 캔버스 자체 클립보드가 있으면 그쪽이 우선되도록 그대로 둠)
      if (plainText && !_canvasMultiClipboard) {
        e.preventDefault();
        void createModuleFromPayload({ text: plainText });
        return;
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [board, createModuleFromPayload]);

  // ── 드래그 & 드롭 (이미지·URL·텍스트) ──────────────────────────
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0);

  function handleDragEnter(e: React.DragEvent) {
    if (!e.dataTransfer) return;
    const types = Array.from(e.dataTransfer.types ?? []);
    const hasUsefulPayload =
      types.includes("Files") ||
      types.includes("text/uri-list") ||
      types.includes("text/plain");
    if (!hasUsefulPayload) return;
    e.preventDefault();
    dragCounterRef.current += 1;
    setIsDragOver(true);
  }

  function handleDragOver(e: React.DragEvent) {
    if (!isDragOver) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  }

  function handleDragLeave() {
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) setIsDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    if (!isDragOver) return;
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragOver(false);
    const dt = e.dataTransfer;
    if (!dt) return;
    const rect = containerRef.current?.getBoundingClientRect();
    const pos = rect
      ? screenToCanvas(e.clientX - rect.left, e.clientY - rect.top, viewport)
      : undefined;

    if (dt.files && dt.files.length > 0) {
      const imageFiles = Array.from(dt.files).filter((f) =>
        f.type.startsWith("image/")
      );
      if (imageFiles.length > 1) {
        // 여러 이미지 → 하나의 이미지 모듈에 모두 누적
        void createImageModuleFromFiles(imageFiles, pos);
        return;
      }
      if (imageFiles.length === 1) {
        void createModuleFromPayload({ file: imageFiles[0], canvasPos: pos });
        return;
      }
    }
    const uriList = dt.getData("text/uri-list");
    const candidate =
      (uriList && uriList.split(/\r?\n/).find((l) => l && !l.startsWith("#"))) ||
      null;
    if (candidate && URL_REGEX.test(candidate.trim())) {
      void createModuleFromPayload({ url: candidate.trim(), canvasPos: pos });
      return;
    }
    const text = dt.getData("text/plain");
    if (text) {
      if (isWholeStringSingleUrl(text)) {
        void createModuleFromPayload({ url: text.trim(), canvasPos: pos });
      } else {
        void createModuleFromPayload({ text, canvasPos: pos });
      }
    }
  }

  // ── 커넥션 프리뷰 포인터 이동 ───────────────────────────────────
  function handlePointerMove(e: React.PointerEvent) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    if (connectionMode === "connecting") {
      updatePreviewPos(screenToCanvas(e.clientX - rect.left, e.clientY - rect.top, viewport));
    }
    if (selectionStartRef.current && selectionStartRef.current.pointerId === e.pointerId) {
      const p = screenToCanvas(e.clientX - rect.left, e.clientY - rect.top, viewport);
      const updated = { x1: selectionStartRef.current.x, y1: selectionStartRef.current.y, x2: p.x, y2: p.y };
      selectionLassoRef.current = updated;
      setSelectionLasso(updated);
    }
  }

  // ── 다중 선택 오버레이 핸들러 (data-canvas-bg 내부 z-index:0 레이어) ───
  function handleSelectionPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    e.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const p = screenToCanvas(e.clientX - rect.left, e.clientY - rect.top, viewport);
    selectionStartRef.current = { x: p.x, y: p.y, pointerId: e.pointerId };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const initial = { x1: p.x, y1: p.y, x2: p.x, y2: p.y };
    selectionLassoRef.current = initial;
    setSelectionLasso(initial);
  }

  function handleSelectionPointerMove(e: React.PointerEvent) {
    if (!selectionStartRef.current || selectionStartRef.current.pointerId !== e.pointerId) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const p = screenToCanvas(e.clientX - rect.left, e.clientY - rect.top, viewport);
    const updated = { x1: selectionStartRef.current.x, y1: selectionStartRef.current.y, x2: p.x, y2: p.y };
    selectionLassoRef.current = updated;
    setSelectionLasso(updated);
  }

  function handleSelectionPointerUp(e: React.PointerEvent) {
    if (!selectionStartRef.current || selectionStartRef.current.pointerId !== e.pointerId) return;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);

    const lasso = selectionLassoRef.current;
    selectionStartRef.current = null;
    selectionLassoRef.current = null;
    setSelectionLasso(null);

    if (!lasso) return;
    const lx = Math.min(lasso.x1, lasso.x2);
    const ly = Math.min(lasso.y1, lasso.y2);
    const lw = Math.abs(lasso.x2 - lasso.x1);
    const lh = Math.abs(lasso.y2 - lasso.y1);

    if (lw < 10 || lh < 10) {
      setSelectedMultiIds([]);
      return;
    }

    const collapsedIds = new Set(
      (board?.groups ?? []).filter((g) => g.isCollapsed).flatMap((g) => g.moduleIds)
    );
    const hit = (board?.modules ?? []).filter((m) => {
      if (collapsedIds.has(m.id)) return false;
      const mx = m.position.x, my = m.position.y, mw = m.size.width, mh = m.size.height;
      return mx < lx + lw && mx + mw > lx && my < ly + lh && my + mh > ly;
    });
    setSelectedMultiIds(hit.map((m) => m.id));
  }

  // Shift+클릭 개별 모듈 추가/제거
  function handleShiftSelect(id: string) {
    setSelectedMultiIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    setSelectedModuleId(null);
  }

  function handleMultiDragStart() {
    if (!board) return;
    const origins = new Map<string, { x: number; y: number }>();
    selectedMultiIds.forEach((id) => {
      const m = board.modules.find((mod) => mod.id === id);
      if (m) origins.set(id, { x: m.position.x, y: m.position.y });
    });
    multiDragOriginsRef.current = origins;
  }

  function handleMultiDragMove(dx: number, dy: number) {
    multiDragOriginsRef.current.forEach((origin, id) => {
      updateModule(boardId, id, { position: { x: origin.x + dx, y: origin.y + dy } });
    });
  }

  // ── 다중 선택 일괄 동작 ────────────────────────────────────────
  function handleMultiChangeColor(color: ModuleColor) {
    if (selectedMultiIds.length === 0) return;
    pushHistory();
    selectedMultiIds.forEach((id) => updateModule(boardId, id, { color }));
  }

  function handleMultiDelete() {
    if (selectedMultiIds.length === 0) return;
    if (
      !window.confirm(
        `선택한 ${selectedMultiIds.length}개 모듈을 삭제하시겠습니까?`
      )
    )
      return;
    pushHistory();
    selectedMultiIds.forEach((id) => removeModule(boardId, id));
    setSelectedMultiIds([]);
  }

  /**
   * 선택한 메모·이미지 모듈을 하나의 새 메모(노트)로 합칩니다.
   * - 메모 content는 HTML 그대로 유지
   * - 이미지 모듈은 각 이미지를 <img> 태그로 변환해 description과 함께 추가
   * - 원본 모듈은 유지하며, 합쳐진 노트만 추가됨
   */
  function mergeIdsToNote(orderedIds: string[]) {
    if (!board) return;
    const targets = orderedIds
      .map((id) => board.modules.find((m) => m.id === id))
      .filter((m): m is Module => !!m)
      .filter((m) => m.type === "memo" || m.type === "image");
    if (targets.length < 2) return;

    function escapeHtml(s: string): string {
      return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }

    const parts: string[] = [];
    for (const m of targets) {
      const title = (m.data as { title?: string }).title?.trim();
      if (title) {
        parts.push(`<h3>${escapeHtml(title)}</h3>`);
      }
      if (m.type === "memo") {
        const content = (m.data as MemoData).content?.trim();
        if (content) parts.push(content);
      } else if (m.type === "image") {
        const imgData = m.data as ImageData;
        const srcs = getImageSrcs(imgData);
        for (const src of srcs) {
          parts.push(
            `<p><img src="${src}" alt="${escapeHtml(
              imgData.caption || title || "이미지"
            )}" /></p>`
          );
        }
        if (imgData.caption?.trim()) {
          parts.push(
            `<p><em>${escapeHtml(imgData.caption.trim())}</em></p>`
          );
        }
        if (imgData.description?.trim()) {
          parts.push(
            `<p>${escapeHtml(imgData.description.trim()).replace(
              /\n/g,
              "<br/>"
            )}</p>`
          );
        }
      }
    }
    const mergedContent = parts.join("\n");

    // 첫 번째 모듈 우측 옆에 배치
    const first = targets[0];
    const newPos = {
      x: first.position.x + first.size.width + 40,
      y: first.position.y,
    };
    const maxZ = board.modules.reduce(
      (max, m) => Math.max(max, Number(m.zIndex) || 0),
      0
    );

    pushHistory();
    const ids = addModulesBatch(boardId, [
      {
        type: "memo",
        position: newPos,
        size: { width: 320, height: 280 },
        zIndex: maxZ + 1,
        color: first.color,
        isExpanded: true,
        data: {
          title: "합친 노트",
          content: mergedContent,
          previewLines: 4,
        },
      },
    ]);
    if (ids.length > 0) {
      setSelectedMultiIds([]);
      setSelectedModuleId(ids[0]);
      setArrangeFlash(`${targets.length}개 모듈을 노트로 합쳤어요`);
    }
  }

  // ── 순서 지정 합치기 ──────────────────────────────────────────
  function startMergeOrder() {
    setSelectedMultiIds([]);
    setSelectedModuleId(null);
    setMergeOrderIds([]);
    setMergeOrderMode(true);
    setArrangeFlash("합칠 모듈을 순서대로 탭하세요");
  }
  function cancelMergeOrder() {
    setMergeOrderMode(false);
    setMergeOrderIds([]);
  }
  function pickMergeOrder(id: string) {
    const m = board?.modules.find((x) => x.id === id);
    if (!m || (m.type !== "memo" && m.type !== "image")) {
      setArrangeFlash("메모·이미지 모듈만 합칠 수 있어요");
      return;
    }
    setMergeOrderIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }
  function executeMergeOrder() {
    if (mergeOrderIds.length < 2) return;
    mergeIdsToNote([...mergeOrderIds]);
    setMergeOrderMode(false);
    setMergeOrderIds([]);
  }

  // ── 캔버스 빈 공간 클릭 ─────────────────────────────────────────
  function handleCanvasClick(e: React.MouseEvent) {
    const el = e.target as HTMLElement;
    if (el === containerRef.current || el.dataset.canvasBg) {
      cancelConnecting();
      setSelectedModuleId(null);
      setSelectedMultiIds([]);
    }
  }

  // ── 빈 캔버스 더블클릭 → 빠른 메모 생성 ────────────────────────
  function handleCanvasDoubleClick(e: React.MouseEvent) {
    if (lassoMode) return;
    const el = e.target as HTMLElement;
    if (el === containerRef.current || el.dataset.canvasBg) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const pos = screenToCanvas(
        e.clientX - rect.left,
        e.clientY - rect.top,
        viewport
      );
      const quickType =
        board && normalizeBoardCategory(board) === "thinking"
          ? "brainstorm"
          : "memo";
      onAddModule(quickType, { x: pos.x - 130, y: pos.y - 22 });
    }
  }

  // ── 줌 ──────────────────────────────────────────────────────────
  function zoomAt(factor: number, focalX?: number, focalY?: number) {
    setViewport((prev) => {
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev.zoom * factor));
      const cx = focalX ?? (containerRef.current?.clientWidth ?? 0) / 2;
      const cy = focalY ?? (containerRef.current?.clientHeight ?? 0) / 2;
      const newX = cx - (cx - prev.x) * (newZoom / prev.zoom);
      const newY = cy - (cy - prev.y) * (newZoom / prev.zoom);
      const vp = { x: newX, y: newY, zoom: newZoom };
      updateViewport(boardId, vp);
      return vp;
    });
  }

  function handleZoomIn() { zoomAt(ZOOM_STEP); }
  function handleZoomOut() { zoomAt(1 / ZOOM_STEP); }

  function handleFit() {
    const modules = board?.modules ?? [];
    if (modules.length === 0) {
      const vp = { x: 0, y: 0, zoom: 1 };
      setViewport(vp);
      updateViewport(boardId, vp);
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    const W = container.clientWidth;
    const H = container.clientHeight;
    const PADDING = 80;

    const minX = Math.min(...modules.map((m) => m.position.x));
    const minY = Math.min(...modules.map((m) => m.position.y));
    const maxX = Math.max(...modules.map((m) => m.position.x + m.size.width));
    const maxY = Math.max(...modules.map((m) => m.position.y + (m.isExpanded ? m.size.height : 68)));

    const contentW = maxX - minX;
    const contentH = maxY - minY;
    if (contentW === 0 || contentH === 0) return;

    const zoom = Math.min(
      MAX_ZOOM,
      Math.max(
        MIN_ZOOM,
        Math.min((W - PADDING * 2) / contentW, (H - PADDING * 2) / contentH)
      )
    );

    const x = (W - contentW * zoom) / 2 - minX * zoom;
    const y = (H - contentH * zoom) / 2 - minY * zoom;

    const vp = { x, y, zoom };
    setViewport(vp);
    updateViewport(boardId, vp);
  }

  // ── 자동 정렬 (⊞): 카드형 모듈 전부 대상, 연결 그래프·미연결 규칙 적용 ──
  function handleAutoLayout() {
    if (!board) return;

    const allModules = board.modules;
    if (allModules.length === 0) return;

    const collapsedGroupModuleIds = new Set(
      (board.groups ?? [])
        .filter((g) => g.isCollapsed)
        .flatMap((g) => g.moduleIds)
    );
    const visible = allModules.filter((m) => !collapsedGroupModuleIds.has(m.id));
    if (visible.length === 0) return;

    const groupedIds = new Set((board.groups ?? []).flatMap((g) => g.moduleIds));
    const container = containerRef.current;
    const cw = container?.clientWidth ?? 960;

    const next = computeMemoLikeLayout({
      modules: board.modules,
      connections: board.connections ?? [],
      collapsedModuleIds: collapsedGroupModuleIds,
      groupedModuleIds: groupedIds,
      containerWidthPx: cw,
      zoom: viewport.zoom,
    });

    if (next.size === 0) return;

    pushHistory();

    next.forEach((pos, id) => {
      updateModule(boardId, id, { position: pos });
    });
  }

  /** ▦ 정렬 메뉴 — 격자/목록/종류별/컴팩트로 위치만 일괄 재배치 + 전체 보기 줌 */
  function handleArrange(mode: ArrangeMode, sortKey: ArrangeSortKey) {
    if (!board) return;
    const container = containerRef.current;
    const cw = container?.clientWidth ?? 960;
    const ch = container?.clientHeight ?? 600;

    const collapsedGroupModuleIds = new Set(
      (board.groups ?? [])
        .filter((g) => g.isCollapsed)
        .flatMap((g) => g.moduleIds)
    );
    const groupedIds = new Set(
      (board.groups ?? []).flatMap((g) => g.moduleIds)
    );

    const result = computeArrangeLayout({
      modules: board.modules,
      collapsedModuleIds: collapsedGroupModuleIds,
      groupedModuleIds: groupedIds,
      containerWidthPx: cw,
      // 현재 zoom과 무관하게 1배 기준으로 배치 — 줌인 상태에서도 다열 격자가 나오도록.
      // 배치가 끝난 뒤 contentBox에 맞춰 자동 줌·팬으로 보여 줌.
      zoom: 1,
      mode,
      sortKey,
    });

    if (result.positions.size === 0) {
      setArrangeFlash("정렬할 모듈이 없어요");
      return;
    }

    pushHistory();
    result.positions.forEach((pos, id) => {
      updateModule(boardId, id, { position: pos });
    });

    setArrangeMode(mode);
    setArrangeSortKey(sortKey);

    // 정렬 결과 전체가 보이도록 자동 줌·팬
    const PADDING = 56;
    const cb = result.contentBox;
    if (cb.width > 0 && cb.height > 0) {
      const zoom = Math.min(
        MAX_ZOOM,
        Math.max(
          MIN_ZOOM,
          Math.min((cw - PADDING * 2) / cb.width, (ch - PADDING * 2) / cb.height)
        )
      );
      const x = (cw - cb.width * zoom) / 2 - cb.x * zoom;
      const y = PADDING - cb.y * zoom; // 위쪽 기준 정렬 (목록·격자 모두 위에서 시작)
      const vp = { x, y, zoom };
      setViewport(vp);
      updateViewport(boardId, vp);
    }

    const modeLabel =
      mode === "grid"
        ? "격자"
        : mode === "list"
          ? "목록"
          : mode === "byType"
            ? "종류별"
            : "컴팩트";
    const sortLabel =
      sortKey === "created"
        ? "만든순"
        : sortKey === "updated"
          ? "최근 수정순"
          : sortKey === "title"
            ? "제목순"
            : "종류순";
    setArrangeFlash(`${modeLabel} · ${sortLabel}으로 정렬했어요`);
  }

  /** 현재 뷰포트(화면)과 겹치는 모듈만 기준으로 줌·팬을 맞춤. 없으면 전체 보기와 동일 */
  function handleFitToView() {
    if (!board) return;
    const container = containerRef.current;
    if (!container) return;

    const W = container.clientWidth;
    const H = container.clientHeight;
    if (W <= 0 || H <= 0) return;

    const collapsedGroupModuleIds = new Set(
      (board.groups ?? [])
        .filter((g) => g.isCollapsed)
        .flatMap((g) => g.moduleIds)
    );

    const { x: vx, y: vy, zoom } = viewport;
    const viewLeft = -vx / zoom;
    const viewTop = -vy / zoom;
    const viewW = W / zoom;
    const viewH = H / zoom;
    const viewRight = viewLeft + viewW;
    const viewBottom = viewTop + viewH;

    function moduleH(m: Module) {
      return m.isExpanded ? m.size.height : 68;
    }

    const inView = board.modules.filter((m) => {
      if (collapsedGroupModuleIds.has(m.id)) return false;
      const mh = moduleH(m);
      const mx2 = m.position.x + m.size.width;
      const my2 = m.position.y + mh;
      return (
        m.position.x < viewRight &&
        mx2 > viewLeft &&
        m.position.y < viewBottom &&
        my2 > viewTop
      );
    });

    const target = inView.length > 0
      ? inView
      : board.modules.filter((m) => !collapsedGroupModuleIds.has(m.id));

    if (target.length === 0) {
      const vp = { x: 0, y: 0, zoom: 1 };
      setViewport(vp);
      updateViewport(boardId, vp);
      return;
    }

    const PADDING = 80;
    const minX = Math.min(...target.map((m) => m.position.x));
    const minY = Math.min(...target.map((m) => m.position.y));
    const maxX = Math.max(...target.map((m) => m.position.x + m.size.width));
    const maxY = Math.max(...target.map((m) => m.position.y + moduleH(m)));

    const contentW = maxX - minX;
    const contentH = maxY - minY;
    if (contentW <= 0 || contentH <= 0) return;

    const newZoom = Math.min(
      MAX_ZOOM,
      Math.max(
        MIN_ZOOM,
        Math.min((W - PADDING * 2) / contentW, (H - PADDING * 2) / contentH) * 0.92
      )
    );

    const vpX = (W - contentW * newZoom) / 2 - minX * newZoom;
    /** 하단 줌·툴바(absolute bottom) 때문에 기하 중앙보다 살짝 위가 자연스러움 */
    const fitToViewUpwardBias = Math.round(36 + H * 0.06);
    const vpY =
      (H - contentH * newZoom) / 2 - minY * newZoom - fitToViewUpwardBias;
    const vp = { x: vpX, y: vpY, zoom: newZoom };
    setViewport(vp);
    updateViewport(boardId, vp);
  }

  const visibleMemoScheduleIds = useMemo(
    () => (board ? visibleModuleIdsForCanvas(board) : null),
    [board]
  );

  const modulesForCanvas = useMemo(() => {
    if (!board) return [];
    if (!visibleMemoScheduleIds) return board.modules;
    return board.modules.filter((m) => visibleMemoScheduleIds.has(m.id));
  }, [board, visibleMemoScheduleIds]);

  const activeMapContext = useMemo(() => {
    if (!board || lassoMode) return null;
    const primaryId =
      selectedMultiIds.length > 0 ? selectedMultiIds[0] : selectedModuleId;
    if (!primaryId) return null;
    const mod = board.modules.find((m) => m.id === primaryId);
    if (
      mod?.mapTemplateBundleId &&
      mod.mapTemplateId &&
      mod.mapPivot != null
    ) {
      const chromeTitle =
        BRAINSTORM_MAP_OPTIONS.find((o) => o.id === mod.mapTemplateId)?.label ??
        mod.mapTemplateId;
      return {
        mapContextId: mod.mapTemplateBundleId,
        templateId: mod.mapTemplateId,
        chromeTitle,
        mapScale: mod.mapScale ?? 1,
      };
    }
    const grp = (board.groups ?? []).find(
      (g) => g.mapTemplateId && g.moduleIds.includes(primaryId)
    );
    if (!grp?.mapTemplateId) return null;
    return {
      mapContextId: grp.id,
      templateId: grp.mapTemplateId,
      chromeTitle: grp.name,
      mapScale: grp.mapScale ?? 1,
    };
  }, [board, lassoMode, selectedModuleId, selectedMultiIds]);

  if (!board) {
    return (
      <div
        className="flex h-full w-full flex-col items-center justify-center gap-3 px-6 text-center"
        style={{ background: "var(--background)", color: "var(--text-secondary)" }}
      >
        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          이 보드를 불러오지 못했어요
        </p>
        <p className="max-w-sm text-xs leading-relaxed">
          주제별 보드가 메모/할일로 잘못 분류된 뒤 탭만 바꾼 경우 목록이 비어 보일 수 있어요. 상단에서
          「주제별」을 다시 누르거나, 새로고침 후 사이드바에서 보드를 선택해 주세요.
        </p>
      </div>
    );
  }

  const isThinkingBoard = normalizeBoardCategory(board) === "thinking";

  // 접힌 그룹에 속한 모듈 ID 목록 (렌더링 제외)
  const collapsedModuleIds = new Set(
    (board.groups ?? [])
      .filter((g) => g.isCollapsed)
      .flatMap((g) => g.moduleIds)
  );

  return (
    <div
      ref={containerRef}
      data-canvas-container="true"
      className="relative overflow-hidden"
      style={{
        width: "100%",
        height: "100%",
        background: "var(--background)",
        touchAction: "none",
        cursor: lassoMode ? "crosshair" : undefined,
      }}
      onPointerMove={handlePointerMove}
      onClick={handleCanvasClick}
      onDoubleClick={handleCanvasDoubleClick}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* 도트 그리드 */}
      <CanvasGrid viewport={viewport} />

      {/* 연결선 SVG — 컨테이너 전체 커버 */}
      <ConnectionLayer
        boardId={boardId}
        viewport={viewport}
        visibleModuleIds={visibleMemoScheduleIds}
      />
      <ConnectionPreview boardId={boardId} viewport={viewport} />

      {/* 라소 선택 영역 표시 */}
      {lassoMode && lasso && (
        <svg
          style={{
            position: "absolute", top: 0, left: 0,
            width: "100%", height: "100%",
            overflow: "visible", pointerEvents: "none", zIndex: 30,
          }}
        >
          <g transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`}>
            <rect
              x={Math.min(lasso.x1, lasso.x2)}
              y={Math.min(lasso.y1, lasso.y2)}
              width={Math.abs(lasso.x2 - lasso.x1)}
              height={Math.abs(lasso.y2 - lasso.y1)}
              fill="var(--primary)"
              fillOpacity={0.08}
              stroke="var(--primary)"
              strokeWidth={2 / viewport.zoom}
              strokeDasharray={`${8 / viewport.zoom} ${4 / viewport.zoom}`}
              rx={4 / viewport.zoom}
            />
          </g>
        </svg>
      )}

      {/* 다중 선택 라소 */}
      {selectionLasso && (
        <svg
          style={{
            position: "absolute", top: 0, left: 0,
            width: "100%", height: "100%",
            overflow: "visible", pointerEvents: "none", zIndex: 30,
          }}
        >
          <g transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`}>
            <rect
              x={Math.min(selectionLasso.x1, selectionLasso.x2)}
              y={Math.min(selectionLasso.y1, selectionLasso.y2)}
              width={Math.abs(selectionLasso.x2 - selectionLasso.x1)}
              height={Math.abs(selectionLasso.y2 - selectionLasso.y1)}
              fill="rgba(59,130,246,0.08)"
              stroke="rgb(59,130,246)"
              strokeWidth={2 / viewport.zoom}
              strokeDasharray={`${6 / viewport.zoom} ${3 / viewport.zoom}`}
              rx={4 / viewport.zoom}
            />
          </g>
        </svg>
      )}

      {/* 라소 모드 인터랙션 오버레이 (모듈 클릭 차단) */}
      {lassoMode && (
        <div
          style={{
            position: "absolute",
            top: 0, left: 0, right: 0,
            // ZoomControls(zIndex:80)보다 낮게 → 툴바는 항상 위에 표시/클릭 가능
            // data-canvas-bg(zIndex:65)보다 위 → 라소가 모듈보다 먼저 포인터를 받음
            // 하단은 ZoomControls(줌 행 + Fit to View 행) 영역으로 비워둠
            bottom: 170,
            zIndex: 74,
            cursor: "crosshair",
            touchAction: "none",
          }}
          onPointerDown={handleLassoPointerDown}
          onPointerMove={handleLassoPointerMove}
          onPointerUp={handleLassoPointerUp}
          onPointerCancel={() => { setLasso(null); setLassoMode(false); lassoStartRef.current = null; }}
        />
      )}

      {/* 캔버스 변환 레이어 */}
      <div
        data-canvas-bg="true"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          zIndex: 65,
          transformOrigin: "0 0",
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          willChange: "transform",
        }}
      >
        {/* 다중 선택 히트 레이어 — 모듈(z-index≥1)보다 아래, 빈 캔버스 드래그 감지 */}
        {!lassoMode && connectionMode !== "connecting" && (
          <div
            style={{
              position: "absolute",
              top: -50000,
              left: -50000,
              width: 100000,
              height: 100000,
              zIndex: -1,
              touchAction: "none",
            }}
            onPointerDown={handleSelectionPointerDown}
            onPointerMove={handleSelectionPointerMove}
            onPointerUp={handleSelectionPointerUp}
            onPointerCancel={() => {
              selectionLassoRef.current = null;
              selectionStartRef.current = null;
              setSelectionLasso(null);
            }}
          />
        )}

        {/* 그룹 배경 레이어 (모듈 아래) */}
        <GroupLayer boardId={boardId} viewport={viewport} />

        {/* 모듈 — 접힌 그룹에 속한 것은 숨김 */}
        {modulesForCanvas
          .filter((m) => !collapsedModuleIds.has(m.id))
          .map((module) => (
            <ModuleCardWrapper
              key={module.id}
              module={module}
              boardId={boardId}
              viewport={viewport}
              isSelected={selectedModuleId === module.id}
              onSelect={(id) => { setSelectedModuleId(id); setSelectedMultiIds([]); }}
              onDeselect={() => setSelectedModuleId(null)}
              isMultiSelected={selectedMultiIds.includes(module.id)}
              onMultiDragStart={selectedMultiIds.includes(module.id) ? handleMultiDragStart : undefined}
              onMultiDragMove={selectedMultiIds.includes(module.id) ? handleMultiDragMove : undefined}
              onShiftSelect={handleShiftSelect}
              mergeOrderActive={mergeOrderMode}
              mergeOrderIndex={(() => {
                const i = mergeOrderIds.indexOf(module.id);
                return i >= 0 ? i + 1 : undefined;
              })()}
              onMergeOrderPick={pickMergeOrder}
            />
          ))}
      </div>

      {/* 줌 & 툴바 컨트롤 */}
      <ZoomControls
        viewport={viewport}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFit={handleFit}
        onFitToView={handleFitToView}
        onAutoLayout={handleAutoLayout}
        autoLayoutTitle={
          isThinkingBoard
            ? "생각정리 자동 정렬 — 연결·그래프 기준으로 위치만 정렬 (줌/팬은 그대로)"
            : "메모형 자동 정렬 — 위치만 정렬 (줌/팬은 그대로)"
        }
        autoLayoutAriaLabel={
          isThinkingBoard ? "생각정리 자동 정렬" : "메모형 자동 정렬"
        }
        onArrange={(anchor) => setArrangeMenuAnchor(anchor)}
        arrangeActive={arrangeMenuAnchor !== null}
        isConnecting={connectionMode === "connecting"}
        isGroupMode={lassoMode}
        onGroupMode={handleEnterGroupMode}
      />

      {arrangeMenuAnchor && (
        <ArrangeMenu
          anchorBottomLeft={arrangeMenuAnchor}
          initialMode={arrangeMode}
          initialSortKey={arrangeSortKey}
          onApply={handleArrange}
          onClose={() => setArrangeMenuAnchor(null)}
        />
      )}

      {/* 순서 지정 합치기 — 시작은 툴바 버튼, 진행 중 컨트롤만 캔버스 상단 중앙 */}
      {mergeOrderMode && (
        <MergeOrderBar
          pickedCount={mergeOrderIds.length}
          onExecute={executeMergeOrder}
          onCancel={cancelMergeOrder}
        />
      )}

      {/* 다중 선택 액션바 — 2개 이상 선택 시 캔버스 하단 중앙에 표시 */}
      {!mergeOrderMode && (
        <MultiSelectActionBar
          count={selectedMultiIds.length}
          onChangeColor={handleMultiChangeColor}
          onDelete={handleMultiDelete}
          onClear={() => setSelectedMultiIds([])}
        />
      )}

      {/* 드래그&드롭 오버레이 */}
      {isDragOver && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(99,102,241,0.10)",
            border: "3px dashed var(--primary)",
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            zIndex: 90,
          }}
        >
          <div
            style={{
              background: "var(--surface-elevated)",
              border: "1px solid var(--primary)",
              color: "var(--primary)",
              padding: "10px 18px",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              boxShadow: "var(--shadow-lg)",
            }}
          >
            ✨ 여기에 놓으면 모듈로 추가돼요 (이미지·링크·텍스트)
          </div>
        </div>
      )}

      {/* 정렬·붙여넣기 안내 토스트 */}
      {arrangeFlash && (
        <div
          role="status"
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            zIndex: 95,
            background: "var(--surface-elevated)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
            padding: "8px 14px",
            borderRadius: 10,
            boxShadow: "var(--shadow-md)",
            fontSize: 12,
            fontWeight: 500,
            maxWidth: "min(340px, 70vw)",
            pointerEvents: "none",
          }}
        >
          {arrangeFlash}
        </div>
      )}

      {activeMapContext && (
        <MapTemplateWorkspaceChrome
          templateId={activeMapContext.templateId}
          groupName={activeMapContext.chromeTitle}
          mapScale={activeMapContext.mapScale}
          onScaleIn={() =>
            scaleMapTemplateGroup(boardId, activeMapContext.mapContextId, 1.1)
          }
          onScaleOut={() =>
            scaleMapTemplateGroup(boardId, activeMapContext.mapContextId, 1 / 1.1)
          }
          onTool={(toolId) =>
            appendMapToolModule(boardId, activeMapContext.mapContextId, toolId)
          }
        />
      )}

      {/* 라소 모드 힌트 배너 */}
      {lassoMode && (
        <div
          style={{
            position: "absolute",
            top: 12,
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--primary)",
            color: "var(--primary-fg)",
            borderRadius: 8,
            padding: "7px 16px",
            fontSize: 13,
            fontWeight: 600,
            boxShadow: "var(--shadow-md)",
            whiteSpace: "nowrap",
            zIndex: 25,
            pointerEvents: "none",
          }}
        >
          📦 그룹 선택 — 묶을 모듈을 드래그로 선택하세요 &nbsp;·&nbsp; ESC 취소
        </div>
      )}

      {/* 더블클릭 힌트 (모듈 없을 때) */}
      {board.modules.length === 0 && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            textAlign: "center",
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
            빈 공간을 더블클릭하면 메모를 바로 추가할 수 있어요
          </p>
        </div>
      )}

      {/* 그룹 이름 다이얼로그 */}
      {showGroupDialog && (
        <GroupNameDialog
          moduleCount={pendingModuleIds.length}
          groupCount={(board.groups ?? []).length}
          onConfirm={handleGroupConfirm}
          onCancel={() => { setShowGroupDialog(false); setPendingModuleIds([]); setPendingBounds(null); }}
        />
      )}

      {/* 그룹 초대 다이얼로그 */}
      {pendingGroupInvite && (
        <GroupInviteDialog
          groupName={pendingGroupInvite.groupName}
          onConfirm={handleGroupInviteConfirm}
          onCancel={handleGroupInviteCancel}
        />
      )}
    </div>
  );
}
