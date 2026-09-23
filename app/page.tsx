import { Geist_Mono, Instrument_Serif } from "next/font/google";
import Link from "next/link";
import { PointCloud } from "./point-cloud";

const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-serif" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export default function Home() {
  return (
    <main className={`home ${serif.variable} ${mono.variable}`}>
      <PointCloud className="cloud" />
      <div className="shade" aria-hidden="true" />

      <header className="nav">
        <Link className="brand" href="/">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/monty-logo.png" alt="" width={22} height={22} />
          <span>Monterey AI</span>
        </Link>
        <span className="coords">36.5686° N&nbsp;&nbsp;121.9652° W</span>
      </header>

      <section className="hero">
        <h1 className="wordmark">
          Monterey<em>.</em>
        </h1>
        <a className="cta" href="mailto:founders@trymonty.ai">
          <span>Contact us</span>
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.4" />
          </svg>
        </a>
      </section>
    </main>
  );
}
