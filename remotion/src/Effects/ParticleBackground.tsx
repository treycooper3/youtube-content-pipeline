/**
 * ParticleBackground - Dynamic Particle Effects
 *
 * Canvas-based particle systems for backgrounds and transitions.
 * Multiple styles: space dust, confetti, bokeh, matrix rain.
 *
 * Uses HTML Canvas for performance (no Three.js dependency required).
 *
 * @author WAT Framework
 * @since 2026-02-17
 */

import React, { useMemo } from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";

const particleStyleEnum = z.enum([
  "space-dust",
  "confetti",
  "bokeh",
  "matrix-rain",
  "rising-particles",
]);

export const particleBackgroundSchema = z.object({
  style: particleStyleEnum.default("space-dust"),
  particleCount: z.number().default(80),
  primaryColor: z.string().default("#FFD700"),
  secondaryColor: z.string().default("#FFFFFF"),
  backgroundColor: z.string().default("#1a1a2e"),
  speed: z.number().default(1),
  opacity: z.number().default(0.8),
});

export type ParticleBackgroundProps = z.infer<typeof particleBackgroundSchema>;

interface Particle {
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
  color: string;
  angle: number;
  rotation: number;
  char?: string;
}

// Seeded random for deterministic particles
const seededRandom = (seed: number): number => {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
};

export const ParticleBackground: React.FC<ParticleBackgroundProps> = ({
  style = "space-dust",
  particleCount = 80,
  primaryColor = "#FFD700",
  secondaryColor = "#FFFFFF",
  backgroundColor = "#1a1a2e",
  speed = 1,
  opacity = 0.8,
}) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  // Generate deterministic particles
  const particles = useMemo<Particle[]>(() => {
    const matrixChars = "01アイウエオカキクケコ";
    return Array.from({ length: particleCount }, (_, i) => ({
      x: seededRandom(i * 3 + 1) * width,
      y: seededRandom(i * 3 + 2) * height,
      size:
        style === "bokeh"
          ? 20 + seededRandom(i * 3 + 3) * 60
          : style === "matrix-rain"
            ? 14 + seededRandom(i * 3 + 3) * 8
            : 1 + seededRandom(i * 3 + 3) * 4,
      speed: (0.5 + seededRandom(i * 7) * 2) * speed,
      opacity: 0.3 + seededRandom(i * 11) * 0.7,
      color: seededRandom(i * 13) > 0.5 ? primaryColor : secondaryColor,
      angle: seededRandom(i * 17) * Math.PI * 2,
      rotation: seededRandom(i * 19) * 360,
      char: matrixChars[Math.floor(seededRandom(i * 23) * matrixChars.length)],
    }));
  }, [particleCount, width, height, primaryColor, secondaryColor, speed, style]);

  // Entrance/exit fade
  const globalOpacity = interpolate(
    frame,
    [0, 15, durationInFrames - 15, durationInFrames],
    [0, opacity, opacity, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const renderParticle = (p: Particle, i: number) => {
    const t = frame * p.speed * 0.02;

    if (style === "space-dust") {
      const px = (p.x + Math.cos(p.angle) * t * 100) % width;
      const py = (p.y + Math.sin(p.angle) * t * 50) % height;
      const twinkle = 0.5 + Math.sin(frame * 0.1 + i) * 0.5;
      return (
        <div
          key={i}
          style={{
            position: "absolute",
            left: px,
            top: py,
            width: p.size,
            height: p.size,
            borderRadius: "50%",
            backgroundColor: p.color,
            opacity: p.opacity * twinkle,
            boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
          }}
        />
      );
    }

    if (style === "confetti") {
      const px = (p.x + Math.sin(t + i) * 30) % width;
      const py = (p.y + frame * p.speed * 2) % height;
      const rot = p.rotation + frame * p.speed * 3;
      return (
        <div
          key={i}
          style={{
            position: "absolute",
            left: px,
            top: py,
            width: p.size * 3,
            height: p.size * 5,
            backgroundColor: p.color,
            opacity: p.opacity,
            transform: `rotate(${rot}deg) rotateX(${rot * 0.5}deg)`,
            borderRadius: 1,
          }}
        />
      );
    }

    if (style === "bokeh") {
      const px = (p.x + Math.sin(t * 0.3 + i) * 20) % width;
      const py = (p.y + Math.cos(t * 0.2 + i) * 15) % height;
      return (
        <div
          key={i}
          style={{
            position: "absolute",
            left: px - p.size / 2,
            top: py - p.size / 2,
            width: p.size,
            height: p.size,
            borderRadius: "50%",
            backgroundColor: "transparent",
            border: `2px solid ${p.color}`,
            opacity: p.opacity * 0.4,
            filter: `blur(${p.size * 0.1}px)`,
          }}
        />
      );
    }

    if (style === "matrix-rain") {
      const col = Math.floor(p.x / 20) * 20;
      const py = (p.y + frame * p.speed * 4) % height;
      const charChange = frame % Math.max(3, Math.floor(seededRandom(i * 31) * 10)) === 0;
      const displayChar = charChange
        ? "01アイウエオ"[Math.floor(seededRandom(frame * i) * 7)]
        : p.char;
      const fadeTail = interpolate(py, [0, height], [1, 0.2]);
      return (
        <div
          key={i}
          style={{
            position: "absolute",
            left: col,
            top: py,
            color: primaryColor,
            fontFamily: "monospace",
            fontSize: p.size,
            opacity: p.opacity * fadeTail,
            textShadow: `0 0 8px ${primaryColor}`,
          }}
        >
          {displayChar}
        </div>
      );
    }

    // rising-particles
    const px = (p.x + Math.sin(t * 0.5 + i) * 30) % width;
    const py = height - ((p.y + frame * p.speed * 1.5) % height);
    const twinkle = 0.5 + Math.sin(frame * 0.08 + i * 2) * 0.5;
    return (
      <div
        key={i}
        style={{
          position: "absolute",
          left: px,
          top: py,
          width: p.size * 2,
          height: p.size * 2,
          borderRadius: "50%",
          backgroundColor: p.color,
          opacity: p.opacity * twinkle,
          boxShadow: `0 0 ${p.size * 4}px ${p.color}`,
        }}
      />
    );
  };

  return (
    <AbsoluteFill
      style={{
        backgroundColor,
        overflow: "hidden",
        opacity: globalOpacity,
      }}
    >
      {particles.map(renderParticle)}
    </AbsoluteFill>
  );
};

export default ParticleBackground;
