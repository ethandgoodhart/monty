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

type Ball = { x: number; y: number; r: number };
type Layout = { h: number; balls: Ball[]; base: number[] };

// The intro starts points at up to 1.62x their radius, so the canvas extends past the box by this much.
const bleed = (l: Layout) => Math.ceil(l.balls[3].r * 0.7);

// Keep in sync with the .scl height in speech.css, which reserves this height before the script runs.
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
    return { h: base + 104, balls, base: [base, base, base, base] };
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
  return { h: big + 100, balls, base: [top, top, top, big] };
}

const vertexShader = /* glsl */ `
  uniform vec3 uBall[4];
  uniform float uTime;
  uniform float uIntro;
  uniform float uSize;
  uniform float uPx;
  uniform vec2 uTilt;
  uniform vec3 uMouse;
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

    // The Monterey cloud leans toward the pointer.
    float isMain = step(2.5, aBall);
    float yw = uTilt.x * isMain, pt = uTilt.y * isMain;
    q = vec3(cos(yw) * q.x + sin(yw) * q.z, q.y, -sin(yw) * q.x + cos(yw) * q.z);
    q = vec3(q.x, cos(pt) * q.y - sin(pt) * q.z, sin(pt) * q.y + cos(pt) * q.z);

    // Intro: points condense inward from a wide haze.
    float t = clamp((uIntro - aRand.x * 0.7 - aBall * 0.12) / 1.1, 0.0, 1.0);
    float e = 1.0 - pow(1.0 - t, 4.0);
    vec3 p = mix(q * (1.12 + aRand.y * 0.5), q, e);

    // uBall is in css px with y down; the ortho camera has y up.
    vec2 sp = vec2(b.x + p.x * b.z, b.y - p.y * b.z);
    // Dots near the pointer ease aside (uMouse.z fades the effect in and out).
    // Lens-like: displacement grows from zero at the pointer, so no hole opens up (max ~6 px).
    vec2 d = sp - uMouse.xy;
    sp += d * exp(-dot(d, d) / 6400.0) * 0.16 * uMouse.z * isMain;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(sp.x, -sp.y, p.z * b.z, 1.0);

    float near = q.z * 0.5 + 0.5;
    gl_PointSize = uSize * uPx * mix(0.75, 1.3, near) * mix(0.8, 1.15, aRand.z);
    vAlpha = mix(0.22, 0.8, near) * e;
    vMain = isMain;
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
    gl_FragColor = vec4(mix(ink, blue, vMain) * a, a);
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
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: true });
    } catch {
      return;
    }
    renderer.setClearColor(0x000000, 0);
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
      uTilt: { value: new THREE.Vector2() },
      uMouse: { value: new THREE.Vector3(-9999, -9999, 0) },
    };
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      premultipliedAlpha: true,
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
      const m = bleed(l);
      renderer.setSize(w + 2 * m, l.h + 2 * m);
      Object.assign(renderer.domElement.style, { left: `${-m}px`, top: `${-m}px` });
      camera.left = -m;
      camera.right = w + m;
      camera.top = m;
      camera.bottom = -(l.h + m);
      camera.updateProjectionMatrix();
      l.balls.forEach((b, i) => uniforms.uBall.value[i].set(b.x, b.y, b.r));
      uniforms.uPx.value = dpr;
      uniforms.uSize.value = w < 720 ? 1.35 : 1.7;
      setLay(l);
      if (!running) renderer.render(scene, camera);
    };

    // Pointer in chart px; tilt and the push-aside strength are eased toward their targets each frame.
    const ptr = { x: -9999, y: -9999, in: false };
    const tilt = { x: 0, y: 0 };
    let push = 0;
    const onPointer = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      ptr.x = e.clientX - r.left;
      ptr.y = e.clientY - r.top;
      const b = uniforms.uBall.value[3];
      ptr.in = Math.hypot(ptr.x - b.x, ptr.y - b.y) < b.z * 1.25;
    };
    const onLeave = () => (ptr.in = false);
    if (!reduced) {
      window.addEventListener("pointermove", onPointer, { passive: true });
      document.documentElement.addEventListener("pointerleave", onLeave);
    }

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
        if (started) uniforms.uIntro.value = Math.min(3, uniforms.uIntro.value + dt * 1.1);
        const b = uniforms.uBall.value[3];
        const k = 1 - Math.exp(-dt * 1.2);
        const tx = ptr.x < -9000 ? 0 : Math.max(-1, Math.min(1, (ptr.x - b.x) / (b.z * 2.5)));
        const ty = ptr.y < -9000 ? 0 : Math.max(-1, Math.min(1, (ptr.y - b.y) / (b.z * 2.5)));
        tilt.x += (tx * 0.2 - tilt.x) * k;
        tilt.y += (ty * 0.14 - tilt.y) * k;
        push += ((ptr.in ? 1 : 0) - push) * (1 - Math.exp(-dt * 1.5));
        uniforms.uTilt.value.set(tilt.x, tilt.y);
        uniforms.uMouse.value.set(ptr.x, ptr.y, push);
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
      window.removeEventListener("pointermove", onPointer);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div ref={hostRef} className="scl" role="img"
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
