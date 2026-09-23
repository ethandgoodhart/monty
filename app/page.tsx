import { Geist_Mono, Instrument_Serif } from "next/font/google";
import Link from "next/link";
import { PointCloud } from "./point-cloud";

const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", variable: "--font-serif" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export default function Home() {
  return (
    <main className={`home ${serif.variable} ${mono.variable}`}>
      <PointCloud className="cloud" />
      <div className="shade" aria-hidden="true" />

      <header className="nav">
        <Link className="brand" href="/">
          Monterey AI
        </Link>
        <span className="location">San Francisco, CA</span>
      </header>

      <section className="hero">
        <h1 className="wordmark">
          Monterey
        </h1>
        <div className="hero-side">
          <Link className="sublink" href="/speech">
            Speech dataset
          </Link>
          <a className="cta" href="mailto:founders@trymonty.ai">
            <span>Contact us</span>
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          </a>
        </div>
      </section>
    </main>
  );
}
