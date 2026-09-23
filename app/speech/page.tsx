import type { Metadata } from "next";
import { Instrument_Serif, Inter, JetBrains_Mono } from "next/font/google";
import Link from "next/link";
import data from "./data.json";
import { Player } from "./player";
import "./speech.css";

const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", variable: "--f-serif" });
const sans = Inter({ subsets: ["latin"], variable: "--f-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--f-mono" });

export const metadata: Metadata = {
  title: "Monterey-100K · Monterey AI",
  description:
    "Channel-separated, full-duplex English conversations. Every speaker on their own 48 kHz track, human-reviewed.",
};

const CONTACT = "mailto:founders@trymonty.ai?subject=Monterey-100K%20access";
const s = data.summary;
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const r = (x: number) => Math.round(x).toLocaleString();

export default function SpeechPage() {
  return (
    <div className={`sp ${serif.variable} ${sans.variable} ${mono.variable}`}>
      <header className="sp-nav">
        <Link className="sp-brand" href="/">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/monty-logo.png" alt="" />
          <span>Monterey AI</span>
        </Link>
        <a className="sp-btn sp-btn-sm" href={CONTACT}>
          Request access
        </a>
      </header>

      <section className="sp-hero">
        <div className="sp-hero-bg" aria-hidden="true" />
        <div className="sp-wrap">
          <p className="sp-eyebrow">Speech dataset · v0 preview</p>
          <h1>
            Monterey<span className="sp-dash">-</span>100K
          </h1>
          <p className="sp-lede">
            Natural two-speaker English conversations, each voice on its own isolated channel, so
            you can hear exactly how people interrupt, overlap and hand off the floor.
          </p>
          <ul className="sp-chips">
            <li>2 isolated channels</li>
            <li>48 kHz · 16-bit WAV</li>
            <li>Word-level transcripts</li>
            <li>Human-reviewed</li>
          </ul>
        </div>
      </section>

      <section className="sp-wrap">
        <Player clips={data.clips} />
      </section>

      <section className="sp-wrap">
        <dl className="sp-stats">
          <div>
            <dt>Overlap</dt>
            <dd>{pct(s.overlap_p50)}</dd>
            <p>median share of voiced time with both speaking</p>
          </div>
          <div>
            <dt>Turn gap</dt>
            <dd>
              {r(s.gap_ms[1])}
              <small>ms</small>
            </dd>
            <p>median silence when the floor changes hands</p>
          </div>
          <div>
            <dt>Speaking rate</dt>
            <dd>
              {r(s.wpm[1])}
              <small>wpm</small>
            </dd>
            <p>fast, casual, unscripted speech</p>
          </div>
          <div>
            <dt>Signal-to-noise</dt>
            <dd>
              {r(s.snr_p50)}
              <small>dB</small>
            </dd>
            <p>median across all tracks</p>
          </div>
        </dl>
      </section>

      <section className="sp-wrap sp-grid2">
        <div className="sp-card">
          <h2>Real turn-taking</h2>
          <p className="sp-sub">
            Time from one speaker stopping to the other starting. {pct(s.fto_overlapping_frac)} of
            hand-offs begin <em>before</em> the other person has finished, the overlap that
            full-duplex models need to learn and that single-channel data erases.
          </p>
          <FtoChart />
        </div>
        <div className="sp-card">
          <h2>Wideband, not telephone</h2>
          <p className="sp-sub">
            Effective bandwidth of every track. {s.full_band_tracks} of {s.tracks} keep content above
            15 kHz. Telephone corpora stop at 3.4 kHz.
          </p>
          <BandwidthChart />
        </div>
      </section>

      <section className="sp-wrap">
        <div className="sp-how">
          <div>
            <h2>How it&apos;s made</h2>
            <ol className="sp-steps">
              <li>
                <b>Remote pairs, open topics.</b> Two people talk freely on their own devices. Each
                microphone is captured separately and the tracks are aligned sample by sample.
              </li>
              <li>
                <b>Every minute reviewed.</b> Reviewers cut consent scripts, personal information,
                talk about the study, third voices and noise from both channels at the same point.
              </li>
              <li>
                <b>Measured, not claimed.</b> Every conversation ships with bandwidth, SNR, bleed,
                overlap and a timestamped transcript.
              </li>
            </ol>
          </div>
          <pre className="sp-tree" aria-label="Delivery layout">
            {`conversations/
└─ conv_20260922_1906/
   ├─ spkA.wav             # speaker A, mono
   ├─ spkB.wav             # speaker B, mono
   ├─ stereo_L-A_R-B.wav   # A left, B right
   └─ INFO.md              # metrics, edits, transcript`}
          </pre>
        </div>
      </section>

      <section className="sp-cta">
        <div className="sp-wrap">
          <h2>Train on how people actually talk.</h2>
          <p>Samples, custom collection and licensing for voice and speech-to-speech teams.</p>
          <a className="sp-btn" href={CONTACT}>
            Request access
          </a>
          <p className="sp-foot">
            Statistics are measured on the v0 preview release ({s.conversations} conversations,{" "}
            {Math.round(s.minutes)} min), with automatic speech detection and transcripts.
          </p>
        </div>
      </section>
    </div>
  );
}

