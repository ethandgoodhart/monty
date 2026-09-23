"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

// pointcloud.mp4 packs each frame as color (top half) over Depth Anything 3
// disparity (bottom half, white = near). It plays forward then reversed so it loops seamlessly.
const SRC = "/pointcloud.mp4";
const VIDEO_ASPECT = 756 / 392;
const FOV = 38;
const CAM_DIST = 3;
const OVERSCAN = 1.18;

const vertexShader = /* glsl */ `
  uniform sampler2D uTex;
  uniform vec2 uPlane;
  uniform vec2 uCell;
  uniform float uTime;
  uniform float uIntro;
  uniform float uDepth;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uCamDist;
  uniform float uMotion;
  uniform vec2 uFocus;
  uniform vec2 uRange;

  attribute vec2 aUv;
  attribute vec4 aRand;

  varying vec3 vColor;
  varying float vAlpha;

  float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

  void main() {
    vec2 uv = clamp(aUv + (aRand.xy - 0.5) * uCell, 0.0, 1.0);
    vec3 col = texture2D(uTex, vec2(uv.x, 0.503 + uv.y * 0.494)).rgb;
    float d = texture2D(uTex, vec2(uv.x, 0.003 + uv.y * 0.494)).r;
    float lum = luma(col);

    // Unproject: push along z by disparity, then rescale xy so the head-on view matches the frame.
    float z = (d - 0.32) * uDepth;
    vec3 p = vec3((uv - uFocus) * uPlane * (uCamDist - z) / uCamDist, z);

    // Idle shimmer.
    p += vec3(
      sin(uTime * 0.7 + aRand.z * 6.2831),
      cos(uTime * 0.55 + aRand.w * 6.2831),
      sin(uTime * 0.45 + aRand.x * 6.2831) * 2.0
    ) * 0.0022 * uMotion;

    // Intro: points stream in from deep behind the scene, radiating out from the center.
    float delay = length((aUv - uFocus) / uRange) * 0.55 + aRand.z * 0.3;
    float t = clamp((uIntro - delay) / 0.9, 0.0, 1.0);
    float e = 1.0 - pow(1.0 - t, 4.0);
    vec3 from = vec3(p.xy * (0.25 + aRand.w * 0.5), -4.5 - aRand.x * 3.0);
    p = mix(from, p, e);

    // LiDAR-style sweep travelling near -> far every few seconds.
    float cycle = mod(uTime, 7.5) / 7.5;
    float scanPos = mix(1.15, -0.25, cycle);
    float scan = exp(-pow((d - scanPos) / 0.025, 2.0)) * step(0.02, d) * uMotion;

    // Color: slight saturation lift, fade far points into the dark.
    col = mix(vec3(lum), col, 1.18);
    float near = smoothstep(0.0, 0.75, d);
    col *= mix(0.42, 1.08, near);
    col = mix(col, vec3(0.92, 0.97, 1.0), scan * 0.85);

    // Sky reads as a sparse, dim star field.
    float sky = 1.0 - smoothstep(0.015, 0.06, d);
    float keep = mix(1.0, step(0.62, aRand.z) * 0.55, sky);

    // Dissolve the edges of the visible crop.
    vec2 q = abs(aUv - uFocus) * 2.0 / uRange;
    float edge = 1.0 - smoothstep(0.82, 1.0, max(q.x, q.y));

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;

    float persp = uCamDist / max(0.2, -mv.z);
    gl_PointSize = uSize * uPixelRatio * persp
      * (0.5 + lum * 0.75) * mix(0.8, 1.25, near) * mix(0.65, 1.15, aRand.y)
      * (1.0 + scan * 0.9) * mix(1.8, 1.0, e);

    vColor = col;
    vAlpha = keep * edge * e * (0.55 + scan * 0.6);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r2 = dot(c, c);
    float a = (exp(-r2 * 26.0) + exp(-r2 * 7.5) * 0.3) * vAlpha;
    if (a < 0.008) discard;
    gl_FragColor = vec4(vColor * a, a);
  }
`;

