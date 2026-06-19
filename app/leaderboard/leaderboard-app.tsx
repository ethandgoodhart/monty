"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { MontyLogo, GitHubIcon, CopyIcon, CheckIcon } from "../components/icons";
import { getBrowserSupabase, hasBrowserSupabaseConfig } from "@/app/lib/supabase";
import { PROMPT_EVENTS_TABLE, type PromptEvent } from "@/app/lib/prompt-events";
import { computeCost, formatCost, formatTokens, getModelPricing } from "@/app/lib/pricing";

const TEAM_ID = process.env.NEXT_PUBLIC_MONTY_TEAM_ID || "default";
const INSTALL_CMD = "npx monty-cli install";

type TimeRange = "today" | "week" | "month" | "all";
const timeRangeLabels: Record<TimeRange, string> = { today: "Today", week: "This week", month: "This month", all: "All time" };

type ModelStats = { tokens: number; inputTokens: number; outputTokens: number; cacheCreationTokens: number; cacheReadTokens: number; count: number };

type Heartbeat = {
  team_id: string;
  user_name: string;
  date: string;
  seconds: number;
};

type EngineerStats = {
  name: string;
  avatarUrl: string | null;
  totalTokens: number;
  totalCost: number;
  promptCount: number;
  inputTokens: number;
  outputTokens: number;
  models: Record<string, ModelStats>;
  lastActive: string;
  topModel: string;
  activeSeconds: number;
  tokensPerHour: number;
};

type SortKey = "rank" | "name" | "tokens" | "input" | "output" | "cost" | "sessions" | "topModel" | "lastActive" | "tokensPerHour";
type SortDir = "asc" | "desc";

