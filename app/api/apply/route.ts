// Receives the Monterey Select application form (/apply) and emails it via Resend.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ApplyBody = {
  subject?: string;
  firm?: string;
  name?: string;
  email?: string;
  phone?: string;
  practice?: string;
  work?: string;
  software?: string;
  screen?: string;
};

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

export async function POST(req: Request) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return Response.json({ error: "Email not configured" }, { status: 500 });
  }

  let body: ApplyBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { subject, firm, name, email, phone, practice, work, software, screen } = body;
  if (!firm || !name || !email || !/.+@.+\..+/.test(email)) {
    return Response.json({ error: "Missing or invalid fields" }, { status: 400 });
  }

  const rows = (
    [
      ["Firm", firm],
      ["Name", name],
      ["Email", email],
      ["Phone", phone],
      ["Practice", practice],
      ["Work process", work],
      ["Software", software],
      ["Screen", screen],
    ] as const
  )
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 14px 6px 0;color:#666;white-space:nowrap">${k}</td>` +
        `<td style="padding:6px 0"><strong>${esc(v)}</strong></td></tr>`,
    )
    .join("");

  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || "Monterey Select <onboarding@resend.dev>",
        to: [process.env.RESEND_TO || "founders@trymonty.ai"],
        reply_to: email,
        subject: subject || `Monterey Select — application — ${firm}`,
        html: `<table style="font:14px/1.5 -apple-system,Segoe UI,sans-serif;border-collapse:collapse">${rows}</table>`,
      }),
    });
  } catch (err) {
    // A malformed key or network failure would otherwise surface as an opaque 500;
    // the form falls back to a mailto link on any non-ok response.
    console.error("Resend request failed", err);
    return Response.json({ error: "Send failed" }, { status: 502 });
  }

  if (!res.ok) {
    console.error("Resend error", res.status, await res.text().catch(() => ""));
    return Response.json({ error: "Send failed" }, { status: 502 });
  }

  return Response.json({ ok: true });
}
