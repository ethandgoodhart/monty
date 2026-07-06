"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { MontyLogo, GitHubIcon } from "@/app/components/icons";

const WalkingCharacter = dynamic(
  () => import("./walking-character").then((m) => ({ default: m.WalkingCharacter })),
  { ssr: false }
);

const INSTALL_CMD = "npx monty-cli install";

const BUILDING_DEFS = [
  { id: "terminal", label: "cli", subtitle: "CLI Tool", img: "/city-terminal.png", gridSize: 9 },
  { id: "hq", label: "monty", subtitle: "Next.js App", img: "/city-hq.webm", gridSize: 12 },
  { id: "supabase", label: "supabase", subtitle: "Backend & DB", img: "/city-supabase.png", gridSize: 9 },
  { id: "docs", label: "docs", subtitle: "Documentation", img: "/city-docs.png", gridSize: 9 },
];

const INITIAL_POSITIONS: Record<string, { x: number; y: number }> = {
  terminal: { x: -400, y: 50 },
  hq: { x: 0, y: 0 },
  supabase: { x: 400, y: 50 },
  docs: { x: 0, y: 350 },
};

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.5;

const GRID_N = 60;
const ISO_OX = 900, ISO_OY = 30;
const AX = 850 / 60, AY = 495 / 60;
const BX = -850 / 60, BY = 495 / 60;
const SVG_LEFT = 100, SVG_TOP = 475;

function worldToGrid(wx: number, wy: number) {
  const rx = wx - SVG_LEFT - ISO_OX;
  const ry = wy - SVG_TOP - ISO_OY;
  return { u: (ry / AY + rx / AX) / 2, v: (ry / AY - rx / AX) / 2 };
}

function cellPath(u: number, v: number) {
  const px = (du: number, dv: number) =>
    `${ISO_OX + (u + du) * AX + (v + dv) * BX},${ISO_OY + (u + du) * AY + (v + dv) * BY}`;
  return `M${px(0, 0)}L${px(1, 0)}L${px(1, 1)}L${px(0, 1)}Z`;
}

function getFootprint(wx: number, wy: number, size: number) {
  const { u, v } = worldToGrid(wx, wy);
  const su = Math.round(u - size / 2);
  const sv = Math.round(v - size / 2);
  const cells: { u: number; v: number }[] = [];
  for (let du = 0; du < size; du++)
    for (let dv = 0; dv < size; dv++) {
      const cu = su + du, cv = sv + dv;
      if (cu >= 0 && cu < GRID_N && cv >= 0 && cv < GRID_N)
        cells.push({ u: cu, v: cv });
    }
  return cells;
}

function screenToWorld(sx: number, sy: number, rect: DOMRect, cam: { x: number; y: number; zoom: number }) {
  return {
    x: (sx - rect.left - rect.width / 2) / cam.zoom - cam.x + 1000,
    y: (sy - rect.top - rect.height / 2) / cam.zoom - cam.y + 1000,
  };
}

