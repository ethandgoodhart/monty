"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations } from "@react-three/drei";
import { Suspense, useEffect, useRef } from "react";
import * as THREE from "three";

interface Waypoint {
  pos: [number, number];
  angle: number;
}

const INITIAL_WAYPOINTS: Waypoint[] = [
  { pos: [3.897, 0.802], angle: -1.777 },
  { pos: [5.999, -0.577], angle: -2.914 },
];

function Character({ waypoints }: { waypoints: Waypoint[] }) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF("/character-walking.glb");
  const { actions } = useAnimations(animations, group);
  const waypointIdx = useRef(0);
  const progress = useRef(0);
  const state = useRef<"walking" | "idle">("idle");
  const idleTimer = useRef(0);
  const idleDuration = useRef(1 + Math.random() * 19);
  const animAction = useRef<THREE.AnimationAction | null>(null);
  const currentAngle = useRef(0);
  const TURN_SPEED = 3;

  function lerpAngle(from: number, to: number, t: number) {
    let diff = to - from;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return from + diff * Math.min(t, 1);
  }

  useEffect(() => {
    if (group.current) {
      group.current.position.set(waypoints[0].pos[0], 0, waypoints[0].pos[1]);
      group.current.rotation.y = waypoints[0].angle;
      currentAngle.current = waypoints[0].angle;
    }
    const name = animations[0]?.name;
    if (name && actions[name]) {
      animAction.current = actions[name];
    }
  }, [actions, animations, waypoints]);

  useFrame((_, delta) => {
    if (!group.current || !animAction.current) return;

    if (state.current === "idle") {
      idleTimer.current += delta;
      animAction.current.paused = true;
      const targetAngle = waypoints[waypointIdx.current].angle;
      currentAngle.current = lerpAngle(currentAngle.current, targetAngle, delta * TURN_SPEED);
      group.current.rotation.y = currentAngle.current;

      if (idleTimer.current >= idleDuration.current) {
        state.current = "walking";
        progress.current = 0;
        animAction.current.paused = false;
        if (!animAction.current.isRunning()) {
          animAction.current.reset().play();
        }
      }
      return;
    }

    const from = waypoints[waypointIdx.current];
    const to = waypoints[(waypointIdx.current + 1) % waypoints.length];

    const dx = to.pos[0] - from.pos[0];
    const dz = to.pos[1] - from.pos[1];
    const dist = Math.sqrt(dx * dx + dz * dz);

    progress.current += (delta * 0.4) / dist;

    if (progress.current >= 1) {
      waypointIdx.current = (waypointIdx.current + 1) % waypoints.length;
      group.current.position.set(
        waypoints[waypointIdx.current].pos[0],
        0,
        waypoints[waypointIdx.current].pos[1]
      );
      state.current = "idle";
      idleTimer.current = 0;
      idleDuration.current = 1 + Math.random() * 19;
      return;
    }

    const t = progress.current;
    const x = from.pos[0] + dx * t;
    const z = from.pos[1] + dz * t;
    group.current.position.set(x, 0, z);

    const targetAngle = Math.atan2(dx, dz);
    currentAngle.current = lerpAngle(currentAngle.current, targetAngle, delta * TURN_SPEED);
    group.current.rotation.y = currentAngle.current;
  });

  return (
    <group ref={group} scale={0.33}>
      <primitive object={scene} />
    </group>
  );
}

export function WalkingCharacter() {
  return (
    <Canvas
      gl={{ alpha: true, antialias: true }}
      style={{ width: "100%", height: "100%", pointerEvents: "none" }}
      orthographic
      camera={{
        position: [10, 10, 10],
        zoom: 100,
        near: 0.1,
        far: 100,
      }}
    >
      <ambientLight intensity={1.5} />
      <directionalLight position={[5, 10, 5]} intensity={1} />
      <Suspense fallback={null}>
        <Character waypoints={INITIAL_WAYPOINTS} />
      </Suspense>
    </Canvas>
  );
}
