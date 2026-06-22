import { NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import { join } from "path";

export async function POST(req: Request) {
  const data = await req.json();
  await writeFile(
    join(process.cwd(), "waypoints.json"),
    JSON.stringify(data, null, 2),
    "utf-8"
  );
  return NextResponse.json({ ok: true });
}
