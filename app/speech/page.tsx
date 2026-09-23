import type { Metadata } from "next";
import { Geist_Mono, Inter, Instrument_Serif } from "next/font/google";
import Link from "next/link";
import data from "./data.json";
import { Player } from "./player";
import { ScaleCloud } from "./scale";
import { Schema } from "./schema";
import { Toc } from "./toc";
import "./speech.css";

const sans = Inter({ subsets: ["latin"], variable: "--f-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--f-mono" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", variable: "--f-serif" });

export const metadata: Metadata = {
  title: "Monterey-100K",
  description:
    "Channel-separated multilingual two-speaker conversations: one isolated 48 kHz track per speaker, human-reviewed, loudness-normalized.",
};

const HF_URL = "#access"; // TODO: Hugging Face dataset URL
const CONTACT = "mailto:founders@trymonty.ai?subject=Monterey-100K%20access";
const SECTIONS: [string, string][] = [
  ["use", "Intended use"],
  ["description", "Data description"],
  ["dynamics", "Conversational dynamics"],
  ["collection", "Collection method"],
  ["metadata", "Metadata"],
  ["access", "Access"],
];

const s = data.summary;
const D = data.dist;
const n1 = (x: number) =>
  Math.abs(x) >= 100 ? Math.round(x).toLocaleString() : String(Number(x.toFixed(Math.abs(x) < 10 ? 2 : 1)));

export default function SpeechPage() {

  return (
    <div className={`yp ${sans.variable} ${mono.variable} ${serif.variable}`} id="yp-root">
      <header className="yp-nav">
        <Link href="/" className="yp-logo" aria-label="Monterey AI home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/monterey-mark.svg" alt="" />
          <span>Monterey AI</span>
        </Link>
        <span className="yp-nav-sep">/</span>
        <span className="yp-nav-title">Monterey-100K</span>
        <a className="yp-nav-cta" href={CONTACT}>Request access <Arrow /></a>
      </header>

      <div className="yp-layout">
        <main className="yp-main">
          <section className="yp-hero">
            <div className="yp-hero-row">
              <h1>Monterey-100K</h1>
              <div className="yp-hero-btns">
                <a className="yp-btn yp-btn-dark" href={CONTACT}>Request access <Arrow /></a>
                <a className="yp-btn" href={HF_URL}>Download on HuggingFace <span aria-hidden="true">↗</span></a>
              </div>
            </div>
            <p className="yp-sub">The world&rsquo;s largest multilingual 48 kHz channel-separated natural conversation dataset</p>
          </section>

          <section id="scale" className="yp-scale" aria-label="Scale">
            <ScaleCloud />
            <p className="yp-fn">
              One dot = one hour of two-channel conversation. Sources: Switchboard-1 (LDC97S62), Fisher English Parts
              1–2 (LDC2004S13, LDC2005S13), Seamless Interaction (Meta, 2025). The preview measured below is 1 hour.
            </p>
          </section>

          <div className="yp-hero-art">
            <Player clips={data.clips} />
          </div>

          <div className="yp-stats4">
            <Stat label="Sample size" value="1" unit="hour" />
            <Stat label="Sample rate" value="48" unit="kHz" />
            <Stat label="Median overlap" value={(s.overlap_p50 * 100).toFixed(1)} unit="%" />
            <Stat label="Speakers" value={String(s.speakers)} unit="unique" />
          </div>

          <section id="use" className="yp-sec">
            <Head n="01">Intended use</Head>
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

          <section id="description" className="yp-sec">
            <Head n="02">Data description</Head>
            <p>
              Monterey-100K is a corpus of unscripted, multilingual two-speaker conversation, recorded full-duplex. Every
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
              <Row k="Languages">Multilingual <small>(preview sample: English)</small></Row>
              <Row k="Metadata format"><code>.md</code> <code>.json</code> <small>UTF-8</small></Row>
              <Row k="Transcription type">ASR, word-level with timings</Row>
              <Row k="Review">Human, every conversation <small>edits logged against source time</small></Row>
            </div>
          </section>

          <section id="dynamics" className="yp-sec">
            <Head n="03">Conversational dynamics</Head>
            <div className="yp-grid2">
              <Hist title="Overlap" d={D.overlap_pct} unit="% of voiced time" tip="Per one-minute window: share of voiced time in which both speakers are active (Silero VAD per track, bleed-gated)." />
              <Hist title="Turn-taking gap" d={D.gap_ms} unit="ms" tip={`Silence between one speaker stopping and the other starting, for floor transfers with a gap. ${Math.round(s.fto_overlapping_frac * 100)}% of transfers start in overlap and are not counted here.`} />
              <Hist title="Speech dominance" d={D.dominance} unit="share" tip="Per one-minute window: speaker A's share of total voiced time." />
              <Hist title="Speaking rate" d={D.wpm} unit="words/min" tip="Per speaker and one-minute window: ASR words divided by that speaker's voiced time (windows with at least 10 s of speech)." />
            </div>
            <Hist title="Turns per minute" d={D.turns_per_min} unit="turns/min" wide tip="Per one-minute window: floor transfers between speakers (utterances of at least 0.6 s)." />
          </section>

          <section id="collection" className="yp-sec">
            <Head n="04">Collection method</Head>
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
            <Head n="05">Metadata</Head>
            <Schema />
          </section>

          <section id="access" className="yp-sec">
            <Head n="06">Access</Head>
            <div className="yp-steps">
              <div><span>01</span><h3>Request</h3><p>Tell us about your model and the hours, speakers and conditions you need.</p></div>
              <div><span>02</span><h3>Review</h3><p>We share full-length samples and agree on scope, exclusivity and licensing.</p></div>
              <div><span>03</span><h3>Delivery</h3><p>WAV or FLAC files and metadata over secure transfer, in the format above.</p></div>
            </div>
            <a className="yp-btn yp-btn-dark yp-mt" href={CONTACT}>Request access <Arrow /></a>
          </section>

        </main>
        <Toc sections={SECTIONS} />
      </div>

      <footer className="yp-foot">
        <div className="yp-foot-row">
          <span>Monterey AI · San Francisco, CA</span>
          <a href="mailto:founders@trymonty.ai">founders@trymonty.ai</a>
        </div>
        <Link href="/" className="yp-foot-mark">Monterey</Link>
      </footer>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div>
      <span className="yp-lbl">{label}</span>
      <b>{value}<small>{unit === "%" ? unit : ` ${unit}`}</small></b>
    </div>
  );
}

function Head({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <div className="yp-sec-h">
      <span>{n}</span>
      <h2>{children}</h2>
    </div>
  );
}

function Arrow() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
      <path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
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
