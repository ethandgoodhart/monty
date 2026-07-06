import { NextRequest, NextResponse } from "next/server";
import { normalizePromptEvent, PROMPT_EVENTS_TABLE, type PromptEventInput } from "@/app/lib/prompt-events";
import { getServerSupabase } from "@/app/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const token = process.env.MONTY_INGEST_TOKEN;
  if (token) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${token}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.events)) {
    return NextResponse.json({ error: "expected { events: [...] }" }, { status: 400 });
  }

  const events = (body.events as Partial<PromptEventInput>[])
    .map((e) => {
      const normalized = normalizePromptEvent(e);
      normalized.metadata.input_tokens = normalized.input_tokens;
      normalized.metadata.output_tokens = normalized.output_tokens;
      const { input_tokens: _i, output_tokens: _o, ...dbEvent } = normalized as Record<string, unknown>;
      return dbEvent;
    })
    .filter((e) => (e as { prompt: string }).prompt || (e as { metadata: { input_tokens: number } }).metadata.input_tokens > 0);

  if (events.length === 0) {
    return NextResponse.json({ inserted: 0 });
  }

  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "no database configured" }, { status: 500 });
  }

  const batchSize = 500;
  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < events.length; i += batchSize) {
    const batch = events.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from(PROMPT_EVENTS_TABLE)
      .upsert(batch, { onConflict: "id" })
      .select("id");

    if (error) {
      console.error("Sync batch error:", JSON.stringify(error));
      console.error("First event keys:", Object.keys(batch[0] || {}));
      skipped += batch.length;
    } else {
      inserted += data?.length ?? 0;
    }
  }

  return NextResponse.json({ inserted, skipped, total: events.length });
}
