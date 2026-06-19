"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { MontyLogo, GitHubIcon } from "../components/icons";
import { getBrowserSupabase, hasBrowserSupabaseConfig } from "@/app/lib/supabase";
import { PROMPT_EVENTS_TABLE, type PromptEvent } from "@/app/lib/prompt-events";

const TEAM_ID = process.env.NEXT_PUBLIC_MONTY_TEAM_ID || "default";
const INSTALL_CMD = "npx monty-cli install";

type TimeRange = "today" | "week" | "month" | "all";
const timeRangeLabels: Record<TimeRange, string> = { today: "Today", week: "This week", month: "This month", all: "All time" };

type ModelStats = { tokens: number; inputTokens: number; outputTokens: number; count: number };

type EngineerStats = {
  name: string;
  avatarUrl: string | null;
  totalTokens: number;
  totalCost: number;
  promptCount: number;
  models: Record<string, ModelStats>;
  lastActive: string;
};

// per-million pricing
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-4-6": { input: 15, output: 75 },
  "claude-opus-4-5-20250514": { input: 15, output: 75 },
  "claude-sonnet-4-5-20250514": { input: 3, output: 15 },
  "claude-sonnet-4-20250514": { input: 3, output: 15 },
  "claude-haiku-3-5-20241022": { input: 0.80, output: 4 },
  "gpt-5.5": { input: 2, output: 10 },
  "gpt-5.4": { input: 1.5, output: 6 },
  "gpt-5.4-mini": { input: 0.4, output: 1.6 },
  "gpt-5.2-codex": { input: 0.75, output: 3 },
  "gpt-5.1-codex-mini": { input: 0.3, output: 1.25 },
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4.1": { input: 2, output: 8 },
  "o4-mini": { input: 1.10, output: 4.40 },
  "o3-mini": { input: 1.10, output: 4.40 },
};

function getModelPricing(model: string): { input: number; output: number } {
  if (MODEL_PRICING[model]) return MODEL_PRICING[model];
  for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
    if (model.includes(key) || key.includes(model)) return pricing;
  }
  if (model.includes("claude-opus")) return { input: 15, output: 75 };
  if (model.includes("claude-sonnet")) return { input: 3, output: 15 };
  if (model.includes("claude-haiku")) return { input: 0.80, output: 4 };
  if (model.includes("gpt")) return { input: 2, output: 8 };
  return { input: 3, output: 12 };
}

function computeCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = getModelPricing(model);
  return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
}

function formatCost(cost: number): string {
  if (cost >= 1000) return "$" + (cost / 1000).toFixed(1) + "K";
  if (cost >= 1) return "$" + cost.toFixed(2);
  if (cost >= 0.01) return "$" + cost.toFixed(2);
  return "$" + cost.toFixed(3);
}

