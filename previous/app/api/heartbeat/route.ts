import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/app/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEARTBEATS_TABLE = "heartbeats";

export async function POST(request: NextRequest) {
  const token = process.env.MONTY_INGEST_TOKEN;
  if (token) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${token}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const body = await request.json().catch(() => null);
  if (!body || !body.team_id || !body.user_name) {
    return NextResponse.json({ error: "team_id and user_name required" }, { status: 400 });
  }

  const seconds = typeof body.seconds === "number" && Number.isFinite(body.seconds) ? body.seconds : 30;
  const date = body.date || new Date().toISOString().slice(0, 10);

  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "no database" }, { status: 500 });
  }

  const { error } = await supabase.rpc("upsert_heartbeat", {
    p_team_id: body.team_id,
    p_user_name: body.user_name,
    p_date: date,
    p_seconds: seconds,
  });

  if (error) {
    const { data: existing } = await supabase
      .from(HEARTBEATS_TABLE)
      .select("seconds")
      .eq("team_id", body.team_id)
      .eq("user_name", body.user_name)
      .eq("date", date)
      .single();

    const newSeconds = (existing?.seconds || 0) + seconds;
    const { error: fallbackError } = await supabase
      .from(HEARTBEATS_TABLE)
      .upsert(
        { team_id: body.team_id, user_name: body.user_name, date, seconds: newSeconds, updated_at: new Date().toISOString() },
        { onConflict: "team_id,user_name,date" },
      );

    if (fallbackError) {
      return NextResponse.json({ error: fallbackError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}

export async function GET(request: NextRequest) {
  const teamId = request.nextUrl.searchParams.get("team") || "default";
  const from = request.nextUrl.searchParams.get("from");

  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json({ heartbeats: [] });
  }

  let query = supabase
    .from(HEARTBEATS_TABLE)
    .select("*")
    .eq("team_id", teamId)
    .order("date", { ascending: false });

  if (from) {
    query = query.gte("date", from);
  }

  const { data, error } = await query.limit(1000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ heartbeats: data || [] });
}
