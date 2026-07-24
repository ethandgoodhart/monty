"use client";

import Link from "next/link";
import { useState } from "react";
import "./apply.css";

const ENDPOINT = "/api/apply";

const PRACTICE = [
  { value: "advisory", label: "Advisory & client accounting (CAS, fractional CFO, bookkeeping)" },
  { value: "mix", label: "A mix of advisory and tax/audit" },
  { value: "tax", label: "Mostly tax & audit" },
];

const WORK = [
  { value: "clean", label: "Our people do all the accounting" },
  { value: "assist", label: "Some AI suggests, but a person reviews" },
  { value: "ai", label: "AI does most of the work, we just review" },
];

const TOOLS = [
  { value: "qbo", label: "QuickBooks" },
  { value: "xero", label: "Xero" },
  { value: "netsuite", label: "NetSuite" },
  { value: "intacct", label: "Sage Intacct" },
  { value: "mixed", label: "Several / varies by client" },
  { value: "other", label: "Other" },
];

type Verdict = {
  ok: boolean;
  headline: string;
  body: string;
  mailto: string | null;
};

export function ApplyForm() {
  const [verdict, setVerdict] = useState<Verdict | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const firm = String(data.get("firm") || "").trim();
    const name = String(data.get("name") || "").trim();
    const email = String(data.get("email") || "").trim();
    const phone = String(data.get("phone") || "").trim();
    const mix = String(data.get("mix") || "");
    const work = String(data.get("work") || "");
    const tools = String(data.get("tools") || "");

    let ok = true;
    let tag: string;
    let headline: string;
    let body: string;

    if (mix === "tax") {
      ok = false;
      tag = "declined_scope";
      headline = "This cohort is built for advisory-led firms.";
      body =
        "Your practice leans toward tax and audit, which sits outside what this program captures. We’ve saved your details in case that changes.";
    } else if (work === "ai") {
      ok = false;
      tag = "declined_ai_contaminated";
      headline = "You’re further ahead than most.";
      body =
        "AI already runs much of your substantive work, which is great for your firm. But this program captures human-led workflows, so those recordings wouldn’t fit what we collect right now. We’ve saved your details for what comes next.";
    } else {
      ok = true;
      tag = "qualified";
      headline = `Thanks, ${firm}.`;
      body =
        "We’ve got your application and will be in touch with next steps soon." +
        (work === "assist"
          ? " One thing we’d want to confirm: that your people still drive the judgment on the work we’d record."
          : "");
    }

    const subject = `Monterey Select — ${tag} — ${firm}`;

    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          subject,
          firm,
          name,
          email,
          phone,
          practice: mix,
          work,
          software: tools,
          screen: tag,
        }),
      });
      if (!res.ok) throw new Error("send failed");
      setVerdict({ ok, headline, body, mailto: null });
    } catch {
      const lines = [
        `Firm: ${firm}`,
        `Contact: ${name} <${email}>`,
        `Phone: ${phone}`,
        `Practice: ${mix}`,
        `Work process: ${work}`,
        `Software: ${tools}`,
        `Screen: ${tag}`,
      ];
      setVerdict({
        ok,
        headline,
        body,
        mailto: `mailto:founders@trymonty.ai?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`,
      });
    }
  }

  return (
    <div className="apply-root">
      <header className="apply-header">
        <div className="apply-header-in">
          <Link className="apply-brand" href="/">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/monty-logo.png" alt="" width={26} height={26} />
            <span className="apply-wordmark">Monterey Select</span>
          </Link>
        </div>
      </header>

      <main className="apply-main">
        <div className="apply-col">
          <h1 className="apply-title">Apply to the founding cohort.</h1>

          <p className="apply-intro">
            A few quick questions so we don’t waste your time or ours.
          </p>

          {verdict ? (
            <div className={`verdict${verdict.ok ? " ok" : ""}`}>
              {verdict.ok && <div className="vcheck" aria-hidden="true" />}
              <h2 className="vt">{verdict.headline}</h2>
              <p>{verdict.body}</p>
              {verdict.mailto && (
                <a className="mailbtn" href={verdict.mailto}>
                  Send my application →
                </a>
              )}
              <button className="restart" type="button" onClick={() => setVerdict(null)}>
                Start over
              </button>
            </div>
          ) : (
            <>
              <form className="apply-form" onSubmit={handleSubmit}>
                <div className="row2">
                  <div className="field">
                    <label htmlFor="firm">Firm name <span className="req">*</span></label>
                    <input id="firm" name="firm" className="control" type="text" required placeholder="Acme Advisory" autoComplete="organization" />
                  </div>

                  <div className="field">
                    <label htmlFor="name">Your name <span className="req">*</span></label>
                    <input id="name" name="name" className="control" type="text" required placeholder="Jane Doe" autoComplete="name" />
                  </div>
                </div>

                <div className="row2">
                  <div className="field">
                    <label htmlFor="email">Work email <span className="req">*</span></label>
                    <input id="email" name="email" className="control" type="email" required placeholder="jane@acme.com" autoComplete="email" />
                  </div>

                  <div className="field">
                    <label htmlFor="phone">Phone <span className="req">*</span></label>
                    <input id="phone" name="phone" className="control" type="tel" required placeholder="(555) 123-4567" autoComplete="tel" />
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="mix">Your practice is mostly… <span className="req">*</span></label>
                  <select id="mix" name="mix" className="control" required defaultValue="">
                    <option value="" disabled>Select one…</option>
                    {PRACTICE.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="work">How is your day-to-day accounting work done today? <span className="req">*</span></label>
                  <select id="work" name="work" className="control" required defaultValue="">
                    <option value="" disabled>Select one…</option>
                    {WORK.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="tools">What accounting software do your clients mainly run on? <span className="req">*</span></label>
                  <select id="tools" name="tools" className="control" required defaultValue="">
                    <option value="" disabled>Select one…</option>
                    {TOOLS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>

                <button className="btn-submit" type="submit">Submit application</button>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