export function PointCloud({ className }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: "high-performance" });
    } catch {
      return;
    }
    renderer.setClearColor(0x000000, 1);
    host.appendChild(renderer.domElement);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const video = document.createElement("video");
    video.src = SRC;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "auto";
    video.setAttribute("playsinline", "");
    video.setAttribute("muted", "");

    const texture = new THREE.VideoTexture(video);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 40);
    camera.position.set(0, 0, CAM_DIST);

    const uniforms = {
      uTex: { value: texture },
      uPlane: { value: new THREE.Vector2(1, 1) },
      uCell: { value: new THREE.Vector2(0, 0) },
      uTime: { value: 0 },
      uIntro: { value: reducedMotion ? 2 : 0 },
      uDepth: { value: 1.25 },
      uSize: { value: 2.6 },
      uPixelRatio: { value: 1 },
      uCamDist: { value: CAM_DIST },
      uMotion: { value: reducedMotion ? 0 : 1 },
      uFocus: { value: new THREE.Vector2(0.5, 0.5) },
      uRange: { value: new THREE.Vector2(1, 1) },
    };

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
    });

    let points: THREE.Points | null = null;

    const build = () => {
      const w = host.clientWidth || window.innerWidth;
      const h = host.clientHeight || window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();

      // Cover-fit the frame (plus overscan for camera drift), then only spawn points for the visible crop.
      const visH = 2 * CAM_DIST * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
      const visW = visH * camera.aspect;
      const planeH = Math.max(visH, visW / VIDEO_ASPECT) * OVERSCAN;
      const planeW = planeH * VIDEO_ASPECT;
      const rangeX = Math.min(1, (visW * OVERSCAN * 1.04) / planeW);
      const rangeY = Math.min(1, (visH * OVERSCAN * 1.04) / planeH);

      // Narrow/portrait screens only see a slice of the frame: center it on the cypress + cliff (left third).
      const focusX = THREE.MathUtils.clamp(0.34, rangeX / 2, 1 - rangeX / 2);

      const spacing = w < 720 ? 2.4 : 2.7; // css px between points
      const budget = w < 720 ? 90_000 : 230_000;
      let cols = Math.round(w / spacing);
      let rows = Math.round(h / spacing);
      const scale = Math.min(1, Math.sqrt(budget / (cols * rows)));
      cols = Math.max(2, Math.round(cols * scale));
      rows = Math.max(2, Math.round(rows * scale));

      const count = cols * rows;
      const uv = new Float32Array(count * 2);
      const rand = new Float32Array(count * 4);
      let i = 0;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++, i++) {
          uv[i * 2] = focusX + ((x + 0.5) / cols - 0.5) * rangeX;
          uv[i * 2 + 1] = 0.5 + ((y + 0.5) / rows - 0.5) * rangeY;
          rand[i * 4] = Math.random();
          rand[i * 4 + 1] = Math.random();
          rand[i * 4 + 2] = Math.random();
          rand[i * 4 + 3] = Math.random();
        }
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
      geometry.setAttribute("aUv", new THREE.BufferAttribute(uv, 2));
      geometry.setAttribute("aRand", new THREE.BufferAttribute(rand, 4));

      if (points) {
        points.geometry.dispose();
        points.geometry = geometry;
      } else {
        points = new THREE.Points(geometry, material);
        points.frustumCulled = false;
        scene.add(points);
      }

      uniforms.uPlane.value.set(planeW, planeH);
      uniforms.uCell.value.set(rangeX / cols, rangeY / rows);
      uniforms.uFocus.value.set(focusX, 0.5);
      uniforms.uRange.value.set(rangeX, rangeY);
      uniforms.uPixelRatio.value = dpr;
      // Size tracks on-screen grid spacing (css px); the shader scales by devicePixelRatio.
      uniforms.uSize.value = (h * OVERSCAN * 1.04 / rows) * 1.15;
    };

    build();
    let builtW = host.clientWidth;
    let builtH = host.clientHeight;

    // Mobile browsers resize the viewport height as the URL bar shows/hides; the overscan
    // already covers that, so only regenerate points on real layout changes.
    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        const w = host.clientWidth;
        const h = host.clientHeight;
        if (w === builtW && Math.abs(h - builtH) < builtH * 0.2) return;
        builtW = w;
        builtH = h;
        build();
      }, 120);
    };
    window.addEventListener("resize", onResize);

    const pointer = { x: 0, y: 0 };
    const eased = { x: 0, y: 0 };
    const onPointer = (e: PointerEvent) => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    let started = false;
    const tryPlay = () => video.play().catch(() => {});
    const onFirstFrame = () => {
      started = true;
      host.dataset.ready = "true";
    };
    video.addEventListener("playing", onFirstFrame, { once: true });
    tryPlay();
    // iOS low-power mode can block autoplay; resume on the first touch.
    const onGesture = () => tryPlay();
    window.addEventListener("pointerdown", onGesture, { once: true });

    const clock = new THREE.Clock();
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;
      uniforms.uTime.value = t;
      if (started && !reducedMotion) uniforms.uIntro.value = Math.min(2, uniforms.uIntro.value + dt * 0.55);

      const k = 1 - Math.exp(-dt * 2.2);
      eased.x += (pointer.x - eased.x) * k;
      eased.y += (pointer.y - eased.y) * k;
      const m = uniforms.uMotion.value;
      const yaw = (Math.sin(t * 0.09) * 0.07 + eased.x * 0.11) * m;
      const pitch = (Math.sin(t * 0.063 + 1.3) * 0.035 - eased.y * 0.06) * m;
      camera.position.set(
        CAM_DIST * Math.sin(yaw) * Math.cos(pitch),
        CAM_DIST * Math.sin(pitch),
        CAM_DIST * Math.cos(yaw) * Math.cos(pitch),
      );
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("pointerdown", onGesture);
      video.pause();
      video.removeAttribute("src");
      video.load();
      points?.geometry.dispose();
      material.dispose();
      texture.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={hostRef} className={className} aria-hidden="true" />;
}
