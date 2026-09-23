"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

// One dot per hour. Every cloud has the same point density, so volume is proportional to hours.
const SETS = [
  { name: "Switchboard", hours: 260, rate: "8 kHz" },
  { name: "Fisher English", hours: 1960, rate: "8 kHz" },
  { name: "Seamless Interaction", hours: 4000, rate: "48 kHz" },
  { name: "Monterey-100K", hours: 100000, rate: "48 kHz" },
];
const CBRT = SETS.map((s) => Math.cbrt(s.hours));
const BG = 0xf4f1ea;

type Ball = { x: number; y: number; r: number };
type Layout = { h: number; balls: Ball[]; base: number[] };

// Balls sit on a shared baseline; on narrow screens the three references go on a row above Monterey.
function layout(w: number): Layout {
  if (w >= 720) {
    const gap = Math.min(56, w * 0.045);
    const k = Math.min(250 / CBRT[3], (w - gap * 4) / (2 * CBRT.reduce((a, b) => a + b, 0)));
    const r = CBRT.map((c) => c * k);
    const total = r.reduce((a, b) => a + 2 * b, 0) + gap * 4;
    const base = 24 + 2 * r[3];
    let x = (w - total) / 2;
    const balls = r.map((ri, i) => {
      if (i === 3) x += gap;
      const b = { x: x + ri, y: base - ri, r: ri };
      x += 2 * ri + gap;
      return b;
    });
    return { h: base + 88, balls, base: [base, base, base, base] };
  }
  const k = Math.min(w * 0.42, 190) / CBRT[3];
  const r = CBRT.map((c) => c * k);
  const gap = 36;
  const rowW = 2 * (r[0] + r[1] + r[2]) + gap * 2;
  const top = 16 + 2 * r[2];
  const big = top + 108 + 2 * r[3];
  let x = (w - rowW) / 2;
  const balls = r.map((ri, i) => {
    if (i === 3) return { x: w / 2, y: big - ri, r: ri };
    const b = { x: x + ri, y: top - ri, r: ri };
    x += 2 * ri + gap;
    return b;
  });
  return { h: big + 88, balls, base: [top, top, top, big] };
}

const vertexShader = /* glsl */ `
  uniform vec3 uBall[4];
  uniform float uTime;
  uniform float uIntro;
  uniform float uSize;
  uniform float uPx;
  attribute vec3 aLocal;
  attribute float aBall;
  attribute vec3 aRand;
  varying float vAlpha;
  varying float vMain;

  void main() {
    int i = int(aBall + 0.5);
    vec3 b = i == 0 ? uBall[0] : i == 1 ? uBall[1] : i == 2 ? uBall[2] : uBall[3];

    float ang = uTime * 0.09 + aBall * 1.7;
    float c = cos(ang), s = sin(ang);
    vec3 q = vec3(c * aLocal.x + s * aLocal.z, aLocal.y, -s * aLocal.x + c * aLocal.z);
    float tc = cos(0.32), ts = sin(0.32);
    q = vec3(q.x, tc * q.y - ts * q.z, ts * q.y + tc * q.z);

    // Intro: points condense inward from a wide haze.
    float t = clamp((uIntro - aRand.x * 0.7 - aBall * 0.12) / 1.1, 0.0, 1.0);
    float e = 1.0 - pow(1.0 - t, 4.0);
    vec3 p = mix(q * (1.6 + aRand.y * 2.2), q, e);

    // uBall is in css px with y down; the ortho camera has y up.
    gl_Position = projectionMatrix * modelViewMatrix * vec4(b.x + p.x * b.z, -(b.y - p.y * b.z), p.z * b.z, 1.0);

    float near = q.z * 0.5 + 0.5;
    gl_PointSize = uSize * uPx * mix(0.75, 1.3, near) * mix(0.8, 1.15, aRand.z);
    vAlpha = mix(0.22, 0.8, near) * e;
    vMain = step(2.5, aBall);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  varying float vAlpha;
  varying float vMain;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float a = smoothstep(0.25, 0.12, dot(c, c)) * vAlpha;
    if (a < 0.01) discard;
    vec3 ink = vec3(0.09, 0.085, 0.08);
    vec3 blue = vec3(0.0, 0.25, 0.94);
    gl_FragColor = vec4(mix(ink, blue, vMain), a);
  }
`;

