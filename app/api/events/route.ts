import { NextRequest, NextResponse } from "next/server";
import { addLocalEvent, listLocalEvents } from "@/app/lib/local-event-store";
import { normalizePromptEvent, PROMPT_EVENTS_TABLE, type PromptEventInput } from "@/app/lib/prompt-events";
import { getServerSupabase } from "@/app/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const teamId = request.nextUrl.searchParams.get("team") || "default";
  const supabase = getServerSupabase();

  if (supabase) {
    const { data, error } = await supabase
      .from(PROMPT_EVENTS_TABLE)
      .select("*")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (!error && data) {
      return NextResponse.json({ events: data.map((event) => normalizePromptEvent(event)) });
    }
  }

  return NextResponse.json({ events: await listLocalEvents(teamId) });
}

export async function POST(request: NextRequest) {
  const token = process.env.MONTY_INGEST_TOKEN;
  if (token) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${token}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const body = (await request.json().catch(() => null)) as Partial<PromptEventInput> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const event = normalizePromptEvent(body);
  if (!event.prompt) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  const supabase = getServerSupabase();
  if (supabase) {
    const { data, error } = await supabase.from(PROMPT_EVENTS_TABLE).insert(event).select("*").single();
    if (!error && data) {
      await addLocalEvent(data);
      return NextResponse.json({ event: normalizePromptEvent(data) }, { status: 201 });
    }

    console.error("Supabase insert failed, falling back to local store:", error);
  }

  return NextResponse.json({ event: await addLocalEvent(event) }, { status: 201 });
}
