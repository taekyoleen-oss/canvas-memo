// 로컬 캐시: 계정별 `mindcanvas_v1_u_<userId>` (lib/storage). 레거시 공용 키 `mindcanvas_v1`은 마이그레이션용.

/** 메모·일정 · 생각정리(브레인스토밍) · 주제별(노트·바이브 코딩 정리) */
export type BoardCategory = "memo_schedule" | "thinking" | "topic_notes";

export interface AppData {
  version: number;
  theme: "light" | "dark" | "system";
  boards: Board[];
  lastOpenedBoardId: string | null;
  /** 상단 탭(워크스페이스) */
  activeWorkspace?: BoardCategory;
  /** 워크스페이스별 마지막으로 연 보드 id */
  lastOpenedBoardByCategory?: Partial<Record<BoardCategory, string>>;
}

export interface Board {
  id: string; // UUID
  name: string;
  icon: string; // 이모지
  color: string; // hex
  /** 보드 종류 — 생략 시 로컬/레거시는 memo_schedule */
  category?: BoardCategory;
  /** 같은 category 안에서 사이드바 정렬 */
  sidebarOrder?: number;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  modules: Module[];
  connections: Connection[];
  groups: Group[];
  viewport: { x: number; y: number; zoom: number };
}

export type ModuleType =
  | "memo"
  | "schedule"
  | "image"
  | "link"
  | "file"
  | "table"
  | "brainstorm";

export type ModuleColor =
  | "default"
  | "yellow"
  | "pink"
  | "blue"
  | "green"
  | "purple"
  | "orange"
  | "teal";

/** 카드 외곽 — 생략 시 기존과 동일하게 둥근 사각형 */
export type ModuleShape =
  | "rectangle"
  | "rounded"
  | "ellipse"
  | "diamond"
  | "pill"
  | "circle";

/** 연결선 경로 — 생략 시 베지어 곡선 */
export type ConnectionPathStyle = "bezier" | "orthogonal" | "straight";

/** 방향 확장(화살표)으로 새 모듈 만들 때 옵션 */
export interface ExpandAdjacentModuleOptions {
  moduleShape: ModuleShape;
  templateId?: string;
  pathStyle?: ConnectionPathStyle;
}

export interface Module {
  id: string;
  type: ModuleType;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
  color: ModuleColor;
  /** 생략 시 `rounded`와 동일 */
  shape?: ModuleShape;
  isExpanded: boolean;
  isMinimized?: boolean; // 제목만 표시하는 최소화 상태
  createdAt: string;
  updatedAt: string;
  data: MemoData | ScheduleData | ImageData | LinkData | FileData | TableData | BrainstormData;
}

export interface MemoData {
  title: string;
  content: string; // 마크다운
  previewLines: number; // 기본 2
}

export interface ScheduleData {
  title: string;
  items: ScheduleItem[];
  previewCount: number; // 기본 3
}

export type BrainstormItemStatus = "raw" | "refined" | "archived";

/** 캔버스에 삽입하는 맵 템플릿 종류(여러 모듈 + 연결) */
export type BrainstormMapType =
  | "brainstorm"
  | "process_map"
  | "mind_map"
  | "workflow_map"
  | "knowledge_map"
  | "flowchart"
  | "concept_map"
  | "strategy_map"
  | "visual_map"
  | "swot_map"
  | "mental_map";

/** 카드 안 아이디어 간 연결(캔버스 Connection과 별개) */
export interface BrainstormItemLink {
  id: string;
  fromItemId: string;
  toItemId: string;
  label?: string;
}

/** 빠른 아이디어 나열(일정 모듈과 유사한 UX, 완료 체크 없음) */
export interface BrainstormItem {
  id: string;
  text: string;
  status?: BrainstormItemStatus;
}

export interface BrainstormData {
  title: string;
  items: BrainstormItem[];
  previewCount: number; // 접힌 상태에서 보여 줄 아이디어 개수, 기본 4
  /** 항목 간 연결(생각정리 전용) */
  itemLinks?: BrainstormItemLink[];
}

export interface ScheduleItem {
  id: string;
  text: string;
  dueDate: string | null;
  done: boolean;
}

export interface ImageData {
  title: string;
  src: string; // base64
  caption: string;
}

export interface LinkData {
  url: string;
  title: string;
  description: string;
  favicon: string;
  thumbnail: string;
}

export interface FileData {
  title: string;
  fileName: string;
  fileType: string; // MIME type
  fileSize: number;
  src: string; // base64 data URL
}

/** 행·열 격자 표 — cells는 행 우선(row-major), 길이 = rowCount * colCount */
export interface TableData {
  title: string;
  rowCount: number;
  colCount: number;
  cells: string[];
}

export interface Connection {
  id: string;
  fromModuleId: string;
  toModuleId: string;
  fromAnchor: "top" | "right" | "bottom" | "left";
  toAnchor: "top" | "right" | "bottom" | "left";
  label: string;
  style: "solid" | "dashed";
  color: string;
  /** 생략 시 `bezier` */
  pathStyle?: ConnectionPathStyle;
}

export type GroupColor =
  | "yellow"
  | "pink"
  | "teal"
  | "blue"
  | "purple"
  | "orange";

export interface Group {
  id: string;
  name: string;
  moduleIds: string[];
  position: { x: number; y: number };
  size: { width: number; height: number };
  color: GroupColor;
  isCollapsed: boolean;
  createdAt: string;
  updatedAt: string;
  /** 맵 템플릿으로 한 번에 넣은 그룹일 때 */
  mapTemplateId?: BrainstormMapType;
  /** 균일 확대·축소 기준점(캔버스 좌표) */
  mapPivot?: { x: number; y: number };
  /** 누적 스케일(표시용), 기본 1 */
  mapScale?: number;
}
