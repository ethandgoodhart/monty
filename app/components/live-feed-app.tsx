"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { MontyLogo, GitHubIcon, CopyIcon, CheckIcon } from "./icons";
import { getBrowserSupabase, hasBrowserSupabaseConfig } from "@/app/lib/supabase";
import { PROMPT_EVENTS_TABLE, type PromptEvent, type PromptSource } from "@/app/lib/prompt-events";

const TEAM_ID = process.env.NEXT_PUBLIC_MONTY_TEAM_ID || "default";
const INSTALL_CMD = "npx monty-cli install";
const sourceLabels: Record<PromptSource, string> = {
  claude: "Claude Code",
  codex: "Codex CLI",
  manual: "Manual",
  test: "Test",
};
const sourceColors: Record<PromptSource, string> = {
  claude: "bg-orange-50 text-orange-600 border-orange-200/60",
  codex: "bg-violet-50 text-violet-600 border-violet-200/60",
  manual: "bg-gray-50 text-gray-600 border-gray-200/60",
  test: "bg-emerald-50 text-emerald-600 border-emerald-200/60",
};

export function LiveFeedApp() {
  const [events, setEvents] = useState<PromptEvent[]>([]);
  const [sourceFilter, setSourceFilter] = useState<PromptSource | "all">("all");
  const [status, setStatus] = useState("Connecting");
  const [copied, setCopied] = useState(false);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let closed = false;
    let initialLoadDone = false;
    const seen = new Set<string>();

    const addEvent = (event: PromptEvent, isRealtime = false) => {
      if (seen.has(event.id)) return;
      seen.add(event.id);
      if (isRealtime) {
        setFreshIds((prev) => new Set(prev).add(event.id));
        setTimeout(() => {
          setFreshIds((prev) => {
            const next = new Set(prev);
            next.delete(event.id);
            return next;
          });
        }, 5000);
      }
      setEvents((current) =>
        [event, ...current.filter((item) => item.id !== event.id)]
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 100),
      );
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

    const source = new EventSource(`/api/events/stream?team=${encodeURIComponent(TEAM_ID)}`);
    source.addEventListener("prompt", (message) => {
      addEvent(JSON.parse((message as MessageEvent).data) as PromptEvent, initialLoadDone);
      setStatus("Live");
    });
    source.onerror = () => setStatus(hasBrowserSupabaseConfig() ? "Live" : "Reconnecting");

    const supabase = getBrowserSupabase();
    const channel = supabase
      ?.channel(`monty:${TEAM_ID}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: PROMPT_EVENTS_TABLE,
          filter: `team_id=eq.${TEAM_ID}`,
        },
        (payload) => {
          addEvent(payload.new as PromptEvent, initialLoadDone);
          setStatus("Live");
        },
      )
      .subscribe((state) => {
        if (state === "SUBSCRIBED") setStatus("Live");
      });

    return () => {
      closed = true;
      source.close();
      if (channel) supabase?.removeChannel(channel);
    };
  }, []);

  const filteredEvents = sourceFilter === "all" ? events : events.filter((event) => event.source === sourceFilter);
  const totalToday = events.filter((event) => new Date(event.created_at).toDateString() === new Date().toDateString()).length;

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
              <Link href="/feed" className="text-[#111] font-medium">Feed</Link>
              <Link href="/leaderboard" className="text-[#999] hover:text-[#111] font-medium transition-colors">Leaderboard</Link>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${status === "Live" ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
                <span className={`text-xs font-medium ${status === "Live" ? "text-emerald-600" : "text-amber-600"}`}>{status}</span>
              </div>
              <span className="text-[#ddd] mx-1">|</span>
              <span className="text-xs text-[#999] font-medium">{totalToday} prompts today</span>
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

      <section className="mx-auto max-w-[1280px] px-6 lg:px-10 py-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div>
            <h1
              className="text-[#111]"
              style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", fontWeight: 600, letterSpacing: "-0.02em" }}
            >
              Prompt stream
            </h1>
            <p className="mt-1 text-[15px] text-[#666]">Live prompts from your team, as they happen.</p>
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

        {filteredEvents.length === 0 ? (
          <div className="rounded-2xl border border-black/[0.06] bg-white flex flex-col items-center justify-center py-32 text-center">
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
          <div className="space-y-3">
            {filteredEvents.map((event, i) => (
              <PromptCard key={event.id} event={event} isLatest={i === 0} isFresh={freshIds.has(event.id)} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function PromptCard({ event, isLatest, isFresh }: { event: PromptEvent; isLatest: boolean; isFresh: boolean }) {
  return (
    <article
      className={`rounded-2xl border bg-white px-6 py-5 transition-all duration-700 hover:shadow-md ${
        isFresh
          ? "border-emerald-300 shadow-lg shadow-emerald-100/50 ring-1 ring-emerald-200/40 animate-[slideIn_0.4s_ease-out]"
          : isLatest
            ? "border-emerald-200/60 shadow-sm"
            : "border-black/[0.06]"
      }`}
      style={isFresh ? { borderLeftWidth: "3px", borderLeftColor: "#34d399" } : undefined}
    >
      <div className="flex items-start gap-4">
        <Avatar event={event} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-semibold text-[#111]">{event.user_name}</span>
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${sourceColors[event.source]}`}>
              {sourceLabels[event.source]}
            </span>
            {isFresh && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 animate-pulse">
                NEW
              </span>
            )}
            <span className={`text-xs ml-auto shrink-0 ${isFresh ? "text-emerald-500 font-medium" : "text-[#bbb]"}`}>{relativeTime(event.created_at)}</span>
          </div>
          {event.cwd && (
            <div className="mt-1 flex items-center gap-1.5 text-xs text-[#999]">
              <span className="font-mono truncate">{event.machine_id}</span>
              <span className="text-[#ddd]">/</span>
              <span className="font-mono truncate">{event.cwd}</span>
            </div>
          )}
          <p className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-[#333]">{event.prompt}</p>
          {(event.model || event.token_count) && (
            <div className="mt-3 flex items-center gap-3">
              {event.model && (
                <span className="rounded-lg bg-[#f5f5f5] px-2 py-1 text-[11px] font-medium text-[#888]">{event.model}</span>
              )}
              {event.token_count && (
                <span className="text-[11px] text-[#bbb]">{event.token_count.toLocaleString()} tokens</span>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function Avatar({ event }: { event: PromptEvent }) {
  const initials = initialsFor(event.user_name);
  const avatarUrl = validAvatarUrl(event.avatar_url);

  return (
    <div className="size-10 overflow-hidden rounded-full bg-gradient-to-br from-[#eee] to-[#ddd] shrink-0">
      {avatarUrl ? (
        <Image
          src={avatarUrl}
          alt={event.user_name}
          width={40}
          height={40}
          className="size-10 object-cover"
        />
      ) : (
        <div className="grid size-10 place-items-center text-xs font-semibold text-[#888]">{initials}</div>
      )}
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