function getStartDate(range: TimeRange): Date | null {
  const now = new Date();
  if (range === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (range === "week") { const d = new Date(now); d.setDate(d.getDate() - 7); return d; }
  if (range === "month") { const d = new Date(now); d.setMonth(d.getMonth() - 1); return d; }
  return null;
}

function getEventTokens(e: PromptEvent): { input: number; output: number } {
  const input = e.input_tokens || (e.metadata?.input_tokens as number) || 0;
  const output = e.output_tokens || (e.metadata?.output_tokens as number) || 0;
  return { input, output };
}

function computeStats(events: PromptEvent[], range: TimeRange): EngineerStats[] {
  const startDate = getStartDate(range);
  const filtered = startDate ? events.filter((e) => new Date(e.created_at) >= startDate) : events;

  const map = new Map<string, EngineerStats>();
  for (const e of filtered) {
    const key = e.user_name;
    if (!map.has(key)) {
      map.set(key, { name: key, avatarUrl: e.avatar_url, totalTokens: 0, totalCost: 0, promptCount: 0, models: {}, lastActive: e.created_at });
    }
    const stats = map.get(key)!;
    stats.promptCount++;
    const { input, output } = getEventTokens(e);
    const tokens = input + output;
    const model = e.model || e.source || "unknown";
    const cost = computeCost(model, input, output);
    stats.totalTokens += tokens;
    stats.totalCost += cost;
    if (!stats.avatarUrl && e.avatar_url) stats.avatarUrl = e.avatar_url;
    if (!stats.models[model]) stats.models[model] = { tokens: 0, inputTokens: 0, outputTokens: 0, count: 0 };
    stats.models[model].tokens += tokens;
    stats.models[model].inputTokens += input;
    stats.models[model].outputTokens += output;
    stats.models[model].count++;
    if (new Date(e.created_at) > new Date(stats.lastActive)) stats.lastActive = e.created_at;
  }

  return Array.from(map.values()).sort((a, b) => b.totalTokens - a.totalTokens || b.promptCount - a.promptCount);
}

function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

function relativeTime(value: string) {
  const delta = Date.now() - new Date(value).getTime();
  if (delta < 60_000) return "just now";
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
  return `${Math.floor(delta / 86_400_000)}d ago`;
}

const modelColors: Record<string, string> = {
  "claude-sonnet-4-5-20250514": "#f97316",
  "claude-opus-4-6": "#f97316",
  "claude": "#f97316",
  "codex": "#8b5cf6",
  "o4-mini": "#3b82f6",
  "gpt-4": "#10b981",
  "unknown": "#d4d4d4",
};

function getModelColor(model: string): string {
  if (model.includes("claude") || model.includes("Claude")) return "#f97316";
  if (model.includes("codex") || model.includes("Codex")) return "#8b5cf6";
  if (model.includes("gpt") || model.includes("o4") || model.includes("o3") || model.includes("o1")) return "#3b82f6";
  return modelColors[model] || "#94a3b8";
}

function getModelDisplayName(model: string): string {
  return model;
}

export function LeaderboardApp() {
  const [events, setEvents] = useState<PromptEvent[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>("week");
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
      })
      .catch(() => {});

    const supabase = getBrowserSupabase();
    const channel = supabase
      ?.channel(`monty-lb:${TEAM_ID}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: PROMPT_EVENTS_TABLE, filter: `team_id=eq.${TEAM_ID}` },
        (payload) => addEvent(payload.new as PromptEvent))
      .subscribe();

    return () => { if (channel) supabase?.removeChannel(channel); };
  }, []);

  const stats = computeStats(events, timeRange);
  const totalTokens = stats.reduce((s, e) => s + e.totalTokens, 0);
  const totalCost = stats.reduce((s, e) => s + e.totalCost, 0);
  const totalPrompts = stats.reduce((s, e) => s + e.promptCount, 0);
  const maxTokens = stats[0]?.totalTokens || 1;

  const globalModels: Record<string, ModelStats> = {};
  for (const eng of stats) {
    for (const [model, data] of Object.entries(eng.models)) {
      if (!globalModels[model]) globalModels[model] = { tokens: 0, inputTokens: 0, outputTokens: 0, count: 0 };
      globalModels[model].tokens += data.tokens;
      globalModels[model].inputTokens += data.inputTokens;
      globalModels[model].outputTokens += data.outputTokens;
      globalModels[model].count += data.count;
    }
  }
  const sortedModels = Object.entries(globalModels).sort(([, a], [, b]) => b.tokens - a.tokens);
  const maxModelTokens = sortedModels[0]?.[1].tokens || 1;

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
              <Link href="/feed" className="text-[#999] hover:text-[#111] font-medium transition-colors">Feed</Link>
              <Link href="/leaderboard" className="text-[#111] font-medium">Leaderboard</Link>
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

      <section className="mx-auto max-w-[1280px] px-6 lg:px-10 pt-10 pb-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", fontWeight: 600, letterSpacing: "-0.02em" }}>
              Token leaderboard
            </h1>
            <p className="mt-1 text-[15px] text-[#666]">See who&apos;s shipping the most with AI.</p>
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

      <section className="mx-auto max-w-[1280px] px-6 lg:px-10 pb-4">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <StatCard label="Total tokens" value={formatTokens(totalTokens)} />
          <StatCard label="Total cost" value={formatCost(totalCost)} />
          <StatCard label="Total prompts" value={totalPrompts.toLocaleString()} />
          <StatCard label="Engineers" value={stats.length.toString()} />
          <StatCard label="Avg cost / engineer" value={stats.length ? formatCost(totalCost / stats.length) : "$0"} />
        </div>
      </section>

      {sortedModels.length > 0 && (
        <section className="mx-auto max-w-[1280px] px-6 lg:px-10 pb-4">
          <div className="rounded-2xl border border-black/[0.06] bg-white px-6 py-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-semibold text-[#111]">Token usage by model</h2>
              <span className="text-xs text-[#bbb] tabular-nums">{sortedModels.length} model{sortedModels.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="space-y-4">
              {sortedModels.map(([model, { tokens, inputTokens, outputTokens, count }]) => {
                const pct = (tokens / maxModelTokens) * 100;
                const modelCost = computeCost(model, inputTokens, outputTokens);
                const share = totalTokens > 0 ? ((tokens / totalTokens) * 100).toFixed(1) : "0";
                return (
                  <div key={model}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: getModelColor(model) }} />
                        <span className="text-sm font-medium text-[#333]">{getModelDisplayName(model)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-[#999] tabular-nums">{count.toLocaleString()} session{count !== 1 ? "s" : ""}</span>
                        <span className="text-xs font-medium text-[#666] tabular-nums w-12 text-right">{share}%</span>
                        <span className="text-sm font-semibold text-[#555] tabular-nums w-16 text-right">{formatCost(modelCost)}</span>
                        <span className="text-sm font-semibold text-[#111] tabular-nums w-20 text-right">{formatTokens(tokens)}</span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-[#f5f5f5] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(pct, 1)}%`, backgroundColor: getModelColor(model), opacity: 0.85 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-[1280px] px-6 lg:px-10 py-6">
        {stats.length === 0 ? (
          <div className="rounded-2xl border border-black/[0.06] flex flex-col items-center justify-center py-24 text-center">
            <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse mb-6" />
            <h3 className="text-xl font-semibold">No data yet</h3>
            <p className="mt-3 max-w-md text-[15px] text-[#666]">Install Monty and start prompting to see your leaderboard.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {stats.map((engineer, i) => (
              <div key={engineer.name}>
                <button
                  onClick={() => setExpandedUser(expandedUser === engineer.name ? null : engineer.name)}
                  className="w-full text-left"
                >
                  <div className={`group rounded-2xl border bg-white px-5 py-4 transition-all hover:shadow-md cursor-pointer ${
                    i === 0 ? "border-amber-200/60 shadow-sm" : "border-black/[0.06]"
                  }`}>
                    <div className="flex items-center gap-4">
                      <div className="w-8 flex items-center justify-center shrink-0">
                        {i < 3 ? (
                          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold text-white ${
                            i === 0 ? "bg-amber-400" : i === 1 ? "bg-gray-300" : "bg-amber-600"
                          }`}>
                            {i + 1}
                          </span>
                        ) : (
                          <span className="text-sm font-semibold text-[#ccc] tabular-nums">{i + 1}</span>
                        )}
                      </div>

                      <div className="size-10 overflow-hidden rounded-full bg-gradient-to-br from-[#eee] to-[#ddd] shrink-0">
                        {validAvatarUrl(engineer.avatarUrl) ? (
                          <Image src={validAvatarUrl(engineer.avatarUrl)!} alt={engineer.name} width={40} height={40} className="size-10 object-cover" />
                        ) : (
                          <div className="grid size-10 place-items-center text-xs font-semibold text-[#888]">
                            {initialsFor(engineer.name)}
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <span className="text-[15px] font-semibold text-[#111] truncate">{engineer.name}</span>
                          <span className="text-xs text-[#bbb] hidden sm:inline">{relativeTime(engineer.lastActive)}</span>
                        </div>

                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full bg-[#f5f5f5] overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.max((engineer.totalTokens / maxTokens) * 100, 2)}%`,
                                background: i === 0 ? "linear-gradient(90deg, #f59e0b, #f97316)" : i === 1 ? "linear-gradient(90deg, #9ca3af, #6b7280)" : i === 2 ? "linear-gradient(90deg, #d97706, #b45309)" : "#e5e5e5",
                              }}
                            />
                          </div>
                          <span className="text-sm font-semibold text-[#111] tabular-nums w-16 text-right">{formatTokens(engineer.totalTokens)}</span>
                        </div>
                      </div>

                      <div className="hidden sm:flex flex-col items-end gap-0.5 shrink-0">
                        <span className="text-sm font-semibold text-[#111] tabular-nums">{formatCost(engineer.totalCost)}</span>
                        <span className="text-[11px] text-[#bbb]">cost</span>
                      </div>

                      <div className="hidden sm:flex flex-col items-end gap-0.5 shrink-0">
                        <span className="text-sm font-semibold text-[#111] tabular-nums">{engineer.promptCount.toLocaleString()}</span>
                        <span className="text-[11px] text-[#bbb]">sessions</span>
                      </div>

                      <svg className={`w-4 h-4 text-[#ccc] shrink-0 transition-transform ${expandedUser === engineer.name ? "rotate-180" : ""}`} viewBox="0 0 16 16" fill="currentColor">
                        <path fillRule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                </button>

                {expandedUser === engineer.name && (
                  <div className="mt-1 rounded-2xl border border-black/[0.04] bg-[#fafafa] px-6 py-5 animate-[slideIn_0.2s_ease-out]">
                    <div className="text-xs font-semibold text-[#999] uppercase tracking-wider mb-4">Model breakdown</div>
                    <div className="space-y-3">
                      {Object.entries(engineer.models)
                        .sort(([, a], [, b]) => b.tokens - a.tokens)
                        .map(([model, { tokens, inputTokens, outputTokens, count }]) => {
                          const maxModel = Math.max(...Object.values(engineer.models).map(m => m.tokens));
                          const pct = (tokens / maxModel) * 100;
                          const modelCost = computeCost(model, inputTokens, outputTokens);
                          return (
                            <div key={model} className="flex items-center gap-3">
                              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: getModelColor(model) }} />
                              <span className="text-sm font-medium text-[#444] w-52 truncate shrink-0">{getModelDisplayName(model)}</span>
                              <div className="flex-1 h-1.5 rounded-full bg-white overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-300"
                                  style={{ width: `${pct}%`, backgroundColor: getModelColor(model) }}
                                />
                              </div>
                              <span className="text-sm font-semibold tabular-nums text-[#555] w-16 text-right">{formatCost(modelCost)}</span>
                              <span className="text-sm tabular-nums text-[#888] w-20 text-right">{formatTokens(tokens)} <span className="text-[#ccc]">({count})</span></span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white px-5 py-4">
      <div className="text-2xl font-semibold text-[#111] tabular-nums tracking-tight">{value}</div>
      <div className="text-xs text-[#999] font-medium mt-1">{label}</div>
    </div>
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
