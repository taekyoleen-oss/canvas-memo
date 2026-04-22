import type { AnchorSide } from "./geometry";
import { getBezierPath, getBezierMidpoint } from "./bezier";
import type { ConnectionPathStyle } from "@/types";

const STUB = 40;

function outward(
  pos: { x: number; y: number },
  anchor: AnchorSide,
  d: number
): { x: number; y: number } {
  switch (anchor) {
    case "top":
      return { x: pos.x, y: pos.y - d };
    case "bottom":
      return { x: pos.x, y: pos.y + d };
    case "left":
      return { x: pos.x - d, y: pos.y };
    case "right":
      return { x: pos.x + d, y: pos.y };
  }
}

export function getOrthogonalPath(
  from: { x: number; y: number },
  fromAnchor: AnchorSide,
  to: { x: number; y: number },
  toAnchor: AnchorSide
): string {
  const a = outward(from, fromAnchor, STUB);
  const b = outward(to, toAnchor, STUB);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    const midX = (a.x + b.x) / 2;
    return `M ${from.x} ${from.y} L ${a.x} ${a.y} L ${midX} ${a.y} L ${midX} ${b.y} L ${b.x} ${b.y} L ${to.x} ${to.y}`;
  }
  const midY = (a.y + b.y) / 2;
  return `M ${from.x} ${from.y} L ${a.x} ${a.y} L ${a.x} ${midY} L ${b.x} ${midY} L ${b.x} ${b.y} L ${to.x} ${to.y}`;
}

export function getOrthogonalMidpoint(
  from: { x: number; y: number },
  fromAnchor: AnchorSide,
  to: { x: number; y: number },
  toAnchor: AnchorSide
): { x: number; y: number } {
  const a = outward(from, fromAnchor, STUB);
  const b = outward(to, toAnchor, STUB);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    const midX = (a.x + b.x) / 2;
    return { x: midX, y: (a.y + b.y) / 2 };
  }
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function getStraightPath(
  from: { x: number; y: number },
  to: { x: number; y: number }
): string {
  return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
}

export function resolvePathStyle(
  pathStyle: ConnectionPathStyle | undefined
): ConnectionPathStyle {
  return pathStyle ?? "bezier";
}

export function getConnectionPathD(
  pathStyle: ConnectionPathStyle | undefined,
  from: { x: number; y: number },
  fromAnchor: AnchorSide,
  to: { x: number; y: number },
  toAnchor: AnchorSide
): string {
  const ps = resolvePathStyle(pathStyle);
  if (ps === "orthogonal") {
    return getOrthogonalPath(from, fromAnchor, to, toAnchor);
  }
  if (ps === "straight") {
    return getStraightPath(from, to);
  }
  return getBezierPath(from, fromAnchor, to, toAnchor);
}

export function getConnectionMidpoint(
  pathStyle: ConnectionPathStyle | undefined,
  from: { x: number; y: number },
  fromAnchor: AnchorSide,
  to: { x: number; y: number },
  toAnchor: AnchorSide
): { x: number; y: number } {
  const ps = resolvePathStyle(pathStyle);
  if (ps === "orthogonal") {
    return getOrthogonalMidpoint(from, fromAnchor, to, toAnchor);
  }
  if (ps === "straight") {
    return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  }
  return getBezierMidpoint(from, fromAnchor, to, toAnchor);
}
