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

const buildings = [
  { id: "terminal", label: "cli", subtitle: "CLI Tool", img: "/city-terminal.png", x: -400, y: 50 },
  { id: "hq", label: "monty", subtitle: "Next.js App", img: "/city-hq.webm", x: 0, y: 0 },
  { id: "supabase", label: "supabase", subtitle: "Backend & DB", img: "/city-supabase.png", x: 400, y: 50 },
  { id: "docs", label: "docs", subtitle: "Documentation", img: "/city-docs.png", x: 0, y: 350 },
];

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.5;

export function CodeMapApp() {
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 0.75 });
  const dragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  const copyInstall = async () => {
    await navigator.clipboard.writeText(INSTALL_CMD);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.92 : 1.08;
    setCamera((prev) => ({
      ...prev,
      zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev.zoom * delta)),
    }));
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    dragging.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    setCamera((prev) => ({
      ...prev,
      x: prev.x + dx / prev.zoom,
      y: prev.y + dy / prev.zoom,
    }));
  }, []);

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

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
        className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing select-none"
        // onPointerDown={handlePointerDown}
        // onPointerMove={handlePointerMove}
        // onPointerUp={handlePointerUp}
        // onPointerLeave={handlePointerUp}
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
              {Array.from({ length: 21 }, (_, i) => {
                const t = i / 20;
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
              {Array.from({ length: 21 }, (_, i) => {
                const t = i / 20;
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
          </svg>

          {buildings.map((b) => {
            const size = b.id === "hq" ? 360 : 240;
            const isVideo = b.img.endsWith(".webm");
            return (
              <div
                key={b.id}
                className="absolute group"
                style={{
                  left: 1000 + b.x,
                  top: 1000 + b.y,
                  transform: "translate(-50%, -50%)",
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
                    className="drop-shadow-xl pointer-events-auto building-asset"
                    draggable={false}
                  />
                ) : (
                  <img
                    src={b.img}
                    alt={b.label}
                    width={size}
                    height={size}
                    className="drop-shadow-xl pointer-events-auto building-asset"
                    draggable={false}
                  />
                )}
              </div>
            );
          })}

          {/* Walking character */}
          <div
            className="absolute"
            style={{ left: 1000 - 900, top: 1000 - 525, width: 1800, height: 1050 }}
          >
            <WalkingCharacter />
          </div>
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