export function CodeMapApp() {
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 0.75 });
  const [positions, setPositions] = useState(INITIAL_POSITIONS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDraggingBuilding, setIsDraggingBuilding] = useState(false);

  const panning = useRef(false);
  const dragInfo = useRef<{ id: string; ox: number; oy: number; startX: number; startY: number } | null>(null);
  const lastMouse = useRef({ x: 0, y: 0 });
  const camRef = useRef(camera);
  camRef.current = camera;
  const posRef = useRef(positions);
  posRef.current = positions;

  const copyInstall = async () => {
    await navigator.clipboard.writeText(INSTALL_CMD);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    setCamera((p) => ({ ...p, zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, p.zoom * factor)) }));
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      const bEl = (e.target as HTMLElement).closest("[data-building-id]");

      if (bEl) {
        const id = bEl.getAttribute("data-building-id")!;
        setSelectedId(id);
        setIsDraggingBuilding(true);
        const rect = containerRef.current!.getBoundingClientRect();
        const w = screenToWorld(e.clientX, e.clientY, rect, camRef.current);
        const pos = posRef.current[id];
        dragInfo.current = { id, ox: w.x - (1000 + pos.x), oy: w.y - (1000 + pos.y), startX: pos.x, startY: pos.y };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        return;
      }

      if (selectedId) {
        setSelectedId(null);
        setIsDraggingBuilding(false);
        return;
      }

      panning.current = true;
      lastMouse.current = { x: e.clientX, y: e.clientY };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [selectedId]
  );

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (dragInfo.current) {
      const rect = containerRef.current!.getBoundingClientRect();
      const w = screenToWorld(e.clientX, e.clientY, rect, camRef.current);
      const d = dragInfo.current;
      setPositions((p) => ({ ...p, [d.id]: { x: w.x - d.ox - 1000, y: w.y - d.oy - 1000 } }));
      return;
    }
    if (!panning.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    setCamera((p) => ({ ...p, x: p.x + dx / p.zoom, y: p.y + dy / p.zoom }));
  }, []);

  const handlePointerUp = useCallback(() => {
    if (dragInfo.current) {
      const d = dragInfo.current;
      const def = BUILDING_DEFS.find((b) => b.id === d.id)!;
      const pos = posRef.current[d.id];
      const cells = getFootprint(1000 + pos.x, 1000 + pos.y, def.gridSize);
      const collides = BUILDING_DEFS.some((b) => {
        if (b.id === d.id) return false;
        const op = posRef.current[b.id];
        const oc = getFootprint(1000 + op.x, 1000 + op.y, b.gridSize);
        const set = new Set(oc.map((c) => `${c.u},${c.v}`));
        return cells.some((c) => set.has(`${c.u},${c.v}`));
      });
      if (collides) {
        setPositions((p) => ({ ...p, [d.id]: { x: d.startX, y: d.startY } }));
      }
    }
    dragInfo.current = null;
    panning.current = false;
    setIsDraggingBuilding(false);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const selectedDef = selectedId ? BUILDING_DEFS.find((b) => b.id === selectedId) : null;
  const highlightCells = selectedDef
    ? getFootprint(1000 + positions[selectedId!].x, 1000 + positions[selectedId!].y, selectedDef.gridSize)
    : [];

  const isColliding = selectedDef
    ? BUILDING_DEFS.some((b) => {
        if (b.id === selectedId) return false;
        const op = positions[b.id];
        const oc = getFootprint(1000 + op.x, 1000 + op.y, b.gridSize);
        const set = new Set(oc.map((c) => `${c.u},${c.v}`));
        return highlightCells.some((c) => set.has(`${c.u},${c.v}`));
      })
    : false;

  return (
    <main className="h-screen flex flex-col bg-white text-[#111] overflow-hidden">
      <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-black/[0.06] shrink-0">
        <nav className="mx-auto flex h-[5.25rem] max-w-[1280px] items-center gap-4 px-6 lg:px-10">
          <div className="flex flex-1 items-center gap-6">
            <Link href="/" className="flex items-center"><MontyLogo /></Link>
            <div className="hidden sm:flex items-center gap-4 text-sm ml-2">
              <Link href="/feed" className="text-[#999] hover:text-[#111] font-medium transition-colors">Live</Link>
              <Link href="/leaderboard" className="text-[#999] hover:text-[#111] font-medium transition-colors">Tokens</Link>
              <Link href="/code" className="text-[#111] font-medium">Code</Link>
            </div>
          </div>
          <div className="flex flex-1 items-center justify-end gap-5">
            <a href="https://github.com/ethandgoodhart/monty" className="hidden items-center gap-2 rounded-lg px-3 text-sm font-medium text-[#111] hover:bg-black/5 lg:inline-flex h-[35px]">
              <GitHubIcon />
            </a>
            <button
              onClick={copyInstall}
              className="inline-flex shrink-0 items-center text-sm font-medium hover:opacity-85 transition-opacity h-[35px] bg-[#111] text-white rounded-[10px] px-3 cursor-pointer"
            >
              {copied ? "Copied!" : "Install"}
            </button>
          </div>
        </nav>
      </header>

      <div
        ref={containerRef}
        className={`flex-1 relative overflow-hidden select-none ${
          isDraggingBuilding
            ? "cursor-grabbing"
            : selectedId
              ? "cursor-default"
              : "cursor-grab active:cursor-grabbing"
        }`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {/* World layer */}
        <div
          className="absolute"
          style={{
            width: 2000,
            height: 2000,
            left: "50%",
            top: "50%",
            transform: `translate(-50%, -50%) translate(${camera.x * camera.zoom}px, ${camera.y * camera.zoom}px) scale(${camera.zoom})`,
            transformOrigin: "center center",
          }}
        >
          {/* Isometric ground plane */}
          <svg
            className="absolute pointer-events-none"
            style={{ left: 1000 - 900, top: 1000 - 525, width: 1800, height: 1050 }}
            viewBox="0 0 1800 1050"
          >
            <defs>
              <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fafafa" />
                <stop offset="100%" stopColor="#f3f3f5" />
              </linearGradient>
              <filter id="groundShadow">
                <feDropShadow dx="0" dy="6" stdDeviation="12" floodColor="#00000011" />
              </filter>
              <clipPath id="diamondClip">
                <path d="M870,44 Q900,30 930,44 L1736,519 Q1750,525 1736,531 L930,1006 Q900,1020 870,1006 L64,531 Q50,525 64,519 Z" />
              </clipPath>
            </defs>
            <path
              d="M870,44 Q900,30 930,44 L1736,519 Q1750,525 1736,531 L930,1006 Q900,1020 870,1006 L64,531 Q50,525 64,519 Z"
              fill="url(#ground)"
              filter="url(#groundShadow)"
            />
            {/* Isometric grid lines */}
            <g clipPath="url(#diamondClip)" stroke="#e4e4e8" strokeWidth="0.8">
              {Array.from({ length: 61 }, (_, i) => {
                const t = i / 60;
                return (
                  <line
                    key={`a${i}`}
                    x1={900 - 850 * t}
                    y1={30 + 495 * t}
                    x2={1750 - 850 * t}
                    y2={525 + 495 * t}
                  />
                );
              })}
              {Array.from({ length: 61 }, (_, i) => {
                const t = i / 60;
                return (
                  <line
                    key={`b${i}`}
                    x1={900 + 850 * t}
                    y1={30 + 495 * t}
                    x2={50 + 850 * t}
                    y2={525 + 495 * t}
                  />
                );
              })}
            </g>
            <path
              d="M870,44 Q900,30 930,44 L1736,519 Q1750,525 1736,531 L930,1006 Q900,1020 870,1006 L64,531 Q50,525 64,519 Z"
              fill="none"
              stroke="#e0e0e6"
              strokeWidth="1.5"
            />

            {/* Highlighted grid cells under selected building */}
            {highlightCells.map(({ u, v }) => (
              <path
                key={`hl-${u}-${v}`}
                d={cellPath(u, v)}
                fill={isColliding ? "rgba(239, 68, 68, 0.3)" : "rgba(34, 197, 94, 0.25)"}
                stroke={isColliding ? "rgba(239, 68, 68, 0.6)" : "rgba(34, 197, 94, 0.5)"}
                strokeWidth="1.5"
              />
            ))}
          </svg>

          {BUILDING_DEFS.map((b) => {
            const pos = positions[b.id];
            const size = b.id === "hq" ? 120 : 80;
            const isVideo = b.img.endsWith(".webm");
            const isSelected = selectedId === b.id;
            return (
              <div
                key={b.id}
                data-building-id={b.id}
                className="absolute"
                style={{
                  left: 1000 + pos.x,
                  top: 1000 + pos.y,
                  transform: `translate(-50%, -50%)${isSelected ? " scale(1.05)" : ""}`,
                  transition: "transform 0.15s ease, filter 0.15s ease",
                  cursor: isSelected ? "grab" : "pointer",
                  zIndex: isSelected ? 10 : 1,
                  filter: isSelected
                    ? "drop-shadow(0 8px 24px rgba(0,0,0,0.15))"
                    : undefined,
                }}
              >
                {isVideo ? (
                  <video
                    src={b.img}
                    autoPlay
                    loop
                    muted
                    playsInline
                    width={size}
                    height={size}
                    className="drop-shadow-xl pointer-events-auto"
                    draggable={false}
                  />
                ) : (
                  <img
                    src={b.img}
                    alt={b.label}
                    width={size}
                    height={size}
                    className="drop-shadow-xl pointer-events-auto"
                    draggable={false}
                  />
                )}
              </div>
            );
          })}

          {/* Walking character — temporarily disabled
          <div
            className="absolute"
            style={{ left: 1000 - 900, top: 1000 - 525, width: 1800, height: 1050 }}
          >
            <WalkingCharacter />
          </div>
          */}
        </div>

        {/* Bottom commit bar */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-6 bg-white/80 backdrop-blur-md rounded-xl shadow-sm border border-black/[0.06] px-6 py-3">
          <div className="flex items-center gap-2 text-sm text-[#666]">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-[#999]">
              <rect x="2" y="2" width="12" height="12" rx="2" />
              <path d="M5 5h6M5 8h4M5 11h5" />
            </svg>
            <span className="font-medium">Latest Commit</span>
            <code className="font-mono text-xs bg-[#f0f0f0] px-1.5 py-0.5 rounded">913a640</code>
            <span className="text-emerald-500">&#10003;</span>
          </div>
          <div className="w-px h-4 bg-[#e0e0e0]" />
          <div className="flex items-center gap-1.5 text-sm text-[#666]">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" className="text-[#999]">
              <circle cx="8" cy="8" r="6" />
              <path d="M8 4.5V8l2.5 1.5" strokeLinecap="round" />
            </svg>
            <span>4 Commits</span>
          </div>
        </div>

        {/* Zoom controls */}
        <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-1">
          <button
            onClick={() => setCamera((p) => ({ ...p, zoom: Math.min(MAX_ZOOM, p.zoom * 1.25) }))}
            className="size-9 bg-white/90 backdrop-blur-md rounded-lg shadow-sm border border-black/[0.06] flex items-center justify-center text-lg font-medium text-[#555] hover:bg-white transition-colors cursor-pointer"
          >
            +
          </button>
          <button
            onClick={() => setCamera((p) => ({ ...p, zoom: Math.max(MIN_ZOOM, p.zoom * 0.8) }))}
            className="size-9 bg-white/90 backdrop-blur-md rounded-lg shadow-sm border border-black/[0.06] flex items-center justify-center text-lg font-medium text-[#555] hover:bg-white transition-colors cursor-pointer"
          >
            &minus;
          </button>
          <button
            onClick={() => setCamera({ x: 0, y: 0, zoom: 0.75 })}
            className="size-9 bg-white/90 backdrop-blur-md rounded-lg shadow-sm border border-black/[0.06] flex items-center justify-center text-[11px] font-medium text-[#555] hover:bg-white transition-colors cursor-pointer"
          >
            Fit
          </button>
        </div>
      </div>
    </main>
  );
}
