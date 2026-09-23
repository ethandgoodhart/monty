import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter } from "next/font/google";
import Link from "next/link";
import data from "./data.json";
import { Player } from "./player";
import { Schema } from "./schema";
import { Toc } from "./toc";
import "./speech.css";

const sans = Inter({ subsets: ["latin"], variable: "--f-sans" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--f-mono" });

export const metadata: Metadata = {
  title: "Monterey-100K · Monterey AI",
  description:
    "Channel-separated English two-speaker conversations: one isolated 48 kHz track per speaker, human-reviewed, loudness-normalized.",
};

const HF_URL = "#access"; // TODO: Hugging Face dataset URL
const CONTACT = "mailto:founders@trymonty.ai?subject=Monterey-100K%20access";
const SECTIONS: [string, string][] = [
  ["description", "Data description"],
  ["use", "Intended use"],
  ["audio", "Audio metrics"],
  ["dynamics", "Conversational dynamics"],
  ["collection", "Collection method"],
  ["metadata", "Metadata"],
  ["access", "Access"],
];

const s = data.summary;
const D = data.dist;
const T = data.tracks;
const n1 = (x: number) =>
  Math.abs(x) >= 100 ? Math.round(x).toLocaleString() : String(Number(x.toFixed(Math.abs(x) < 10 ? 2 : 1)));

export default function SpeechPage() {
  const snr = [...T].sort((a, b) => b.snr_db - a.snr_db);
  const snrs = T.map((t) => t.snr_db);

  return (
    <div className={`yp ${sans.variable} ${mono.variable}`} id="yp-root">
      <header className="yp-nav">
        <Link href="/" className="yp-logo" aria-label="Monterey AI home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/monterey-mark.svg" alt="" />
        </Link>
        <span className="yp-nav-sep" />
        <span className="yp-nav-title">Monterey-100K</span>
      </header>

      <div className="yp-layout">
        <main className="yp-main">
          <section className="yp-hero">
            <div className="yp-hero-top">
              <div className="yp-hero-row">
                <h1>Monterey-100K</h1>
                <div className="yp-hero-btns">
                  <a className="yp-btn yp-btn-dark" href={CONTACT}>Request access</a>
                  <a className="yp-btn" href={HF_URL}>Download on HuggingFace <span aria-hidden="true">↗</span></a>
                </div>
              </div>
              <p className="yp-sub">Channel-separated English natural two-speaker conversations</p>
              <a className="yp-under" href="#access">Available for commercial model training</a>
            </div>
            <div className="yp-hero-art">
              <Player clips={data.clips} />
            </div>
          </section>

          <div className="yp-stats4">
            <Stat label="Sample rate" value="48" unit="kHz" />
            <Stat label="Median overlap" value={(s.overlap_p50 * 100).toFixed(1)} unit="%" />
            <Stat label="Hours" value="1" unit="hour" />
            <Stat label="Speakers" value={String(s.speakers)} unit="unique" />
          </div>

          <section id="description" className="yp-sec">
            <h2>Data description</h2>
            <p>
              Monterey-100K is a corpus of unscripted two-speaker English conversation, recorded full-duplex. Every
              participant is captured on their own microphone and delivered as a separate, sample-aligned 48 kHz track.
              Nothing is mixed down, diarized or re-synthesized, so overlap, backchannels, laughter and fast hand-offs
              are all preserved on independent signals.
            </p>
            <p>
              A person reviews every conversation before delivery. Consent scripts, personal information, talk about
              the collection itself, third voices and disruptive noise are cut from both channels at the same sample
              position, so the pair never drifts. Each track is then loudness-normalized on its own, so soft and loud
              talkers arrive at the same level with their natural dynamics intact.
            </p>
            <p>
              Statistics on this page are measured on the current preview sample: {s.conversations} conversations,{" "}
              {Math.round(s.minutes)} minutes and {s.tracks} speaker tracks. Contact us about the full corpus, custom
              collection and licensing.
            </p>
            <div className="yp-table">
              <div className="yp-tr yp-th"><span>Detail</span><span>Value</span></div>
              <Row k="Speakers per recording">2</Row>
              <Row k="Channels">Dual (one file per speaker), plus a stereo L/R file</Row>
              <Row k="Audio format"><code>.wav</code> <code>.flac</code></Row>
              <Row k="Sample rate"><code>48 kHz</code></Row>
              <Row k="Bit depth"><code>16-bit PCM</code></Row>
              <Row k="Loudness"><code>−23 LUFS</code> speech per track <small>≤ −1 dBTP, no compression</small></Row>
              <Row k="Languages">English (en)</Row>
              <Row k="Metadata format"><code>.md</code> <code>.json</code> <small>UTF-8</small></Row>
              <Row k="Transcription type">ASR, word-level with timings</Row>
              <Row k="Review">Human, every conversation <small>edits logged against source time</small></Row>
            </div>
          </section>

          <section id="use" className="yp-sec">
            <h2>Intended use</h2>
            <div className="yp-uses">
              <div>
                <svg viewBox="0 0 24 16" className="yp-ico" aria-hidden="true"><rect x="0" y="4" width="24" height="2.4" rx="1.2" fill="#b9b7b0" /><rect x="0" y="9.6" width="24" height="2.4" rx="1.2" fill="#b9b7b0" /><rect x="10.8" y="0" width="2.4" height="16" rx="1.2" fill="var(--accent)" /></svg>
                <h3>Speech-to-speech and full-duplex</h3>
                <p>Both sides as independent signals on one timeline, with overlap, interruptions and turn-taking intact.</p>
              </div>
              <div>
                <svg viewBox="0 0 24 16" className="yp-ico" aria-hidden="true"><circle cx="3" cy="10" r="2" fill="#b9b7b0" /><circle cx="10" cy="12" r="2" fill="#b9b7b0" /><circle cx="19" cy="4" r="2.6" fill="var(--accent)" /></svg>
                <h3>Expressive TTS</h3>
                <p>Spontaneous prosody on clean, isolated 48 kHz tracks, with laughter, fillers, emphasis and hesitation.</p>
              </div>
              <div>
                <svg viewBox="0 0 24 16" className="yp-ico" aria-hidden="true"><rect x="0" y="4" width="2.2" height="8" fill="var(--accent)" /><rect x="4" y="1" width="2.2" height="14" fill="var(--accent)" /><rect x="8" y="5" width="2.2" height="6" fill="var(--accent)" /><rect x="13" y="4" width="11" height="2" fill="#b9b7b0" /><rect x="13" y="8" width="11" height="2" fill="#b9b7b0" /><rect x="13" y="12" width="7" height="2" fill="#b9b7b0" /></svg>
                <h3>Turn-taking and audio understanding</h3>
                <p>Unprompted speech with word-level transcripts, per-speaker voice activity and measured quality.</p>
              </div>
            </div>
          </section>

          <section id="audio" className="yp-sec">
            <h2>Audio metrics</h2>
            <h4>Signal</h4>
            <div className="yp-card">
              <CardHead title="Signal-to-noise by track" tip="Speech level (95th percentile of 50 ms frames inside the speaker's own words) minus the noise floor (10th percentile of all frames)." />
              <div className="yp-rows">
                <div className="yp-rows-h"><span>Track</span><span /><span>SNR</span></div>
                {snr.map((t) => (
                  <div className="yp-rowbar" key={t.conv + t.spk}>
                    <span className="yp-mono">{t.conv.slice(-4)} · {t.spk}</span>
                    <span className="yp-track"><i style={{ width: `${Math.min(100, (t.snr_db / 90) * 100)}%` }} /></span>
                    <span className="yp-num">{t.snr_db.toFixed(0)} dB</span>
                  </div>
                ))}
              </div>
              <Pcts d={{ p5: pctl(snrs, 5), p50: pctl(snrs, 50), p95: pctl(snrs, 95) }} unit="dB" />
            </div>
          </section>

          <section id="dynamics" className="yp-sec">
            <h2 className="yp-h2-sm">Conversational dynamics</h2>
            <div className="yp-grid2">
              <Hist title="Overlap" d={D.overlap_pct} unit="% of voiced time" tip="Per one-minute window: share of voiced time in which both speakers are active (Silero VAD per track, bleed-gated)." />
              <Hist title="Turn-taking gap" d={D.gap_ms} unit="ms" tip={`Silence between one speaker stopping and the other starting, for floor transfers with a gap. ${Math.round(s.fto_overlapping_frac * 100)}% of transfers start in overlap and are not counted here.`} />
              <Hist title="Speech dominance" d={D.dominance} unit="share" tip="Per one-minute window: speaker A's share of total voiced time." />
              <Hist title="Speaking rate" d={D.wpm} unit="words/min" tip="Per speaker and one-minute window: ASR words divided by that speaker's voiced time (windows with at least 10 s of speech)." />
            </div>
            <Hist title="Turns per minute" d={D.turns_per_min} unit="turns/min" wide tip="Per one-minute window: floor transfers between speakers (utterances of at least 0.6 s)." />
          </section>

          <section id="collection" className="yp-sec">
            <h2>Collection method</h2>
            <p>
              Participants join remotely from their own devices and talk through a lightly prompted session, much like a
              call. Each microphone is recorded separately and aligned on a shared timeline. We keep the room character
              of real devices, because it teaches robustness. We remove what a buyer should never have to clean up:
              identifying details, bystanders, off-topic meta talk and disruptive noise.
            </p>
            <div className="yp-table yp-table-cmp">
              <div className="yp-tr yp-th"><span /><span>Typical corpora</span><span>Monterey-100K</span></div>
              <Cmp k="Channels" a="Mixed, or telephone band" b="Each speaker on their own 48 kHz track" />
              <Cmp k="Setting" a="A treated room" b="Real rooms, on participants' own devices" />
              <Cmp k="Conversation" a="An assigned topic or script" b="Light prompts, then free talk" />
              <Cmp k="What you hear" a="Clean turns, little overlap" b="Overlap, quick turns, backchannels, laughter" />
              <Cmp k="Review" a="Automatic filtering" b="Every flag decided by a person" />
            </div>
            <div className="yp-grid2 yp-mt">
              <div className="yp-note">
                <h3>Privacy</h3>
                <p>Participants consent at the start of every session. Personal names and identifying details, other people in the room and any mention of the collection platform are removed from both channels.</p>
              </div>
              <div className="yp-note">
                <h3>Quality assurance</h3>
                <p>Automatic flags (keywords, extra voices, echo and noise) are decided by a person. Cuts snap to the nearest silence with 15 ms fades, and every edit is logged against source time.</p>
              </div>
            </div>
          </section>

          <section id="metadata" className="yp-sec">
            <h2>Metadata</h2>
            <Schema />
          </section>

          <section id="access" className="yp-sec">
            <h2>Access</h2>
            <div className="yp-steps">
              <div><span>01</span><h3>Request</h3><p>Tell us about your model and the hours, speakers and conditions you need.</p></div>
              <div><span>02</span><h3>Review</h3><p>We share full-length samples and agree on scope, exclusivity and licensing.</p></div>
              <div><span>03</span><h3>Delivery</h3><p>WAV or FLAC files and metadata over secure transfer, in the format above.</p></div>
            </div>
            <a className="yp-btn yp-btn-dark yp-mt" href={CONTACT}>Request access</a>
          </section>

          <footer className="yp-foot">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/monterey-mark.svg" alt="" />
            <span>Monterey AI</span>
            <a href="mailto:founders@trymonty.ai">founders@trymonty.ai</a>
          </footer>
        </main>
        <Toc sections={SECTIONS} />
      </div>
    </div>
  );
}

function pctl(v: number[], q: number) {
  const a = [...v].sort((x, y) => x - y);
  const i = (q / 100) * (a.length - 1), lo = Math.floor(i), hi = Math.ceil(i);
  return a[lo] + (a[hi] - a[lo]) * (i - lo);
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div>
      <span className="yp-lbl">{label}</span>
      <b>{value}<small>{unit === "%" ? unit : ` ${unit}`}</small></b>
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return <div className="yp-tr"><span className="yp-dim">{k}</span><span>{children}</span></div>;
}

function Cmp({ k, a, b }: { k: string; a: string; b: string }) {
  return <div className="yp-tr"><span className="yp-lbl">{k}</span><span>{a}</span><span>{b}</span></div>;
}

function CardHead({ title, tip }: { title: string; tip: string }) {
  return (
    <div className="yp-card-h">
      <span>{title}</span>
      <details className="yp-method">
        <summary>method</summary>
        <p>{tip}</p>
      </details>
    </div>
  );
}

function Pcts({ d, unit }: { d: { p5: number; p50: number; p95: number }; unit: string }) {
  return (
    <div className="yp-pcts">
      <div><span>p5</span><b>{n1(d.p5)}</b></div>
      <div className="is-mid"><span>p50</span><b>{n1(d.p50)}</b></div>
      <div><span>p95</span><b>{n1(d.p95)}</b></div>
      <em>{unit}</em>
    </div>
  );
}

type Dist = { n: number; lo: number; hi: number; counts: number[]; p5: number; p50: number; p95: number };

function Hist({ title, d, unit, wide, tip }: { title: string; d: Dist; unit: string; wide?: boolean; tip: string }) {
  const max = Math.max(...d.counts);
  const mid = ((d.p50 - d.lo) / (d.hi - d.lo)) * 100;
  return (
    <div className={`yp-card ${wide ? "yp-wide" : ""}`}>
      <CardHead title={title} tip={`${tip} n = ${d.n}.`} />
      <div className="yp-hist">
        <div className="yp-bars">
          {d.counts.map((c, i) => (
            <i key={i} style={{ height: `${Math.max(1.5, (c / max) * 100)}%` }} />
          ))}
        </div>
        <span className="yp-median" style={{ left: `${mid}%` }} />
      </div>
      <div className="yp-hist-ax"><span>{n1(d.lo)}</span><span>{n1(d.hi)}</span></div>
      <Pcts d={d} unit={unit} />
    </div>
  );
}