function getStartDate(range: TimeRange): Date | null {
  const now = new Date();
  if (range === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (range === "week") { const d = new Date(now); d.setDate(d.getDate() - 7); return d; }
  if (range === "month") { const d = new Date(now); d.setMonth(d.getMonth() - 1); return d; }
  return null;
}

function getEventTokens(e: PromptEvent): { input: number; output: number; cacheCreation: number; cacheRead: number } {
  const input = e.input_tokens || (e.metadata?.input_tokens as number) || 0;
  const output = e.output_tokens || (e.metadata?.output_tokens as number) || 0;
  const cacheCreation = (e.metadata?.cache_creation_input_tokens as number) || 0;
  const cacheRead = (e.metadata?.cache_read_input_tokens as number) || 0;
  return { input, output, cacheCreation, cacheRead };
}

function computeStats(events: PromptEvent[], range: TimeRange, heartbeats: Heartbeat[]): EngineerStats[] {
  const startDate = getStartDate(range);
  const filtered = startDate ? events.filter((e) => new Date(e.created_at) >= startDate) : events;
  const startDateStr = startDate ? startDate.toISOString().slice(0, 10) : null;
  const filteredHeartbeats = startDateStr ? heartbeats.filter((h) => h.date >= startDateStr) : heartbeats;

  const activeSecondsMap = new Map<string, number>();
  for (const h of filteredHeartbeats) {
    activeSecondsMap.set(h.user_name, (activeSecondsMap.get(h.user_name) || 0) + h.seconds);
  }

  const map = new Map<string, EngineerStats>();
  for (const e of filtered) {
    const key = e.user_name;
    if (!map.has(key)) {
      map.set(key, { name: key, avatarUrl: e.avatar_url, totalTokens: 0, totalCost: 0, promptCount: 0, inputTokens: 0, outputTokens: 0, models: {}, lastActive: e.created_at, topModel: "", activeSeconds: 0, tokensPerHour: 0 });
    }
    const stats = map.get(key)!;
    stats.promptCount++;
    const { input, output, cacheCreation, cacheRead } = getEventTokens(e);
    const uncachedInput = Math.max(0, input - cacheCreation - cacheRead);
    const tokens = uncachedInput + output;
    const model = e.model || "unknown";
    const cost = computeCost(model, input, output, cacheCreation, cacheRead);
    stats.totalTokens += tokens;
    stats.totalCost += cost;
    stats.inputTokens += uncachedInput;
    stats.outputTokens += output;
    if (!stats.avatarUrl && e.avatar_url) stats.avatarUrl = e.avatar_url;
    if (!stats.models[model]) stats.models[model] = { tokens: 0, inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, count: 0 };
    stats.models[model].tokens += tokens;
    stats.models[model].inputTokens += uncachedInput;
    stats.models[model].outputTokens += output;
    stats.models[model].cacheCreationTokens += cacheCreation;
    stats.models[model].cacheReadTokens += cacheRead;
    stats.models[model].count++;
    if (new Date(e.created_at) > new Date(stats.lastActive)) stats.lastActive = e.created_at;
  }

  for (const stats of map.values()) {
    let topModel = "";
    let topTokens = 0;
    for (const [model, data] of Object.entries(stats.models)) {
      if (data.tokens > topTokens) { topTokens = data.tokens; topModel = model; }
    }
    stats.topModel = topModel;
    stats.activeSeconds = activeSecondsMap.get(stats.name) || 0;
    const activeHours = stats.activeSeconds / 3600;
    stats.tokensPerHour = activeHours > 0 ? stats.totalTokens / activeHours : 0;
  }

  return Array.from(map.values()).sort((a, b) => b.totalTokens - a.totalTokens || b.promptCount - a.promptCount);
}

function relativeTime(value: string) {
  const delta = Date.now() - new Date(value).getTime();
  if (delta < 60_000) return "just now";
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
  return `${Math.floor(delta / 86_400_000)}d ago`;
}

function sortStats(stats: EngineerStats[], sortKey: SortKey, sortDir: SortDir): EngineerStats[] {
  const sorted = [...stats];
  const dir = sortDir === "asc" ? 1 : -1;
  sorted.sort((a, b) => {
    switch (sortKey) {
      case "rank":
      case "tokens": return dir * (a.totalTokens - b.totalTokens);
      case "name": return dir * a.name.localeCompare(b.name);
      case "input": return dir * (a.inputTokens - b.inputTokens);
      case "output": return dir * (a.outputTokens - b.outputTokens);
      case "cost": return dir * (a.totalCost - b.totalCost);
      case "sessions": return dir * (a.promptCount - b.promptCount);
      case "topModel": return dir * a.topModel.localeCompare(b.topModel);
      case "lastActive": return dir * (new Date(a.lastActive).getTime() - new Date(b.lastActive).getTime());
      case "tokensPerHour": return dir * (a.tokensPerHour - b.tokensPerHour);
      default: return 0;
    }
  });
  return sorted;
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (active && dir === "desc") {
    return <svg className="w-3.5 h-3.5 inline-block ml-1 text-[#111]" viewBox="0 0 16 16" fill="currentColor"><path d="M8 11.5l-4-5h8l-4 5z" /></svg>;
  }
  if (active && dir === "asc") {
    return <svg className="w-3.5 h-3.5 inline-block ml-1 text-[#111]" viewBox="0 0 16 16" fill="currentColor"><path d="M8 4.5l4 5H4l4-5z" /></svg>;
  }
  return (
    <svg className="w-3.5 h-3.5 inline-block ml-1 text-[#ccc]" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 4.5l3 3.5H5l3-3.5zM8 11.5l-3-3.5h6l-3 3.5z" />
    </svg>
  );
}

export function LeaderboardApp() {
  const [events, setEvents] = useState<PromptEvent[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>("week");
  const [sortKey, setSortKey] = useState<SortKey>("tokens");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState("Connecting");
  const [heartbeats, setHeartbeats] = useState<Heartbeat[]>([]);

  useEffect(() => {
    fetch(`/api/heartbeat?team=${encodeURIComponent(TEAM_ID)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { heartbeats?: Heartbeat[] }) => setHeartbeats(data.heartbeats ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const seen = new Set<string>();
    const addEvent = (event: PromptEvent) => {
      if (seen.has(event.id)) return;
      seen.add(event.id);
      setEvents((current) =>
        [event, ...current.filter((item) => item.id !== event.id)]
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 2000),
      );
    };

    fetch(`/api/events?team=${encodeURIComponent(TEAM_ID)}&limit=2000`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { events?: PromptEvent[] }) => {
        (data.events ?? []).reverse().forEach(addEvent);
        setStatus("Live");
      })
      .catch(() => setStatus("Waiting for events"));

    const supabase = getBrowserSupabase();
    const channel = supabase
      ?.channel(`monty-lb:${TEAM_ID}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: PROMPT_EVENTS_TABLE, filter: `team_id=eq.${TEAM_ID}` },
        (payload) => { addEvent(payload.new as PromptEvent); setStatus("Live"); })
      .subscribe((state) => {
        if (state === "SUBSCRIBED") setStatus("Live");
      });

    return () => { if (channel) supabase?.removeChannel(channel); };
  }, []);

  const stats = computeStats(events, timeRange, heartbeats);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const displayStats = sortKey === "tokens" && sortDir === "desc" ? stats : sortStats(stats, sortKey, sortDir);

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
            <div className="hidden sm:flex items-center gap-4 text-sm">
              <Link href="/feed" className="text-[#999] hover:text-[#111] font-medium transition-colors">Live</Link>
              <Link href="/leaderboard" className="text-[#111] font-medium">Tokens</Link>
            </div>
          </div>
          <div className="flex flex-1 items-center justify-end gap-5">
            <a href="https://github.com/ethandgoodhart/monty" className="hidden items-center gap-2 rounded-lg px-3 text-sm font-medium text-[#111] hover:bg-black/5 lg:inline-flex h-[35px]">
              <GitHubIcon />
            </a>
            <button onClick={copyInstall} className="inline-flex shrink-0 items-center text-sm font-medium hover:opacity-85 transition-opacity h-[35px] bg-[#111] text-white rounded-[10px] px-3 cursor-pointer">
              {copied ? "Copied!" : "Install"}
            </button>
          </div>
        </nav>
      </header>

      <section className="mx-auto max-w-[1280px] px-6 lg:px-10 pt-8 pb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${status === "Live" ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
            <span className={`text-xs font-medium ${status === "Live" ? "text-emerald-600" : "text-amber-600"}`}>{status}</span>
          </div>
          <div className="flex items-center gap-1 rounded-xl bg-[#f5f5f5] p-1">
            {(Object.keys(timeRangeLabels) as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`h-8 rounded-lg px-3 text-sm font-medium transition-all ${
                  timeRange === range ? "bg-white text-[#111] shadow-sm" : "text-[#999] hover:text-[#666]"
                }`}
              >
                {timeRangeLabels[range]}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1280px] px-6 lg:px-10 pb-10">
        {stats.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <h3 className="text-xl font-semibold text-[#111]">No activity yet</h3>
            <p className="mt-3 max-w-md text-[15px] leading-relaxed text-[#666]">
              Install Monty, then submit a prompt in Claude Code or Codex CLI. Your leaderboard will populate automatically.
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
          <div className="rounded-xl border border-[#e5e5e5] overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[#e5e5e5]">
                  <Th onClick={() => handleSort("rank")} active={sortKey === "rank"} dir={sortDir} className="w-[72px] text-center">Rank</Th>
                  <Th onClick={() => handleSort("name")} active={sortKey === "name"} dir={sortDir} className="text-left">Engineer</Th>
                  <Th onClick={() => handleSort("tokens")} active={sortKey === "tokens"} dir={sortDir} className="text-right">Tokens</Th>
                  <Th onClick={() => handleSort("input")} active={sortKey === "input"} dir={sortDir} className="text-right hidden md:table-cell">Input</Th>
                  <Th onClick={() => handleSort("output")} active={sortKey === "output"} dir={sortDir} className="text-right hidden md:table-cell">Output</Th>
                  <Th onClick={() => handleSort("cost")} active={sortKey === "cost"} dir={sortDir} className="text-right">Cost</Th>
                  <Th onClick={() => handleSort("sessions")} active={sortKey === "sessions"} dir={sortDir} className="text-right hidden sm:table-cell">Prompts</Th>
                  <Th onClick={() => handleSort("tokensPerHour")} active={sortKey === "tokensPerHour"} dir={sortDir} className="text-right hidden sm:table-cell">Tokens/hr</Th>
                  <Th onClick={() => handleSort("topModel")} active={sortKey === "topModel"} dir={sortDir} className="text-left hidden lg:table-cell">Top Model</Th>
                  <Th onClick={() => handleSort("lastActive")} active={sortKey === "lastActive"} dir={sortDir} className="text-right hidden sm:table-cell">Last Active</Th>
                </tr>
              </thead>
              <tbody>
                {displayStats.map((engineer, i) => {
                  const rank = stats.indexOf(engineer) + 1;
                  return (
                    <tr key={engineer.name} className="border-b border-[#e5e5e5] last:border-b-0 hover:bg-[#fafafa] transition-colors">
                      <td className="py-4 px-4 text-center tabular-nums text-[15px] font-medium text-[#555]">{rank}</td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="size-8 overflow-hidden rounded-full bg-gradient-to-br from-[#eee] to-[#ddd] shrink-0">
                            {validAvatarUrl(engineer.avatarUrl) ? (
                              <Image src={validAvatarUrl(engineer.avatarUrl)!} alt={engineer.name} width={32} height={32} className="size-8 object-cover" />
                            ) : (
                              <div className="grid size-8 place-items-center text-[11px] font-semibold text-[#888]">
                                {initialsFor(engineer.name)}
                              </div>
                            )}
                          </div>
                          <span className="text-[15px] font-medium text-[#111] truncate">{engineer.name}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right tabular-nums text-[15px] font-semibold text-[#111]">{formatTokens(engineer.totalTokens)}</td>
                      <td className="py-4 px-4 text-right tabular-nums text-[15px] text-[#666] hidden md:table-cell">{formatTokens(engineer.inputTokens)}</td>
                      <td className="py-4 px-4 text-right tabular-nums text-[15px] text-[#666] hidden md:table-cell">{formatTokens(engineer.outputTokens)}</td>
                      <td className="py-4 px-4 text-right tabular-nums text-[15px] font-medium text-[#111]">{formatCost(engineer.totalCost)}</td>
                      <td className="py-4 px-4 text-right tabular-nums text-[15px] text-[#666] hidden sm:table-cell">{engineer.promptCount.toLocaleString()}</td>
                      <td className="py-4 px-4 text-right tabular-nums text-[15px] font-semibold hidden sm:table-cell">
                        {engineer.tokensPerHour > 0 ? (
                          <span className="inline-block velocity-shimmer">
                            {formatTokens(Math.round(engineer.tokensPerHour))}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="py-4 px-4 text-left hidden lg:table-cell">
                        <span className="text-[14px] text-[#555] font-mono truncate block max-w-[200px]">{engineer.topModel}</span>
                      </td>
                      <td className="py-4 px-4 text-right text-[14px] text-[#999] hidden sm:table-cell">{relativeTime(engineer.lastActive)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function Th({ children, onClick, active, dir, className }: { children: React.ReactNode; onClick: () => void; active: boolean; dir: SortDir; className?: string }) {
  return (
    <th
      onClick={onClick}
      className={`py-3 px-4 text-[13px] font-medium text-[#888] cursor-pointer select-none whitespace-nowrap ${className || ""}`}
    >
      {children}
      <SortIcon active={active} dir={dir} />
    </th>
  );
}

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function validAvatarUrl(value: string | null | undefined): string | null {
  if (!value || value === "undefined" || value === "null") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}
