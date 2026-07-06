import { NextRequest, NextResponse } from "next/server";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { getServerSupabase } from "@/app/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STALE_MS = 15_000;

function getLidClosed(): boolean | null {
  try {
    const output = execSync(
      "ioreg -r -k AppleClamshellState -d 4 | grep AppleClamshellState | head -1",
      { encoding: "utf8", timeout: 3000 },
    );
    if (output.includes("Yes")) return true;
    if (output.includes("No")) return false;
    return null;
  } catch {
    return null;
  }
}

function getSessionCounts(): { claude: number; codex: number } {
  let claude = 0;
  let codex = 0;
  try { claude = parseInt(execSync("pgrep -x claude 2>/dev/null | wc -l", { encoding: "utf8", timeout: 2000 }).trim(), 10) || 0; } catch {}
  try { codex = parseInt(execSync("pgrep -x codex 2>/dev/null | wc -l", { encoding: "utf8", timeout: 2000 }).trim(), 10) || 0; } catch {}
  return { claude, codex };
}

function getLocalUserName(): string {
  try {
    const config = JSON.parse(
      readFileSync(join(homedir(), ".monty", "config.json"), "utf8"),
    );
    return config.userName || "unknown";
  } catch {
    return "unknown";
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || !body.user_name) {
    return NextResponse.json({ error: "user_name required" }, { status: 400 });
  }

  const supabase = getServerSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "no database" }, { status: 500 });
  }

  const { error } = await supabase.from("presence").upsert(
    {
      user_name: body.user_name,
      team_id: body.team_id || "default",
      lid_closed: body.lid_closed ?? false,
      claude_sessions: body.sessions?.claude ?? 0,
      codex_sessions: body.sessions?.codex ?? 0,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_name" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const localUser = getLocalUserName();
  const localLid = getLidClosed();

  const users: Record<string, { lid_closed: boolean; sessions: { claude: number; codex: number } }> = {};

  if (localLid !== null) {
    users[localUser] = {
      lid_closed: localLid,
      sessions: getSessionCounts(),
    };
  }

  const supabase = getServerSupabase();
  if (supabase) {
    const { data } = await supabase.from("presence").select("*");
    if (data) {
      const now = Date.now();
      for (const row of data) {
        if (localLid !== null && row.user_name === localUser) continue;
        const age = now - new Date(row.updated_at).getTime();
        if (age > STALE_MS) {
          users[row.user_name] = { lid_closed: true, sessions: { claude: 0, codex: 0 } };
        } else {
          users[row.user_name] = {
            lid_closed: row.lid_closed,
            sessions: { claude: row.claude_sessions, codex: row.codex_sessions },
          };
        }
      }
    }
  }

  return NextResponse.json({ users });
}