export function ScaleCloud() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [lay, setLay] = useState<Layout | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      return;
    }
    renderer.setClearColor(BG, 1);
    host.prepend(renderer.domElement);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const total = SETS.reduce((a, s) => a + s.hours, 0);
    const local = new Float32Array(total * 3);
    const ball = new Float32Array(total);
    const rand = new Float32Array(total * 3);
    let n = 0;
    SETS.forEach((s, bi) => {
      for (let j = 0; j < s.hours; j++, n++) {
        // Uniform in the unit ball.
        const u = Math.random() * 2 - 1;
        const th = Math.random() * Math.PI * 2;
        const rr = Math.cbrt(Math.random());
        const sq = Math.sqrt(1 - u * u);
        local.set([rr * sq * Math.cos(th), rr * u, rr * sq * Math.sin(th)], n * 3);
        ball[n] = bi;
        rand.set([Math.random(), Math.random(), Math.random()], n * 3);
      }
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(total * 3), 3));
    geometry.setAttribute("aLocal", new THREE.BufferAttribute(local, 3));
    geometry.setAttribute("aBall", new THREE.BufferAttribute(ball, 1));
    geometry.setAttribute("aRand", new THREE.BufferAttribute(rand, 3));

    const uniforms = {
      uBall: { value: [0, 1, 2, 3].map(() => new THREE.Vector3()) },
      uTime: { value: 0 },
      uIntro: { value: reduced ? 3 : 0 },
      uSize: { value: 1.7 },
      uPx: { value: 1 },
    };
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    const scene = new THREE.Scene();
    scene.add(points);
    const camera = new THREE.OrthographicCamera(0, 1, 0, -1, -2000, 2000);

    const size = () => {
      const w = host.clientWidth;
      const l = layout(w);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, l.h, false);
      camera.right = w;
      camera.bottom = -l.h;
      camera.updateProjectionMatrix();
      l.balls.forEach((b, i) => uniforms.uBall.value[i].set(b.x, b.y, b.r));
      uniforms.uPx.value = dpr;
      uniforms.uSize.value = w < 720 ? 1.35 : 1.7;
      setLay(l);
      if (!running) renderer.render(scene, camera);
    };

    let running = false;
    let started = reduced;
    let raf = 0;
    let last = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (!reduced) {
        uniforms.uTime.value += dt;
        if (started) uniforms.uIntro.value = Math.min(3, uniforms.uIntro.value + dt * 0.7);
      }
      renderer.render(scene, camera);
    };

    const ro = new ResizeObserver(size);
    ro.observe(host);
    size();

    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          started = true;
          if (!running && !reduced) {
            running = true;
            last = performance.now();
            tick();
          }
        } else if (running) {
          running = false;
          cancelAnimationFrame(raf);
        }
      },
      { threshold: 0.2 },
    );
    io.observe(host);
    if (reduced) renderer.render(scene, camera);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div ref={hostRef} className="scl" style={{ height: lay?.h }} role="img"
      aria-label="Point clouds with one dot per hour: Switchboard 260 hours, Fisher English 1,960 hours, Seamless Interaction 4,000 hours, Monterey-100K 100,000 hours.">
      {lay && <span className="scl-base" style={{ top: lay.base[3] }} />}
      {lay && lay.base[0] !== lay.base[3] && <span className="scl-base" style={{ top: lay.base[0] }} />}
      {lay &&
        SETS.map((s, i) => (
          <div
            key={s.name}
            className={`scl-lbl ${i === 3 ? "is-main" : ""}`}
            style={{ left: lay.balls[i].x, top: lay.base[i] + 14 }}
          >
            <b>{s.name}</b>
            <span>{s.hours.toLocaleString()} h</span>
            <em>{s.rate}</em>
          </div>
        ))}
    </div>
  );
}
