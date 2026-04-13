// localStorage key: "mindcanvas_v1"

export interface AppData {
  version: number;
  theme: "light" | "dark" | "system";
  boards: Board[];
  lastOpenedBoardId: string | null;
}

export interface Board {
  id: string; // UUID
  name: string;
  icon: string; // 이모지
  color: string; // hex
  createdAt: string; // ISO
  updatedAt: string; // ISO
  modules: Module[];
  connections: Connection[];
  groups: Group[];
  viewport: { x: number; y: number; zoom: number };
}

export type ModuleType = "memo" | "schedule" | "image" | "link";

export type ModuleColor =
  | "default"
  | "yellow"
  | "pink"
  | "blue"
  | "green"
  | "purple"
  | "orange"
  | "teal";

export interface Module {
  id: string;
  type: ModuleType;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
  color: ModuleColor;
  isExpanded: boolean;
  createdAt: string;
  updatedAt: string;
  data: MemoData | ScheduleData | ImageData | LinkData;
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

export interface Connection {
  id: string;
  fromModuleId: string;
  toModuleId: string;
  fromAnchor: "top" | "right" | "bottom" | "left";
  toAnchor: "top" | "right" | "bottom" | "left";
  label: string;
  style: "solid" | "dashed";
  color: string;
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
}
