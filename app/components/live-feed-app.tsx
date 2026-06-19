"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { getBrowserSupabase, hasBrowserSupabaseConfig } from "@/app/lib/supabase";
import { PROMPT_EVENTS_TABLE, type PromptEvent, type PromptSource } from "@/app/lib/prompt-events";

const TEAM_ID = process.env.NEXT_PUBLIC_MONTY_TEAM_ID || "default";
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
  const [siteOrigin, setSiteOrigin] = useState("https://trymonty.ai");

  const installCommand = useMemo(() => {
    return `npx monty-cli install`;
  }, [siteOrigin]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSiteOrigin(window.location.origin), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let closed = false;
    const seen = new Set<string>();

    const addEvent = (event: PromptEvent) => {
      if (seen.has(event.id)) return;
      seen.add(event.id);
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
        (data.events ?? []).reverse().forEach(addEvent);
        setStatus(hasBrowserSupabaseConfig() ? "Realtime via Supabase" : "Realtime via local stream");
      })
      .catch(() => setStatus("Waiting for events"));

    const source = new EventSource(`/api/events/stream?team=${encodeURIComponent(TEAM_ID)}`);
    source.addEventListener("prompt", (message) => {
      addEvent(JSON.parse((message as MessageEvent).data) as PromptEvent);
      setStatus("Live");
    });
    source.onerror = () => setStatus(hasBrowserSupabaseConfig() ? "Supabase live" : "Reconnecting");

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
          addEvent(payload.new as PromptEvent);
          setStatus("Supabase live");
        },
      )
      .subscribe((state) => {
        if (state === "SUBSCRIBED") setStatus("Supabase live");
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
    await navigator.clipboard.writeText(installCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <main className="min-h-screen bg-[#f7f7f4] text-[#171717]">
      <section className="border-b border-black/10 bg-white">
        <div className="mx-auto flex min-h-[88px] max-w-[1320px] flex-col justify-center gap-4 px-5 py-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-sm font-semibold tracking-[0.18em] text-[#d65f14]">MONTY</div>
            <h1 className="mt-1 text-3xl font-semibold leading-tight sm:text-4xl">Live AI prompt feed</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill label={status} active />
            <StatusPill label={`${totalToday} today`} />
            <StatusPill label={`team ${TEAM_ID}`} />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1320px] gap-5 px-5 py-5 sm:px-8 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 border border-black/10 bg-white">
          <div className="flex flex-col gap-3 border-b border-black/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold">Prompt stream</h2>
              <p className="text-sm text-[#666]">Claude Code and Codex CLI prompts appear here as soon as hooks fire.</p>
            </div>
            <div className="flex rounded-md border border-black/10 bg-[#f4f4f1] p-1">
              {(["all", "claude", "codex"] as const).map((source) => (
                <button
                  key={source}
                  onClick={() => setSourceFilter(source)}
                  className={`h-8 rounded px-3 text-sm font-medium ${sourceFilter === source ? "bg-white text-black shadow-sm" : "text-[#666] hover:text-black"}`}
                >
                  {source === "all" ? "All" : sourceLabels[source]}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-black/10">
            {filteredEvents.length === 0 ? (
              <div className="grid min-h-[520px] place-items-center px-6 text-center">
                <div>
                  <div className="mx-auto mb-4 size-2 rounded-full bg-emerald-500" />
                  <h3 className="text-lg font-semibold">Waiting for the first prompt</h3>
                  <p className="mt-2 max-w-md text-sm leading-6 text-[#666]">
                    Install Monty on this machine, then submit a prompt in Claude Code or Codex CLI. The feed updates without a refresh.
                  </p>
                </div>
              </div>
            ) : (
              filteredEvents.map((event) => <PromptRow key={event.id} event={event} />)
            )}
          </div>
        </div>

        <aside className="flex flex-col gap-5">
          <div className="border border-black/10 bg-white p-4">
            <h2 className="text-base font-semibold">Install</h2>
            <p className="mt-1 text-sm leading-6 text-[#666]">One command writes both prompt-submit hooks and stores this site URL locally.</p>
            <div className="mt-4 overflow-hidden rounded-md border border-black/10 bg-[#111]">
              <code className="block overflow-x-auto whitespace-nowrap px-3 py-3 font-mono text-xs text-white">{installCommand}</code>
            </div>
            <button onClick={copyInstall} className="mt-3 h-9 w-full rounded-md bg-[#171717] px-3 text-sm font-semibold text-white hover:bg-black">
              {copied ? "Copied" : "Copy install command"}
            </button>
          </div>

          <div className="border border-black/10 bg-white p-4">
            <h2 className="text-base font-semibold">Realtime backend</h2>
            <dl className="mt-3 space-y-3 text-sm">
              <Metric label="Supabase" value={hasBrowserSupabaseConfig() ? "Configured" : "Not configured"} />
              <Metric label="Local stream" value="Enabled" />
              <Metric label="Events loaded" value={events.length.toString()} />
            </dl>
          </div>

          <div className="border border-black/10 bg-white p-4">
            <h2 className="text-base font-semibold">Manual test</h2>
            <p className="mt-1 text-sm leading-6 text-[#666]">Useful for verifying the feed before opening either AI CLI.</p>
            <code className="mt-4 block whitespace-pre-wrap rounded-md bg-[#f4f4f1] p-3 font-mono text-xs text-[#333]">
              node ./cli/monty.js capture --source test --prompt &quot;Monty realtime smoke test&quot;
            </code>
          </div>
        </aside>
      </section>
    </main>
  );
}

function PromptRow({ event }: { event: PromptEvent }) {
  return (
    <article className="grid gap-3 px-4 py-4 hover:bg-[#fbfbf8] sm:grid-cols-[40px_128px_1fr]">
      <Avatar event={event} />
      <div className="flex items-start gap-3 sm:block">
        <span className="inline-flex rounded bg-[#f0f0ec] px-2 py-1 text-xs font-semibold text-[#333]">{sourceLabels[event.source]}</span>
        <time className="text-xs text-[#777] sm:mt-2 sm:block">{relativeTime(event.created_at)}</time>
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold">{event.user_name}</span>
          <span className="text-[#999]">on</span>
          <span className="font-mono text-xs text-[#666]">{event.machine_id}</span>
          {event.cwd ? <span className="truncate font-mono text-xs text-[#999]">{event.cwd}</span> : null}
        </div>
        <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-6 text-[#222]">{event.prompt}</p>
      </div>
    </article>
  );
}

function Avatar({ event }: { event: PromptEvent }) {
  const initials = initialsFor(event.user_name);
  const avatarUrl = validAvatarUrl(event.avatar_url);

  return (
    <div className="size-9 overflow-hidden rounded-full border border-black/10 bg-[#ecece7]">
      {avatarUrl ? (
        <Image
          src={avatarUrl}
          alt={`${event.user_name} GitHub avatar`}
          width={36}
          height={36}
          className="size-9 object-cover"
        />
      ) : (
        <div className="grid size-9 place-items-center text-xs font-semibold text-[#555]">{initials}</div>
      )}
    </div>
  );
}

function StatusPill({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <span className="inline-flex h-8 items-center gap-2 rounded-md border border-black/10 bg-[#f7f7f4] px-3 text-sm font-medium text-[#444]">
      {active ? <span className="size-2 rounded-full bg-emerald-500" /> : null}
      {label}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-[#666]">{label}</dt>
      <dd className="font-medium">{value}</dd>
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
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}