function FtoChart() {
  const { edges, counts } = data.fto_hist;
  const W = 520, H = 200, pad = { l: 8, r: 8, t: 12, b: 34 };
  const max = Math.max(...counts);
  const x0 = edges[0], x1 = edges[edges.length - 1];
  const sx = (v: number) => pad.l + ((v - x0) / (x1 - x0)) * (W - pad.l - pad.r);
  const sy = (c: number) => H - pad.b - (c / max) * (H - pad.t - pad.b);
  return (
    <svg className="sp-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Histogram of turn-transition offsets">
      <defs>
        <linearGradient id="fto-over" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="var(--a)" />
          <stop offset="0.5" stopColor="var(--magic)" />
          <stop offset="1" stopColor="var(--b)" />
        </linearGradient>
      </defs>
      <rect x={sx(x0)} y={pad.t} width={sx(0) - sx(x0)} height={H - pad.t - pad.b} fill="url(#fto-over)" opacity="0.07" rx="6" />
      {counts.map((c, i) => {
        const neg = edges[i + 1] <= 0;
        return (
          <rect
            key={i}
            x={sx(edges[i]) + 1.5}
            y={sy(c)}
            width={sx(edges[i + 1]) - sx(edges[i]) - 3}
            height={H - pad.b - sy(c)}
            rx="2.5"
            fill={neg ? "url(#fto-over)" : "var(--ink-25)"}
          />
        );
      })}
      <line x1={sx(0)} x2={sx(0)} y1={pad.t - 4} y2={H - pad.b + 4} stroke="var(--ink)" strokeWidth="1" strokeDasharray="3 3" />
      {[-1500, -1000, -500, 0, 500, 1000, 1500, 2000, 2500].map((v) => (
        <text key={v} x={sx(v)} y={H - pad.b + 18} textAnchor="middle" className="sp-tick">
          {v === 0 ? "0" : `${v > 0 ? "+" : ""}${v / 1000}s`}
        </text>
      ))}
      <text x={sx(-1400)} y={pad.t + 14} className="sp-lbl sp-lbl-magic">overlapping</text>
      <text x={sx(2450)} y={pad.t + 14} textAnchor="end" className="sp-lbl">gap</text>
    </svg>
  );
}

function BandwidthChart() {
  const tracks = data.conversations.flatMap((c) =>
    c.bandwidth_khz.map((bw, i) => ({ id: `${c.id.slice(-4)}${i ? "B" : "A"}`, bw, spk: i })),
  ).sort((a, b) => b.bw - a.bw);
  const W = 520, rowH = 15, gap = 3.5, pad = { l: 46, r: 12, t: 6, b: 30 };
  const H = pad.t + tracks.length * (rowH + gap) + pad.b;
  const sx = (k: number) => pad.l + (k / 24) * (W - pad.l - pad.r);
  return (
    <svg className="sp-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Effective bandwidth per track">
      <rect x={sx(0)} y={pad.t - 2} width={sx(3.4) - sx(0)} height={H - pad.t - pad.b + 4} fill="var(--ink)" opacity="0.06" />
      {tracks.map((t, i) => {
        const y = pad.t + i * (rowH + gap);
        return (
          <g key={t.id}>
            <text x={pad.l - 8} y={y + rowH - 3.5} textAnchor="end" className="sp-tick">{t.id}</text>
            <rect x={sx(0)} y={y} width={sx(t.bw) - sx(0)} height={rowH} rx="3" fill={t.spk ? "var(--b)" : "var(--a)"} opacity={t.bw >= 15 ? 0.9 : 0.45} />
          </g>
        );
      })}
      <text x={sx(3.4) + 4} y={H - pad.b + 12} className="sp-lbl">← phone</text>
      {[0, 4, 8, 12, 16, 20, 24].map((k) => (
        <text key={k} x={sx(k)} y={H - 8} textAnchor="middle" className="sp-tick">{k} kHz</text>
      ))}
    </svg>
  );
}
