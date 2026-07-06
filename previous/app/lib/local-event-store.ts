import { EventEmitter } from "node:events";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizePromptEvent, type PromptEvent, type PromptEventInput } from "@/app/lib/prompt-events";

type StoreState = {
  emitter: EventEmitter;
  events: PromptEvent[];
  loaded: boolean;
};

const globalForStore = globalThis as typeof globalThis & {
  __montyStore?: StoreState;
};

const store =
  globalForStore.__montyStore ??
  (globalForStore.__montyStore = {
    emitter: new EventEmitter(),
    events: [],
    loaded: false,
  });

const dataDir = path.join(process.cwd(), ".monty-data");
const eventsFile = path.join(dataDir, "events.json");

export async function listLocalEvents(teamId = "default") {
  await loadLocalEvents();
  return store.events
    .filter((event) => event.team_id === teamId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 100);
}

export async function addLocalEvent(input: Partial<PromptEventInput>) {
  await loadLocalEvents();
  const event = normalizePromptEvent(input);
  store.events = [event, ...store.events].slice(0, 500);
  await persistLocalEvents();
  store.emitter.emit("event", event);
  return event;
}

export function onLocalEvent(listener: (event: PromptEvent) => void) {
  store.emitter.on("event", listener);
  return () => store.emitter.off("event", listener);
}

async function loadLocalEvents() {
  if (store.loaded) return;
  store.loaded = true;

  try {
    const raw = await readFile(eventsFile, "utf8");
    const parsed = JSON.parse(raw);
    store.events = Array.isArray(parsed)
      ? parsed.map((item) => normalizePromptEvent(item)).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 500)
      : [];
  } catch {
    store.events = [];
  }
}

async function persistLocalEvents() {
  await mkdir(dataDir, { recursive: true });
  await writeFile(eventsFile, JSON.stringify(store.events, null, 2));
}
