"use client";

import { useState } from "react";
import { CopyIcon, CheckIcon } from "./icons";

const INSTALL_CMD = "npx monty-cli install";

const leaderboardData = [
  { rank: 1, name: "Sarah Chen", photo: "https://i.pravatar.cc/64?img=47", tokens: 2_847_392, prompts: 1_284, delta: "+12%", streak: 14 },
  { rank: 2, name: "Jake Morrison", photo: "https://i.pravatar.cc/64?img=68", tokens: 2_103_844, prompts: 967, delta: "+8%", streak: 11 },
  { rank: 3, name: "Priya Patel", photo: "https://i.pravatar.cc/64?img=45", tokens: 1_956_221, prompts: 891, delta: "+23%", streak: 9 },
  { rank: 4, name: "Marcus Webb", photo: "https://i.pravatar.cc/64?img=52", tokens: 1_744_108, prompts: 812, delta: "+5%", streak: 7 },
  { rank: 5, name: "Elena Rossi", photo: "https://i.pravatar.cc/64?img=23", tokens: 1_621_550, prompts: 743, delta: "+18%", streak: 12 },
  { rank: 6, name: "David Kim", photo: "https://i.pravatar.cc/64?img=59", tokens: 1_489_003, prompts: 694, delta: "+3%", streak: 4 },
];

const rankColors = ["bg-amber-400", "bg-gray-300", "bg-amber-600"];

function formatTokens(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return n.toString();
}

function Leaderboard() {
  return (
    <div className="w-full max-w-3xl rounded-2xl bg-white border border-black/[0.08] shadow-2xl shadow-black/[0.06] overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-medium text-emerald-600">Live</span>
          </div>
          <span className="text-sm font-semibold text-[#111]">Token Leaderboard</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-[#f5f5f5] px-2.5 py-1">
          <span className="text-xs text-[#666] font-medium">This week</span>
          <svg className="w-3.5 h-3.5 text-[#999]" viewBox="0 0 16 16" fill="currentColor"><path fillRule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" /></svg>
        </div>
      </div>

      <div className="grid grid-cols-[2.5rem_1fr_5.5rem_4.5rem_3.5rem] sm:grid-cols-[2.5rem_1fr_6rem_5rem_4rem_3.5rem] gap-x-2 px-6 py-2.5 text-[11px] font-medium text-[#999] uppercase tracking-wider border-b border-black/[0.04]">
        <span>#</span>
        <span>Engineer</span>
        <span className="text-right">Tokens</span>
        <span className="text-right hidden sm:block">Prompts</span>
        <span className="text-right">Trend</span>
        <span className="text-right">Streak</span>
      </div>

      {leaderboardData.map((user, i) => (
        <div
          key={user.name}
          className={`grid grid-cols-[2.5rem_1fr_5.5rem_4.5rem_3.5rem] sm:grid-cols-[2.5rem_1fr_6rem_5rem_4rem_3.5rem] gap-x-2 px-6 py-3.5 items-center border-b border-black/[0.04] last:border-0 transition-colors hover:bg-[#fafafa] ${i === 0 ? "bg-amber-50/50" : ""}`}
        >
          <span className="flex items-center justify-center">
            {i < 3 ? (
              <span className={`w-6 h-6 rounded-full ${rankColors[i]} flex items-center justify-center text-[11px] font-bold text-white`}>
                {user.rank}
              </span>
            ) : (
              <span className="text-sm text-[#999] font-medium pl-0.5">{user.rank}</span>
            )}
          </span>

          <div className="flex items-center gap-3 min-w-0">
            <img src={user.photo} alt={user.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
            <span className="text-sm font-medium text-[#111] truncate">{user.name}</span>
          </div>

          <span className="text-sm font-semibold text-[#111] text-right tabular-nums">{formatTokens(user.tokens)}</span>
          <span className="text-sm text-[#666] text-right tabular-nums hidden sm:block">{user.prompts.toLocaleString()}</span>
          <span className="text-xs font-medium text-emerald-600 text-right">{user.delta}</span>
          <span className="text-sm text-right tabular-nums text-[#888]">{user.streak}d 🔥</span>
        </div>
      ))}

      <div className="px-6 py-3.5 bg-[#fafafa] border-t border-black/[0.06] flex items-center justify-between">
        <span className="text-xs text-[#999]">6 of 24 engineers</span>
        <div className="flex items-center gap-1 text-xs font-medium text-[#666]">
          <span>11.8M tokens this week</span>
          <span className="text-emerald-600 ml-1">+11% vs last week</span>
        </div>
      </div>
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
            Live prompt feed. Token leaderboard. One install per engineer, full visibility for your whole team.
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
