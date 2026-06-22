"use client";

import { Canvas, useFrame, ThreeEvent } from "@react-three/fiber";
import { useGLTF, useAnimations } from "@react-three/drei";
import { Suspense, useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";

const Z_CAM = 100;
const SX = Z_CAM / Math.sqrt(2);
const SY = Z_CAM / Math.sqrt(6);

function isoToWorld(x: number, z: number): [number, number] {
  return [1000 + (x - z) * SX, 1000 + (x + z) * SY];
}

interface Waypoint {
  pos: [number, number];
  angle: number;
}

const INITIAL_WAYPOINTS: Waypoint[] = [
  { pos: [3.897, 0.802], angle: -1.777 },
  { pos: [5.999, -0.577], angle: -2.914 },
];

const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

function DraggableDot({
  waypoint,
  color,
  onDragPos,
  onDragAngle,
}: {
  waypoint: Waypoint;
  color: string;
  onDragPos: (pos: [number, number]) => void;
  onDragAngle: (angle: number) => void;
}) {
  const draggingPos = useRef(false);
  const draggingAngle = useRef(false);

  const handleX = waypoint.pos[0] + Math.sin(waypoint.angle) * 0.8;
  const handleZ = waypoint.pos[1] + Math.cos(waypoint.angle) * 0.8;

  return (
    <group renderOrder={999}>
      <mesh
        renderOrder={999}
        position={[waypoint.pos[0], 0.5, waypoint.pos[1]]}
        onPointerDown={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          draggingPos.current = true;
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e: ThreeEvent<PointerEvent>) => {
          if (!draggingPos.current) return;
          e.stopPropagation();
          const hit = new THREE.Vector3();
          e.ray.intersectPlane(groundPlane, hit);
          onDragPos([hit.x, hit.z]);
        }}
        onPointerUp={() => { draggingPos.current = false; }}
      >
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshBasicMaterial color={color} depthTest={false} depthWrite={false} />
      </mesh>
      <line renderOrder={998}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([
              waypoint.pos[0], 0.5, waypoint.pos[1],
              handleX, 0.5, handleZ,
            ]), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color="white" linewidth={2} depthTest={false} depthWrite={false} />
      </line>
      <mesh
        renderOrder={999}
        position={[handleX, 0.5, handleZ]}
        onPointerDown={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          draggingAngle.current = true;
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e: ThreeEvent<PointerEvent>) => {
          if (!draggingAngle.current) return;
          e.stopPropagation();
          const hit = new THREE.Vector3();
          e.ray.intersectPlane(groundPlane, hit);
          const dx = hit.x - waypoint.pos[0];
          const dz = hit.z - waypoint.pos[1];
          onDragAngle(Math.atan2(dx, dz));
        }}
        onPointerUp={() => { draggingAngle.current = false; }}
      >
        <sphereGeometry args={[0.3, 12, 12]} />
        <meshBasicMaterial color="white" depthTest={false} depthWrite={false} />
      </mesh>
    </group>
  );
}

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
  const [waypoints, setWaypoints] = useState(INITIAL_WAYPOINTS);

  const updatePos = useCallback(
    (idx: number) => (pos: [number, number]) => {
      setWaypoints((prev) => {
        const next = [...prev];
        next[idx] = { ...next[idx], pos };
        return next;
      });
    },
    []
  );

  const updateAngle = useCallback(
    (idx: number) => (angle: number) => {
      setWaypoints((prev) => {
        const next = [...prev];
        next[idx] = { ...next[idx], angle };
        return next;
      });
    },
    []
  );

  useEffect(() => {
    const data = waypoints.map((w, i) => ({
      index: i,
      pos3D: [+w.pos[0].toFixed(3), +w.pos[1].toFixed(3)],
      worldPixel: isoToWorld(w.pos[0], w.pos[1]).map((v) => Math.round(v)),
      angleDeg: +((w.angle * 180) / Math.PI).toFixed(1),
      angleRad: +w.angle.toFixed(3),
    }));
    fetch("/api/save-waypoints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data, null, 2),
    }).catch(() => {});
  }, [waypoints]);

  return (
    <Canvas
      gl={{ alpha: true, antialias: true }}
      style={{ width: "100%", height: "100%", pointerEvents: "auto" }}
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
        <Character waypoints={waypoints} />
      </Suspense>
      <DraggableDot waypoint={waypoints[0]} color="green" onDragPos={updatePos(0)} onDragAngle={updateAngle(0)} />
      <DraggableDot waypoint={waypoints[1]} color="orange" onDragPos={updatePos(1)} onDragAngle={updateAngle(1)} />
    </Canvas>
  );
}
