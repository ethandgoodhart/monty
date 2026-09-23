"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Line = { t: number; spk: string; text: string };
type Clip = {
  src: string;
  title: string;
  conversation: string;
  duration: number;
  envA: number[];
  envB: number[];
  overlaps: number[][];
  lines: Line[];
};

const ACCENT = [0, 64, 240];
const INK = [38, 35, 35];

export function Player({ clips }: { clips: Clip[] }) {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [on, setOn] = useState({ A: true, B: true });
  const clip = clips[idx];

  const audio = useRef<HTMLAudioElement>(null);
  const graph = useRef<{ ctx: AudioContext; a: GainNode; b: GainNode } | null>(null);
  const resume = useRef(false);

  // Both speakers are mixed to the centre; A and B can be muted independently.
  const ensureGraph = useCallback(() => {
    if (graph.current || !audio.current) return;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const src = ctx.createMediaElementSource(audio.current);
    const split = ctx.createChannelSplitter(2);
    const merge = ctx.createChannelMerger(2);
    const a = ctx.createGain(), b = ctx.createGain();
    src.connect(split);
    split.connect(a, 0);
    split.connect(b, 1);
    for (const g of [a, b]) {
      g.connect(merge, 0, 0);
      g.connect(merge, 0, 1);
    }
    merge.connect(ctx.destination);
    graph.current = { ctx, a, b };
  }, []);

  useEffect(() => {
    const G = graph.current;
    if (!G) return;
    G.a.gain.setTargetAtTime(on.A ? 0.7 : 0, G.ctx.currentTime, 0.015);
    G.b.gain.setTargetAtTime(on.B ? 0.7 : 0, G.ctx.currentTime, 0.015);
  }, [on, playing]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (audio.current) setTime(audio.current.currentTime);
      raf = requestAnimationFrame(tick);
    };
    if (playing) raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const toggle = async () => {
    const el = audio.current;
    if (!el) return;
    ensureGraph();
    await graph.current?.ctx.resume();
    if (el.paused) await el.play().catch(() => {});
    else el.pause();
  };

  const go = (d: number) => {
    resume.current = playing;
    setIdx((i) => (i + d + clips.length) % clips.length);
    setTime(0);
  };

  const seek = (frac: number) => {
    const el = audio.current;
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(clip.duration - 0.05, frac * clip.duration));
    setTime(el.currentTime);
  };

  const cap = (spk: string) => {
    const ls = clip.lines.filter((l) => l.spk === spk && l.t <= time + 0.1);
    const l = ls[ls.length - 1];
    return l && time - l.t < 4.5 ? l.text : "";
  };

  return (
    <div className="pl">
      <audio
        ref={audio}
        src={clip.src}
        preload="metadata"
        onLoadedData={() => {
          if (resume.current) audio.current?.play().catch(() => {});
          resume.current = false;
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
      <div className="pl-top">
        <div>
          <h3>Sample audio</h3>
          <p className="pl-clip">{clip.title}</p>
        </div>
        <div className="pl-nav">
          <button onClick={() => go(-1)} aria-label="Previous sample">
            <svg viewBox="0 0 16 16"><path d="M10 3 5 8l5 5" /></svg>
          </button>
          <span>{String(idx + 1).padStart(2, "0")} / {String(clips.length).padStart(2, "0")}</span>
          <button onClick={() => go(1)} aria-label="Next sample">
            <svg viewBox="0 0 16 16"><path d="m6 3 5 5-5 5" /></svg>
          </button>
        </div>
      </div>

      <div className="pl-ctrl">
        <button className="pl-play" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
          {playing ? (
            <svg viewBox="0 0 16 16"><rect x="4" y="3" width="3" height="10" rx="0.6" /><rect x="9" y="3" width="3" height="10" rx="0.6" /></svg>
          ) : (
            <svg viewBox="0 0 16 16"><path d="M5 3.2v9.6a.6.6 0 0 0 .9.5l7.6-4.8a.6.6 0 0 0 0-1L5.9 2.7a.6.6 0 0 0-.9.5z" /></svg>
          )}
        </button>
        <div
          className="pl-prog"
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={Math.round(clip.duration)}
          aria-valuenow={Math.round(time)}
          tabIndex={0}
          onPointerDown={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            seek((e.clientX - r.left) / r.width);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") seek((time + 5) / clip.duration);
            if (e.key === "ArrowLeft") seek((time - 5) / clip.duration);
          }}
        >
          <i style={{ width: `${(time / clip.duration) * 100}%` }} />
        </div>
        <span className="pl-time">{fmt(playing || time > 0 ? time : clip.duration)}</span>
        {(["A", "B"] as const).map((k) => (
          <button
            key={k}
            className={`pl-chip ${on[k] ? "" : "is-off"}`}
            onClick={() => setOn((o) => ({ ...o, [k]: !o[k] }))}
            aria-pressed={on[k]}
            aria-label={`${on[k] ? "Mute" : "Unmute"} speaker ${k}`}
          >
            <svg viewBox="0 0 16 16">
              <path d="M2.5 6h2.2L8 3.2v9.6L4.7 10H2.5z" />
              {on[k] ? <path d="M10.5 5.5a3.5 3.5 0 0 1 0 5" fill="none" /> : <path d="m10.5 6 3.5 4m0-4-3.5 4" fill="none" />}
            </svg>
            {k}
          </button>
        ))}
      </div>

      {(["A", "B"] as const).map((k) => (
        <div className={`pl-lane ${on[k] ? "" : "is-muted"}`} key={k}>
          <div className="pl-lane-h">
            <span>Speaker {k}</span>
            <span className="pl-cap">{cap(k)}</span>
          </div>
          <Wave
            env={k === "A" ? clip.envA : clip.envB}
            overlaps={clip.overlaps}
            duration={clip.duration}
            progress={time / clip.duration}
            color={k === "A" ? ACCENT : INK}
            onSeek={seek}
          />
        </div>
      ))}
    </div>
  );
}

function Wave({
  env, overlaps, duration, progress, color, onSeek,
}: {
  env: number[]; overlaps: number[][]; duration: number; progress: number; color: number[]; onSeek: (f: number) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [w, setW] = useState(0);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ro = new ResizeObserver(() => setW(cv.clientWidth));
    ro.observe(cv);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const cv = ref.current;
    if (!cv || !w) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const H = cv.clientHeight;
    cv.width = w * dpr;
    cv.height = H * dpr;
    const ctx = cv.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, H);
    const cy = H / 2, step = 3, bw = 1.4, cols = Math.floor(w / step), per = env.length / cols;
    // Faint band where both speakers talk at once.
    ctx.fillStyle = "rgba(0,64,240,0.06)";
    for (const [s, e] of overlaps) ctx.fillRect((s / duration) * w, 0, Math.max(1, ((e - s) / duration) * w), H);
    for (let c = 0; c < cols; c++) {
      let v = 0;
      for (let i = Math.floor(c * per); i < Math.floor((c + 1) * per) && i < env.length; i++) v = Math.max(v, env[i]);
      const played = (c + 0.5) / cols <= progress;
      const h = v < 0.06 ? 1 : Math.max(2, v * (H - 4));
      ctx.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},${played ? 0.95 : 0.4})`;
      ctx.fillRect(c * step, cy - h / 2, bw, h);
    }
  }, [w, env, overlaps, duration, progress, color]);

  return (
    <canvas
      ref={ref}
      className="pl-wave"
      onPointerDown={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        onSeek((e.clientX - r.left) / r.width);
      }}
    />
  );
}

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}
