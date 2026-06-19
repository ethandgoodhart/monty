"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MontyLogo, GitHubIcon, CopyIcon, CheckIcon } from "./icons";
import { getBrowserSupabase } from "@/app/lib/supabase";
import { PROMPT_EVENTS_TABLE, type PromptEvent, type PromptSource } from "@/app/lib/prompt-events";
import { computeEventCost, formatCost, formatTokens } from "@/app/lib/pricing";

const TEAM_ID = process.env.NEXT_PUBLIC_MONTY_TEAM_ID || "default";
const INSTALL_CMD = "npx monty-cli install";
const sourceLabels: Record<PromptSource, string> = {
  claude: "Claude Code",
  codex: "Codex CLI",
  manual: "Manual",
  test: "Test",
};

export function LiveFeedApp() {
  const [events, setEvents] = useState<PromptEvent[]>([]);
  const [sourceFilter, setSourceFilter] = useState<PromptSource | "all">("all");
  const [status, setStatus] = useState("Connecting");
  const [copied, setCopied] = useState(false);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let closed = false;
    let initialLoadDone = false;
    const seen = new Set<string>();

    const addEvent = (event: PromptEvent, isRealtime = false) => {
      if (seen.has(event.id)) return;
      seen.add(event.id);
      if (isRealtime) {
        setFreshIds((prev) => new Set(prev).add(event.id));
        const hasTokens = (event.input_tokens || 0) + (event.output_tokens || 0) > 0;
        if (!hasTokens) {
          setRunningIds((prev) => new Set(prev).add(event.id));
          setTimeout(() => {
            setRunningIds((prev) => {
              if (!prev.has(event.id)) return prev;
              const next = new Set(prev);
              next.delete(event.id);
              return next;
            });
          }, 10 * 60_000);
        }
        setTimeout(() => {
          setFreshIds((prev) => {
            const next = new Set(prev);
            next.delete(event.id);
            return next;
          });
        }, 4000);
      }
      setEvents((current) =>
        [event, ...current.filter((item) => item.id !== event.id)]
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 100),
      );
    };

    const updateEvent = (updated: PromptEvent) => {
      setEvents((current) =>
        current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)),
      );
      setRunningIds((prev) => {
        if (!prev.has(updated.id)) return prev;
        const next = new Set(prev);
        next.delete(updated.id);
        return next;
      });
    };

    fetch(`/api/events?team=${encodeURIComponent(TEAM_ID)}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { events?: PromptEvent[] }) => {
        if (closed) return;
        (data.events ?? []).reverse().forEach((e) => addEvent(e, false));
        initialLoadDone = true;
        setStatus("Live");
      })
      .catch(() => setStatus("Waiting for events"));

    const supabase = getBrowserSupabase();

    let source: EventSource | null = null;
    if (!supabase) {
      source = new EventSource(`/api/events/stream?team=${encodeURIComponent(TEAM_ID)}`);
      source.addEventListener("prompt", (message) => {
        addEvent(JSON.parse((message as MessageEvent).data) as PromptEvent, initialLoadDone);
        setStatus("Live");
      });
      source.onerror = () => setStatus("Reconnecting");
    }
    const channel = supabase
      ?.channel(`monty:${TEAM_ID}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: PROMPT_EVENTS_TABLE,
          filter: `team_id=eq.${TEAM_ID}`,
        },
        (payload) => {
          if (payload.eventType === "UPDATE") {
            updateEvent(payload.new as PromptEvent);
          } else {
            addEvent(payload.new as PromptEvent, initialLoadDone);
          }
          setStatus("Live");
        },
      )
      .subscribe((state) => {
        if (state === "SUBSCRIBED") setStatus("Live");
      });

    return () => {
      closed = true;
      source?.close();
      if (channel) supabase?.removeChannel(channel);
    };
  }, []);

  const filteredEvents = sourceFilter === "all" ? events : events.filter((event) => event.source === sourceFilter);

  const copyInstall = async () => {
    await navigator.clipboard.writeText(INSTALL_CMD);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <main className="min-h-screen bg-white text-[#111]">
      <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-black/[0.06]">
        <nav className="mx-auto flex h-[5.25rem] max-w-[1280px] items-center gap-4 px-6 lg:px-10">
          <div className="flex flex-1 items-center gap-6">
            <Link href="/" className="flex items-center"><MontyLogo /></Link>
            <div className="hidden sm:flex items-center gap-4 text-sm ml-2">
              <Link href="/feed" className="text-[#111] font-medium">Live</Link>
              <Link href="/leaderboard" className="text-[#999] hover:text-[#111] font-medium transition-colors">Tokens</Link>
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

      <section className="mx-auto max-w-[1280px] px-6 lg:px-10 pt-6 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${status === "Live" ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
            <span className={`text-xs font-medium ${status === "Live" ? "text-emerald-600" : "text-amber-600"}`}>{status}</span>
          </div>
          <div className="flex items-center gap-1 rounded-xl bg-[#f5f5f5] p-1">
            {(["all", "claude", "codex"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSourceFilter(s)}
                className={`h-8 rounded-lg px-3.5 text-sm font-medium transition-all ${
                  sourceFilter === s
                    ? "bg-white text-[#111] shadow-sm"
                    : "text-[#999] hover:text-[#666]"
                }`}
              >
                {s === "all" ? "All" : sourceLabels[s]}
              </button>
            ))}
          </div>
        </div>
      </section>

      {events.length > 0 && <PresenceBar events={events} />}

      <section className="mx-auto max-w-[1280px] px-6 lg:px-10 pb-16">
        {filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse mb-6" />
            <h3 className="text-xl font-semibold text-[#111]">Waiting for the first prompt</h3>
            <p className="mt-3 max-w-md text-[15px] leading-relaxed text-[#666]">
              Install Monty, then submit a prompt in Claude Code or Codex CLI. It'll appear here instantly.
            </p>
            <div className="mt-6 flex items-center gap-2 rounded-[10px] bg-[#f5f5f5] px-4 py-2.5">
              <span className="opacity-50 select-none font-mono text-sm">$</span>
              <span className="font-mono text-sm text-[#111]">{INSTALL_CMD}</span>
              <button onClick={copyInstall} className="flex size-8 items-center justify-center rounded-full hover:bg-black/10">
                {copied ? <CheckIcon /> : <CopyIcon />}
              </button>
            </div>
          </div>
        ) : (
          <div className="max-w-[860px]">
            {filteredEvents.map((event, i) => (
              <FeedItem key={event.id} event={event} isFresh={freshIds.has(event.id)} isRunning={runningIds.has(event.id)} isFirst={i === 0} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function FeedItem({ event, isFresh, isRunning, isFirst }: { event: PromptEvent; isFresh: boolean; isRunning: boolean; isFirst: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = event.prompt.length > 400 || event.prompt.split("\n").length > 8;

  const hasTokens = (event.input_tokens || 0) + (event.output_tokens || 0) > 0;
  const projectName = event.cwd ? event.cwd.split("/").filter(Boolean).pop() || null : null;

  const meta: React.ReactNode[] = [];
  if (projectName) {
    meta.push(
      <span className="flex items-center gap-1">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="shrink-0 text-[#999]">
          <path d="M1.5 3a1.5 1.5 0 011.5-1.5h3.19a1.5 1.5 0 011.06.44L8.56 3.25a.5.5 0 00.35.15H13a1.5 1.5 0 011.5 1.5v7.6a1.5 1.5 0 01-1.5 1.5H3A1.5 1.5 0 011.5 12.5V3z" stroke="currentColor" strokeWidth="1.2" />
        </svg>
        <span className="font-mono">{projectName}</span>
      </span>
    );
  }
  if ((event.source === "claude" || event.source === "codex") && event.model) {
    const src = event.source === "claude"
      ? "https://cdn.worldvectorlogo.com/logos/claude-logo.svg"
      : "https://raw.githubusercontent.com/lobehub/lobe-icons/refs/heads/master/packages/static-avatar/avatars/codex.webp";
    const alt = event.source === "claude" ? "Claude" : "Codex";
    meta.push(
      <span className="flex items-center gap-1">
        <img src={src} alt={alt} className="h-3 w-auto" />
        <span className="font-mono">{event.model}</span>
      </span>
    );
  } else {
    if (event.source) meta.push(sourceLabels[event.source] || event.source);
    if (event.model) meta.push(event.model);
  }
  if (hasTokens) {
    const cacheCreation = (event.metadata?.cache_creation_input_tokens as number) || 0;
    const cacheRead = (event.metadata?.cache_read_input_tokens as number) || 0;
    const nonCachedTokens = Math.max(0, (event.input_tokens || 0) - cacheCreation - cacheRead) + (event.output_tokens || 0);
    meta.push(formatTokens(nonCachedTokens) + " tokens");
    meta.push(formatCost(computeEventCost(event)));
  }
  const modifiedFiles: string[] = Array.isArray(event.metadata?.modified_files) ? (event.metadata.modified_files as string[]) : [];

  return (
    <article
      className={`relative border-b border-[#f0f0f0] transition-colors duration-700 ${
        isFresh ? "bg-emerald-50/40" : ""
      } ${isFirst ? "" : ""}`}
      style={isFresh ? { animation: "feedSlideIn 0.35s ease-out" } : undefined}
    >
      <div className="flex gap-4 py-5">
        <div className="flex flex-col items-center shrink-0 pt-0.5">
          <div className="size-9 overflow-hidden rounded-full bg-gradient-to-br from-[#eee] to-[#ddd]">
            {validAvatarUrl(event.avatar_url) ? (
              <Image
                src={validAvatarUrl(event.avatar_url)!}
                alt={event.user_name}
                width={36}
                height={36}
                className="size-9 object-cover"
              />
            ) : (
              <div className="grid size-9 place-items-center text-[11px] font-semibold text-[#888]">
                {initialsFor(event.user_name)}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-semibold text-[#111]">{event.user_name}</span>
            <span className="text-[12px] text-[#ccc]">{relativeTime(event.created_at)}</span>
          </div>

          <p className={`mt-1.5 whitespace-pre-wrap break-words text-[15px] leading-[1.6] text-[#222] ${isLong && !expanded ? "line-clamp-5" : ""}`}>
            {event.prompt}
          </p>
          {isLong && (
            <button onClick={() => setExpanded(!expanded)} className="mt-1 text-[13px] font-medium text-[#aaa] hover:text-[#666] transition-colors">
              {expanded ? "Show less" : "Show more"}
            </button>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-x-1.5 text-[12px] text-[#bbb]">
            {meta.map((item, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-[#e0e0e0]">&middot;</span>}
                {typeof item === "string" ? <span className="font-mono">{item}</span> : item}
              </span>
            ))}
            {isRunning && (
              <span className="flex items-center gap-1.5">
                {meta.length > 0 && <span className="text-[#e0e0e0]">&middot;</span>}
                <span className="inline-flex items-center gap-1 font-mono text-[#ccc]">
                  <svg className="w-3 h-3 animate-spin" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="8" cy="8" r="6" strokeOpacity="0.3" />
                    <path d="M8 2a6 6 0 0 1 6 6" strokeLinecap="round" />
                  </svg>
                  running…
                </span>
              </span>
            )}
          </div>
          {modifiedFiles.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {modifiedFiles.map((file) => {
                const fileName = file.split("/").pop() || file;
                return (
                  <span key={file} className="inline-flex items-center gap-1 rounded-md bg-[#f5f5f5] px-1.5 py-0.5" title={file}>
                    <FileIcon filename={fileName} />
                    <span className="text-[11px] font-mono text-[#666]">{fileName}</span>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

const ACTIVE_THRESHOLD_MS = 5 * 60_000;

function PresenceBar({ events }: { events: PromptEvent[] }) {
  const users = new Map<string, { name: string; avatarUrl: string | null; lastSeen: number }>();
  for (const e of events) {
    const existing = users.get(e.user_name);
    const t = new Date(e.created_at).getTime();
    if (!existing || t > existing.lastSeen) {
      users.set(e.user_name, { name: e.user_name, avatarUrl: e.avatar_url, lastSeen: t });
    }
  }

  const sorted = Array.from(users.values()).sort((a, b) => b.lastSeen - a.lastSeen);
  const now = Date.now();

  return (
    <section className="mx-auto max-w-[1280px] px-6 lg:px-10 pb-6">
      <div className="flex justify-center gap-8 overflow-x-auto py-2">
        {sorted.map((user) => {
          const isActive = now - user.lastSeen < ACTIVE_THRESHOLD_MS;
          return (
            <div key={user.name} className="flex flex-col items-center gap-2 shrink-0">
              <div className="relative">
                {isActive ? <LaptopOpenIcon /> : <LaptopClosedIcon />}
                <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${isActive ? "bg-emerald-400" : "bg-[#ccc]"}`} />
              </div>
              <div className="flex items-center gap-1.5">
                {validAvatarUrl(user.avatarUrl) ? (
                  <Image src={validAvatarUrl(user.avatarUrl)!} alt={user.name} width={18} height={18} className="size-[18px] rounded-full object-cover" />
                ) : (
                  <div className="grid size-[18px] place-items-center rounded-full bg-gradient-to-br from-[#eee] to-[#ddd] text-[8px] font-semibold text-[#888]">
                    {initialsFor(user.name)}
                  </div>
                )}
                <span className={`text-[13px] font-medium truncate max-w-[100px] ${isActive ? "text-[#111]" : "text-[#aaa]"}`}>
                  {user.name}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function FileIcon({ filename }: { filename: string }) {
  const ext = filename.includes(".") ? filename.split(".").pop()?.toLowerCase() : null;
  let color = "#999";
  let label = "";
  if (ext === "ts" || ext === "tsx") { color = "#3178C6"; label = "TS"; }
  else if (ext === "js" || ext === "jsx") { color = "#F7DF1E"; label = "JS"; }
  else if (ext === "py") { color = "#3776AB"; label = "PY"; }
  else if (ext === "rs") { color = "#DEA584"; label = "RS"; }
  else if (ext === "go") { color = "#00ADD8"; label = "GO"; }
  else if (ext === "rb") { color = "#CC342D"; label = "RB"; }
  else if (ext === "css" || ext === "scss") { color = "#663399"; label = "CSS"; }
  else if (ext === "json") { color = "#A4A4A4"; label = "{ }"; }
  else if (ext === "md" || ext === "mdx") { color = "#555"; label = "MD"; }

  if (label) {
    return (
      <span className="flex items-center justify-center w-4 h-4 rounded text-[7px] font-bold text-white leading-none" style={{ backgroundColor: color }}>
        {label}
      </span>
    );
  }

  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0">
      <path d="M3 1.5h6.5L13 5v9.5a1 1 0 01-1 1H4a1 1 0 01-1-1v-13z" stroke="#999" strokeWidth="1.2" />
      <path d="M9.5 1.5V5H13" stroke="#999" strokeWidth="1.2" />
    </svg>
  );
}

function LaptopOpenIcon() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const pixelSize = 3;
    const cols = Math.ceil(w / pixelSize);
    const rows = Math.ceil(h / pixelSize);
    const palette = [
      [180, 130, 220], [100, 180, 255], [255, 160, 120],
      [120, 220, 170], [220, 140, 200], [160, 180, 255],
      [255, 190, 100], [100, 210, 220], [200, 150, 240],
    ];

    let grid = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => palette[Math.floor(Math.random() * palette.length)])
    );

    const draw = () => {
      const imageData = ctx.createImageData(w, h);
      const data = imageData.data;
      const changeFraction = 0.15;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          if (Math.random() < changeFraction) {
            grid[row][col] = palette[Math.floor(Math.random() * palette.length)];
          }
          const color = grid[row][col];
          const brightness = 0.85 + Math.random() * 0.15;
          for (let py = 0; py < pixelSize && row * pixelSize + py < h; py++) {
            for (let px = 0; px < pixelSize && col * pixelSize + px < w; px++) {
              const idx = ((row * pixelSize + py) * w + col * pixelSize + px) * 4;
              data[idx] = color[0] * brightness;
              data[idx + 1] = color[1] * brightness;
              data[idx + 2] = color[2] * brightness;
              data[idx + 3] = 255;
            }
          }
        }
      }
      ctx.putImageData(imageData, 0, 0);
    };

    draw();
    const interval = setInterval(draw, 600);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative" style={{ width: 144, height: 112 }}>
      <svg width="144" height="112" viewBox="0 0 72 56" fill="none" className="absolute inset-0 text-[#555]">
        <rect x="8" y="4" width="56" height="38" rx="3" stroke="currentColor" strokeWidth="0.75" />
        <path d="M4 46h64" stroke="currentColor" strokeWidth="0.75" strokeLinecap="round" />
        <path d="M28 46l-2 4h20l-2-4" stroke="currentColor" strokeWidth="0.6" fill="none" />
      </svg>
      <canvas
        ref={canvasRef}
        width={96}
        height={60}
        className="absolute rounded-[2px]"
        style={{ top: 16, left: 24 }}
      />
    </div>
  );
}

function LaptopClosedIcon() {
  return (
    <div className="relative" style={{ width: 144, height: 112 }}>
      <svg width="144" height="112" viewBox="0 0 72 56" fill="none" className="text-[#ccc]">
        <rect x="8" y="37" width="56" height="4" rx="1.5" stroke="currentColor" strokeWidth="0.75" />
        <rect x="8" y="41" width="56" height="5" rx="1.5" stroke="currentColor" strokeWidth="0.75" />
        <path d="M4 46h64" stroke="currentColor" strokeWidth="0.75" strokeLinecap="round" />
        <path d="M28 46l-2 4h20l-2-4" stroke="currentColor" strokeWidth="0.6" fill="none" />
      </svg>
    </div>
  );
}

function relativeTime(value: string) {
  const delta = Date.now() - new Date(value).getTime();
  if (delta < 60_000) return "just now";
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function validAvatarUrl(value: string | null) {
  if (!value || value === "undefined" || value === "null") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}
