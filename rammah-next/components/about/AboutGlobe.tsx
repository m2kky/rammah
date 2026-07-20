"use client";

import { useEffect, useRef, useState } from "react";
import createGlobe, { COBEOptions } from "cobe";
import { useMotionValue, useSpring } from "motion/react";
import styles from "./AboutExperience.module.css";

const MOVEMENT_DAMPING = 1400;

const GLOBE_CONFIG: COBEOptions = {
  width: 800,
  height: 800,
  onRender: () => {},
  devicePixelRatio: 2,
  phi: 0,
  theta: 0.3,
  dark: 1, // Set to 1 for dark mode globe
  diffuse: 0.4,
  mapSamples: 16000,
  mapBrightness: 3.2,
  baseColor: [0.1, 0.1, 0.1],
  markerColor: [251 / 255, 100 / 255, 21 / 255],
  glowColor: [0.05, 0.05, 0.05],
  markers: [
    { location: [14.5995, 120.9842], size: 0.03 },
    { location: [19.076, 72.8777], size: 0.1 },
    { location: [23.8103, 90.4125], size: 0.05 },
    { location: [30.0444, 31.2357], size: 0.07 },
    { location: [39.9042, 116.4074], size: 0.08 },
    { location: [-23.5505, -46.6333], size: 0.1 },
    { location: [19.4326, -99.1332], size: 0.1 },
    { location: [40.7128, -74.006], size: 0.1 },
    { location: [34.6937, 135.5022], size: 0.05 },
    { location: [41.0082, 28.9784], size: 0.06 },
  ],
};

export default function AboutGlobe() {
  let phi = 0;
  let width = 0;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerInteracting = useRef<number | null>(null);
  const pointerInteractionMovement = useRef(0);
  const [isVisible, setIsVisible] = useState(false);

  const r = useMotionValue(0);
  const rs = useSpring(r, {
    mass: 1,
    damping: 30,
    stiffness: 100,
  });

  const updatePointerInteraction = (value: number | null) => {
    pointerInteracting.current = value;
    if (canvasRef.current) {
      canvasRef.current.style.cursor = value !== null ? "grabbing" : "grab";
    }
  };

  const updateMovement = (clientX: number) => {
    if (pointerInteracting.current !== null) {
      const delta = clientX - pointerInteracting.current;
      pointerInteractionMovement.current = delta;
      r.set(r.get() + delta / MOVEMENT_DAMPING);
    }
  };

  useEffect(() => {
    const onResize = () => {
      if (canvasRef.current) {
        width = canvasRef.current.offsetWidth;
      }
    };

    window.addEventListener("resize", onResize);
    onResize();

    const globe = createGlobe(canvasRef.current!, {
      ...GLOBE_CONFIG,
      width: width * 2,
      height: width * 2,
      onRender: (state) => {
        if (!pointerInteracting.current) phi += 0.005;
        state.phi = phi + rs.get();
        state.width = width * 2;
        state.height = width * 2;
      },
    });

    setTimeout(() => setIsVisible(true), 100);
    return () => {
      globe.destroy();
      window.removeEventListener("resize", onResize);
    };
  }, [rs]);

  return (
    <canvas
      className={styles.globeCanvas}
      style={{
        opacity: isVisible ? 1 : 0,
        transition: "opacity 0.5s ease",
      }}
      ref={canvasRef}
      onPointerDown={(e) => {
        pointerInteracting.current = e.clientX;
        updatePointerInteraction(e.clientX);
      }}
      onPointerUp={() => updatePointerInteraction(null)}
      onPointerOut={() => updatePointerInteraction(null)}
      onMouseMove={(e) => updateMovement(e.clientX)}
      onTouchMove={(e) => e.touches[0] && updateMovement(e.touches[0].clientX)}
      role="img"
      aria-label="Interactive globe"
    />
  );
}
