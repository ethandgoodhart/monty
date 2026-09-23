"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Line = { t: number; spk: string; text: string };
type Clip = {
  src: string;
  title: string;
  conversation: string;
  duration: number;
  overlap: number;
  turns_per_min: number;
  envA: number[];
  envB: number[];
  envHop: number;
  overlaps: number[][];
  lines: Line[];
};
type Mode = "both" | "A" | "B";

// Iridescent palette the overlap cycles through: sea glass -> violet -> rose -> sandstone gold.
const MAGIC: [number, number, number][] = [
  [34, 193, 195],
  [123, 97, 255],
  [255, 95, 162],
  [255, 181, 71],
];
const A_RGB: [number, number, number] = [14, 143, 163];
const B_RGB: [number, number, number] = [216, 138, 45];

function magic(phase: number, alpha = 1) {
  const p = ((phase % 1) + 1) % 1 * MAGIC.length;
  const i = Math.floor(p), f = p - i;
  const c0 = MAGIC[i], c1 = MAGIC[(i + 1) % MAGIC.length];
  const c = c0.map((v, k) => Math.round(v + (c1[k] - v) * f));
  return `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
}
const rgba = (c: number[], a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

type Spark = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; hue: number };

export function Player({ clips }: { clips: Clip[] }) {
  const [idx, setIdx] = useState(0);
  const [mode, setMode] = useState<Mode>("both");
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const clip = clips[idx];

  const audio = useRef<HTMLAudioElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const graph = useRef<{ ctx: AudioContext; g: Record<string, GainNode> } | null>(null);
  const sparks = useRef<Spark[]>([]);
  const dragging = useRef(false);

  const inOverlap = clip.overlaps.some(([s, e]) => time >= s && time <= e);

  // Route L (A) and R (B) through gains so a listener can solo either speaker.
  const ensureGraph = useCallback(() => {
    if (graph.current || !audio.current) return;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const src = ctx.createMediaElementSource(audio.current);
    const split = ctx.createChannelSplitter(2);
    const merge = ctx.createChannelMerger(2);
    src.connect(split);
    const g: Record<string, GainNode> = {};
    for (const [key, ch, out] of [["AL", 0, 0], ["AR", 0, 1], ["BL", 1, 0], ["BR", 1, 1]] as const) {
      g[key] = ctx.createGain();
      split.connect(g[key], ch);
      g[key].connect(merge, 0, out);
    }
    merge.connect(ctx.destination);
    graph.current = { ctx, g };
  }, []);

  useEffect(() => {
    const G = graph.current;
    if (!G) return;
    const set: Record<Mode, number[]> = { both: [1, 0, 0, 1], A: [1, 1, 0, 0], B: [0, 0, 1, 1] };
    ["AL", "AR", "BL", "BR"].forEach((k, i) =>
      G.g[k].gain.setTargetAtTime(set[mode][i], G.ctx.currentTime, 0.02),
    );
  }, [mode, playing]);

  const toggle = async () => {
    const el = audio.current;
    if (!el) return;
    ensureGraph();
    await graph.current?.ctx.resume();
    if (el.paused) await el.play().catch(() => {});
    else el.pause();
  };

  const pick = (i: number) => {
    if (i === idx) return toggle();
    const wasPlaying = playing;
    setIdx(i);
    setTime(0);
    sparks.current = [];
    requestAnimationFrame(() => {
      const el = audio.current;
      if (el && wasPlaying) el.play().catch(() => {});
    });
  };

  // Keep React time in sync while playing (the canvas reads the element directly every frame).
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (audio.current) setTime(audio.current.currentTime);
      raf = requestAnimationFrame(tick);
    };
    if (playing) raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  // ---------- Canvas: two mirrored voices; where they overlap, the light bends. ----------
  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0, W = 0, H = 0, dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = cv.clientWidth;
      H = cv.clientHeight;
      cv.width = W * dpr;
      cv.height = H * dpr;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(cv);

    const draw = (now: number) => {
      const ctx = cv.getContext("2d")!;
      const t = now / 1000;
      const cur = audio.current?.currentTime ?? 0;
      const dur = clip.duration;
      const cy = H / 2, amp = H * 0.4;
      const step = W < 560 ? 3 : 4, barW = step - 1.25;
      const cols = Math.floor(W / step);
      const perCol = clip.envA.length / cols;
      const colT = (c: number) => ((c + 0.5) / cols) * dur;
      const ovAt = (tt: number) => clip.overlaps.some(([s, e]) => tt >= s - 0.03 && tt <= e + 0.03);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      // Aurora behind each overlap region.
      for (const [s, e] of clip.overlaps) {
        const x0 = (s / dur) * W, x1 = (e / dur) * W, xc = (x0 + x1) / 2;
        const played = cur >= s;
        const active = cur >= s && cur <= e;
        const breathe = reduced ? 1 : 0.85 + 0.15 * Math.sin(t * 2.2 + xc * 0.05);
        const rx = Math.max(30, (x1 - x0) * 1.1 + 26) * (active ? 1.6 : 1);
        const g = ctx.createRadialGradient(xc, cy, 0, xc, cy, rx);
        const a = (active ? 0.6 : played ? 0.32 : 0.2) * breathe;
        g.addColorStop(0, magic(xc / W + t * 0.05, a));
        g.addColorStop(0.55, magic(xc / W + t * 0.05 + 0.3, a * 0.35));
        g.addColorStop(1, magic(0, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(xc, cy, rx, amp * 0.95, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Centerline
      ctx.fillStyle = "rgba(14,26,31,0.08)";
      ctx.fillRect(0, cy - 0.5, W, 1);

      for (let c = 0; c < cols; c++) {
        const i0 = Math.floor(c * perCol), i1 = Math.max(i0 + 1, Math.floor((c + 1) * perCol));
        let a = 0, b = 0;
        for (let i = i0; i < i1 && i < clip.envA.length; i++) {
          a = Math.max(a, clip.envA[i]);
          b = Math.max(b, clip.envB[i]);
        }
        const x = c * step;
        const tt = colT(c);
        const played = tt <= cur;
        const ha = Math.max(1.5, a * amp), hb = Math.max(1.5, b * amp);
        if (ovAt(tt) && a > 0.05 && b > 0.05) {
          const ph = c / cols * 1.6 + (reduced ? 0 : t * 0.35);
          const alpha = played ? 1 : 0.75;
          const grad = ctx.createLinearGradient(0, cy - ha, 0, cy + hb);
          grad.addColorStop(0, magic(ph, alpha));
          grad.addColorStop(0.5, magic(ph + 0.33, alpha));
          grad.addColorStop(1, magic(ph + 0.66, alpha));
          ctx.save();
          ctx.shadowColor = magic(ph + 0.2, played ? 0.9 : 0.4);
          ctx.shadowBlur = played ? 18 : 10;
          ctx.fillStyle = grad;
          roundBar(ctx, x, cy - ha, barW, ha + hb);
          ctx.restore();
        } else {
          ctx.fillStyle = rgba(A_RGB, played ? 0.95 : 0.34);
          roundBar(ctx, x, cy - ha - 1, barW, ha);
          ctx.fillStyle = rgba(B_RGB, played ? 0.95 : 0.34);
          roundBar(ctx, x, cy + 1, barW, hb);
        }
      }

      // Sparkles: born at the playhead whenever both voices are live.
      const px = (cur / dur) * W;
      const live = !audio.current?.paused && ovAt(cur);
      if (!reduced) {
        if (live) {
          for (let k = 0; k < 3; k++) {
            const up = Math.random() < 0.5 ? -1 : 1;
            sparks.current.push({
              x: px + (Math.random() - 0.5) * 6, y: cy + up * Math.random() * amp * 0.7,
              vx: (Math.random() - 0.3) * 40, vy: up * (20 + Math.random() * 50),
              life: 0, max: 0.8 + Math.random() * 0.9, size: 1.5 + Math.random() * 3.2, hue: Math.random(),
            });
          }
        }
        // A few ambient twinkles over overlap regions, so the magic is visible before you press play.
        if (Math.random() < 0.18 && clip.overlaps.length) {
          const [s, e] = clip.overlaps[Math.floor(Math.random() * clip.overlaps.length)];
          sparks.current.push({
            x: (((s + e) / 2) / dur) * W + (Math.random() - 0.5) * 14, y: cy + (Math.random() - 0.5) * amp * 1.1,
            vx: 0, vy: -8 - Math.random() * 10, life: 0, max: 1 + Math.random(), size: 1 + Math.random() * 2, hue: Math.random(),
          });
        }
        const dt = 1 / 60;
        sparks.current = sparks.current.filter((p) => (p.life += dt) < p.max);
        for (const p of sparks.current) {
          p.x += p.vx * dt; p.y += p.vy * dt; p.vy *= 0.985;
          const k = p.life / p.max;
          const a = Math.sin(Math.PI * k);
          star(ctx, p.x, p.y, p.size * (1 - k * 0.4), magic(p.hue + t * 0.1, a), t * 2 + p.hue * 6);
        }
      }

      // Playhead
      ctx.save();
      if (live) {
        ctx.shadowColor = magic(t * 0.3, 0.9);
        ctx.shadowBlur = 16;
      }
      ctx.fillStyle = live ? magic(t * 0.3) : "rgba(14,26,31,0.85)";
      ctx.fillRect(px - 0.75, 6, 1.5, H - 12);
      ctx.beginPath();
      ctx.arc(px, 6, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [clip]);

  const seekFrom = (e: React.PointerEvent) => {
    const el = audio.current, cv = canvas.current;
    if (!el || !cv) return;
    const r = cv.getBoundingClientRect();
    el.currentTime = Math.min(clip.duration - 0.05, Math.max(0, ((e.clientX - r.left) / r.width) * clip.duration));
    setTime(el.currentTime);
  };

  const caption = (spk: string) => {
    const ls = clip.lines.filter((l) => l.spk === spk && l.t <= time + 0.15);
    const l = ls[ls.length - 1];
    return l && time - l.t < 5 ? l : null;
  };
  const capA = caption("A"), capB = caption("B");

  return (
    <div className="pl">
      <audio
        ref={audio}
        src={clip.src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
      <div className="pl-head">
        <button className={`pl-play ${playing ? "is-on" : ""}`} onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
          {playing ? (
            <svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
          ) : (
            <svg viewBox="0 0 24 24"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.2-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" /></svg>
          )}
        </button>
        <div className="pl-title">
          <span className="pl-num">{String(idx + 1).padStart(2, "0")} / {String(clips.length).padStart(2, "0")}</span>
          <h3>{clip.title}</h3>
          <p>from “{clip.conversation}”</p>
        </div>
        <div className="pl-modes" role="group" aria-label="Listen to">
          {(["both", "A", "B"] as Mode[]).map((m) => (
            <button key={m} className={mode === m ? "is-on" : ""} data-m={m} onClick={() => setMode(m)}>
              {m === "both" ? "A + B" : `Only ${m}`}
            </button>
          ))}
        </div>
      </div>

      <div className="pl-vis">
        <span className="pl-lane pl-lane-a">A</span>
        <span className="pl-lane pl-lane-b">B</span>
        <canvas
          ref={canvas}
          onPointerDown={(e) => { dragging.current = true; (e.target as Element).setPointerCapture(e.pointerId); seekFrom(e); }}
          onPointerMove={(e) => dragging.current && seekFrom(e)}
          onPointerUp={() => (dragging.current = false)}
          aria-label="Waveforms of both speakers; drag to seek"
        />
      </div>

      <div className="pl-meta">
        <span className="pl-time">{fmt(time)} / {fmt(clip.duration)}</span>
        <span className="pl-key"><i className="dot-a" /> Speaker A</span>
        <span className="pl-key"><i className="dot-b" /> Speaker B</span>
        <span className={`pl-key pl-key-magic ${inOverlap && playing ? "is-live" : ""}`}>
          <i className="dot-m" /> Both talking · {(clip.overlap * 100).toFixed(0)}% of this clip
        </span>
      </div>

      <div className="pl-caps">
        <p className={`pl-cap pl-cap-a ${capA ? "" : "is-idle"} ${mode === "B" ? "is-muted" : ""}`}>
          <b>A</b> {capA?.text ?? (time < 0.2 ? "Press play: each voice gets its own captions." : "…")}
        </p>
        <p className={`pl-cap pl-cap-b ${capB ? "" : "is-idle"} ${mode === "A" ? "is-muted" : ""}`}>
          <b>B</b> {capB?.text ?? (time < 0.2 ? "Glowing regions are where both talk at once." : "…")}
        </p>
      </div>

      <ol className="pl-list">
        {clips.map((c, i) => (
          <li key={c.src}>
            <button className={i === idx ? "is-on" : ""} onClick={() => pick(i)}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              {c.title}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

function roundBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const r = Math.min(w / 2, h / 2);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, rot: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = r * 4;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const rr = i % 2 ? r * 0.28 : r;
    const a = (i / 8) * Math.PI * 2;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
