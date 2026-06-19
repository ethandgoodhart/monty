"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { CopyIcon, CheckIcon } from "./icons";
import { computeCost, formatCost, formatTokens } from "@/app/lib/pricing";
import type { PromptEvent } from "@/app/lib/prompt-events";

const TEAM_ID = process.env.NEXT_PUBLIC_MONTY_TEAM_ID || "default";
const INSTALL_CMD = "npx monty-cli install";

type EngineerRow = {
  name: string;
  avatarUrl: string | null;
  totalTokens: number;
  totalCost: number;
  promptCount: number;
};

function getEventTokens(e: PromptEvent) {
  const input = e.input_tokens || (e.metadata?.input_tokens as number) || 0;
  const output = e.output_tokens || (e.metadata?.output_tokens as number) || 0;
  const cacheCreation = (e.metadata?.cache_creation_input_tokens as number) || 0;
  const cacheRead = (e.metadata?.cache_read_input_tokens as number) || 0;
  return { input, output, cacheCreation, cacheRead };
}

function buildLeaderboard(events: PromptEvent[]): EngineerRow[] {
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const filtered = events.filter((e) => new Date(e.created_at) >= weekAgo);

  const map = new Map<string, EngineerRow>();
  for (const e of filtered) {
    const key = e.user_name;
    if (!map.has(key)) {
      map.set(key, { name: key, avatarUrl: e.avatar_url, totalTokens: 0, totalCost: 0, promptCount: 0 });
    }
    const stats = map.get(key)!;
    stats.promptCount++;
    const { input, output, cacheCreation, cacheRead } = getEventTokens(e);
    const uncachedInput = Math.max(0, input - cacheCreation - cacheRead);
    const model = e.model || e.source || "unknown";
    stats.totalTokens += uncachedInput + output;
    stats.totalCost += computeCost(model, input, output, cacheCreation, cacheRead);
    if (!stats.avatarUrl && e.avatar_url) stats.avatarUrl = e.avatar_url;
  }

  return Array.from(map.values()).sort((a, b) => b.totalTokens - a.totalTokens);
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

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function Leaderboard() {
  const [rows, setRows] = useState<EngineerRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/events?team=${encodeURIComponent(TEAM_ID)}&limit=2000`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { events?: PromptEvent[] }) => {
        setRows(buildLeaderboard(data.events ?? []));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const display = rows.slice(0, 8);
  const totalTokens = rows.reduce((s, r) => s + r.totalTokens, 0);

  return (
    <div className="w-full max-w-3xl rounded-2xl bg-white border border-black/[0.08] shadow-2xl shadow-black/[0.06] overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-medium text-emerald-600">Live</span>
          </div>
          <span className="text-sm font-semibold text-[#111]">Tokens</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-[#f5f5f5] px-2.5 py-1">
          <span className="text-xs text-[#666] font-medium">This week</span>
        </div>
      </div>

      <div className="grid grid-cols-[2.5rem_1fr_5.5rem_4.5rem] sm:grid-cols-[2.5rem_1fr_6rem_5rem_5rem] gap-x-2 px-6 py-2.5 text-[11px] font-medium text-[#999] uppercase tracking-wider border-b border-black/[0.04]">
        <span>#</span>
        <span>Engineer</span>
        <span className="text-right">Tokens</span>
        <span className="text-right hidden sm:block">Prompts</span>
        <span className="text-right">Cost</span>
      </div>

      {loading ? (
        <div className="px-6 py-12 text-center text-sm text-[#999]">Loading…</div>
      ) : display.length === 0 ? (
        <div className="px-6 py-12 text-center text-sm text-[#999]">No data yet — install Monty to get started.</div>
      ) : (
        display.map((user, i) => (
          <div
            key={user.name}
            className={`grid grid-cols-[2.5rem_1fr_5.5rem_4.5rem] sm:grid-cols-[2.5rem_1fr_6rem_5rem_5rem] gap-x-2 px-6 py-3.5 items-center border-b border-black/[0.04] last:border-0 transition-colors hover:bg-[#fafafa] ${i === 0 ? "bg-amber-50/50" : ""}`}
          >
            <span className="flex items-center justify-center">
              {i < 3 ? (
                <span className={`w-6 h-6 rounded-full ${i === 0 ? "bg-amber-400" : i === 1 ? "bg-gray-300" : "bg-amber-600"} flex items-center justify-center text-[11px] font-bold text-white`}>
                  {i + 1}
                </span>
              ) : (
                <span className="text-sm text-[#999] font-medium pl-0.5">{i + 1}</span>
              )}
            </span>

            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-[#eee] to-[#ddd] shrink-0">
                {validAvatarUrl(user.avatarUrl) ? (
                  <Image src={validAvatarUrl(user.avatarUrl)!} alt={user.name} width={32} height={32} className="w-8 h-8 object-cover" />
                ) : (
                  <div className="grid w-8 h-8 place-items-center text-[11px] font-semibold text-[#888]">
                    {initialsFor(user.name)}
                  </div>
                )}
              </div>
              <span className="text-sm font-medium text-[#111] truncate">{user.name}</span>
            </div>

            <span className="text-sm font-semibold text-[#111] text-right tabular-nums">{formatTokens(user.totalTokens)}</span>
            <span className="text-sm text-[#666] text-right tabular-nums hidden sm:block">{user.promptCount.toLocaleString()}</span>
            <span className="text-sm font-medium text-[#111] text-right tabular-nums">{formatCost(user.totalCost)}</span>
          </div>
        ))
      )}

      {display.length > 0 && (
        <div className="px-6 py-3.5 bg-[#fafafa] border-t border-black/[0.06] flex items-center justify-between">
          <span className="text-xs text-[#999]">{display.length} of {rows.length} engineer{rows.length !== 1 ? "s" : ""}</span>
          <span className="text-xs font-medium text-[#666]">{formatTokens(totalTokens)} tokens this week</span>
        </div>
      )}
    </div>
  );
}

export function Hero() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(INSTALL_CMD);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="py-16 sm:py-20">
      <div className="mx-auto w-full max-w-[1280px] px-6 lg:px-10 flex flex-col gap-14">
        <div className="flex flex-col items-center gap-6 text-center">
          <h1
            className="text-[#111] max-w-5xl hero-reveal"
            style={{
              fontSize: "clamp(2.75rem, 5.5vw, 5rem)",
              lineHeight: 1.08,
              fontWeight: 600,
              letterSpacing: "-0.025em",
              textWrap: "balance",
            }}
          >
            See what your team is building with AI
          </h1>
          <p className="text-[#666] max-w-lg text-lg leading-relaxed hero-reveal-delay-1">
            Live prompt feed. Token tracking. One install per engineer, full visibility for your whole team.
          </p>
          <div className="flex w-full flex-col items-center gap-4 sm:w-auto sm:flex-row hero-reveal-delay-2">
            <div className="flex items-center rounded-[10px] bg-[#f5f5f5] px-4 py-2 w-full sm:w-auto">
              <div className="flex items-center gap-2 font-mono text-sm text-[#666]">
                <span className="opacity-50 select-none">$</span>
                <span className="text-black">npx monty-cli install</span>
                <button
                  onClick={handleCopy}
                  className="group relative flex size-9 items-center justify-center rounded-full hover:bg-black/10"
                >
                  {copied ? <CheckIcon /> : <CopyIcon />}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center hero-reveal-delay-3">
          <Leaderboard />
        </div>
      </div>
    </section>
  );
}
