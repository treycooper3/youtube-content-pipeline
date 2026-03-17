/**
 * AIShort - Punchy AI-themed YouTube Short
 *
 * 15-second vertical short with fast cuts, flash transitions,
 * SFX hits, and particle effects. No video clip needed.
 *
 * Dimensions: 1080 x 1920 (9:16)
 * Duration: 15 seconds at 30fps = 450 frames
 */

import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";

export const aiShortSchema = z.object({
  logoUrl: z.string().default(""),
  primaryColor: z.string().default("#FFD700"),
  secondaryColor: z.string().default("#1a1a2e"),
  accentColor: z.string().default("#00D4FF"),
  textColor: z.string().default("#FFFFFF"),
  channelName: z.string().default("Stay Starving"),
  fontFamily: z
    .string()
    .default("'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"),
});

export type AIShortProps = z.infer<typeof aiShortSchema>;

const seededRandom = (seed: number): number => {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
};

/**
 * Particles — faster, more energetic for short format
 */
const Particles: React.FC<{
  count: number;
  color1: string;
  color2: string;
}> = ({ count, color1, color2 }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const particles = React.useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: seededRandom(i * 3 + 1) * width,
        y: seededRandom(i * 3 + 2) * height,
        size: 1 + seededRandom(i * 5) * 4,
        speed: 0.5 + seededRandom(i * 7) * 2,
        color: seededRandom(i * 13) > 0.5 ? color1 : color2,
        angle: seededRandom(i * 17) * Math.PI * 2,
      })),
    [count, width, height, color1, color2]
  );

  return (
    <>
      {particles.map((p, i) => {
        const t = frame * p.speed * 0.025;
        const px = (p.x + Math.cos(p.angle) * t * 100 + width) % width;
        const py = (p.y + Math.sin(p.angle) * t * 60 + height) % height;
        const twinkle = 0.3 + Math.sin(frame * 0.15 + i) * 0.7;
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
              opacity: twinkle * 0.7,
              boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
            }}
          />
        );
      })}
    </>
  );
};

/**
 * Flash transition — white flash on cut
 */
const FlashCut: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 2, 6], [0, 1, 0], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#FFFFFF",
        opacity,
        zIndex: 100,
        pointerEvents: "none",
      }}
    />
  );
};

/**
 * Slam text — single big word that slams in with scale overshoot
 */
const SlamText: React.FC<{
  text: string;
  color: string;
  fontSize?: number;
  fontFamily: string;
  glowColor?: string;
}> = ({ text, color, fontSize = 100, fontFamily, glowColor }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slam = spring({
    frame,
    fps,
    config: { damping: 8, stiffness: 200, mass: 0.6 },
  });
  const scale = interpolate(slam, [0, 1], [3, 1]);
  const opacity = interpolate(slam, [0, 0.3], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Subtle shake after slam
  const shake =
    frame > 4 && frame < 12
      ? Math.sin(frame * 8) * (12 - frame) * 0.5
      : 0;

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          fontFamily,
          fontSize,
          fontWeight: 900,
          color,
          opacity,
          transform: `scale(${scale}) translateX(${shake}px)`,
          textAlign: "center",
          lineHeight: 1.1,
          textShadow: glowColor
            ? `0 0 40px ${glowColor}, 0 0 80px ${glowColor}50`
            : "none",
          padding: "0 40px",
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

/**
 * Zoom text — scales up continuously for urgency
 */
const ZoomText: React.FC<{
  text: string;
  color: string;
  fontSize?: number;
  fontFamily: string;
}> = ({ text, color, fontSize = 80, fontFamily }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 150 },
  });

  // Continuous slow zoom
  const zoom = interpolate(frame, [0, durationInFrames], [1, 1.15], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          fontFamily,
          fontSize,
          fontWeight: 800,
          color,
          opacity: entrance,
          transform: `scale(${entrance * zoom})`,
          textAlign: "center",
          lineHeight: 1.2,
          padding: "0 60px",
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

/**
 * Counter that ticks up rapidly
 */
const TickCounter: React.FC<{
  target: number;
  suffix: string;
  label: string;
  color: string;
  accentColor: string;
  fontFamily: string;
}> = ({ target, suffix, label, color, accentColor, fontFamily }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const progress = interpolate(frame, [0, Math.min(fps * 1.5, durationInFrames)], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Ease-out curve for the counter
  const eased = 1 - Math.pow(1 - progress, 3);
  const current = Math.floor(eased * target);

  const entrance = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        opacity: entrance,
        transform: `scale(${interpolate(entrance, [0, 1], [0.8, 1])})`,
      }}
    >
      <div
        style={{
          fontFamily,
          fontSize: 130,
          fontWeight: 900,
          color: accentColor,
          lineHeight: 1,
          textShadow: `0 0 30px ${accentColor}40`,
        }}
      >
        {current}{suffix}
      </div>
      <div
        style={{
          fontFamily,
          fontSize: 30,
          fontWeight: 500,
          color,
          marginTop: 20,
          opacity: 0.8,
          letterSpacing: 3,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
    </AbsoluteFill>
  );
};

/**
 * Quick logo flash — fast in, fast out
 */
const LogoFlash: React.FC<{
  logoUrl: string;
  primaryColor: string;
}> = ({ logoUrl, primaryColor }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const resolvedLogo =
    logoUrl || staticFile("logos/AD81705B-6AB9-45BA-8E20-569F9F148837_1_105_c.jpeg");

  const entrance = spring({
    frame,
    fps,
    config: { damping: 8, stiffness: 180 },
  });

  const exit = interpolate(
    frame,
    [durationInFrames - 8, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: exit,
      }}
    >
      <Img
        src={resolvedLogo}
        style={{
          width: 280,
          height: 280,
          objectFit: "contain",
          transform: `scale(${entrance})`,
          borderRadius: 30,
          boxShadow: `0 0 60px ${primaryColor}40`,
        }}
        onError={() => {}}
      />
    </AbsoluteFill>
  );
};

/**
 * CTA — compact end card
 */
const QuickCTA: React.FC<{
  channelName: string;
  primaryColor: string;
  textColor: string;
  fontFamily: string;
}> = ({ channelName, primaryColor, textColor, fontFamily }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    config: { damping: 10, stiffness: 150 },
  });

  const pulse = interpolate(
    frame % 30,
    [0, 8, 30],
    [1, 1.08, 1],
    { extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 30,
        opacity: entrance,
      }}
    >
      <div
        style={{
          fontFamily,
          fontSize: 52,
          fontWeight: 800,
          color: textColor,
          textAlign: "center",
        }}
      >
        Follow for more
      </div>
      <div
        style={{
          fontFamily,
          fontSize: 36,
          fontWeight: 700,
          color: primaryColor,
          letterSpacing: 4,
        }}
      >
        @{channelName.replace(/\s/g, "")}
      </div>
      <div
        style={{
          backgroundColor: "#FF0000",
          color: textColor,
          fontFamily,
          fontSize: 28,
          fontWeight: 700,
          padding: "14px 50px",
          borderRadius: 10,
          transform: `scale(${pulse})`,
          textTransform: "uppercase",
          letterSpacing: 2,
        }}
      >
        Subscribe
      </div>
    </AbsoluteFill>
  );
};

/**
 * Main AIShort composition
 *
 * Timeline (15 seconds / 450 frames @ 30fps):
 *   0-2s    (0-60):     Logo slam + impact SFX
 *   2-4.5s  (60-135):   "AI ISN'T COMING" slam + whoosh
 *   4.5-7s  (135-210):  "IT'S HERE" slam + impact
 *   7-10s   (210-300):  Counter "300M+" tick up + rise SFX
 *   10-12s  (300-360):  "ARE YOU READY?" zoom + glitch
 *   12-15s  (360-450):  CTA end card
 */
export const AIShort: React.FC<AIShortProps> = ({
  logoUrl = "",
  primaryColor = "#FFD700",
  secondaryColor = "#1a1a2e",
  accentColor = "#00D4FF",
  textColor = "#FFFFFF",
  channelName = "Stay Starving",
  fontFamily = "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
}) => {
  return (
    <AbsoluteFill style={{ backgroundColor: secondaryColor }}>
      {/* Particle background */}
      <AbsoluteFill style={{ opacity: 0.5 }}>
        <Particles count={80} color1={primaryColor} color2={accentColor} />
      </AbsoluteFill>

      {/* === SLIDE 1: Logo (0-2s) === */}
      <Sequence from={0} durationInFrames={60}>
        <LogoFlash logoUrl={logoUrl} primaryColor={primaryColor} />
      </Sequence>
      <Sequence from={0} durationInFrames={10}>
        <Audio src={staticFile("sounds/impact.wav")} volume={0.8} />
      </Sequence>
      <Sequence from={0} durationInFrames={8}>
        <FlashCut />
      </Sequence>

      {/* === SLIDE 2: "AI ISN'T COMING" (2-4.5s) === */}
      <Sequence from={60} durationInFrames={75}>
        <SlamText
          text="AI ISN'T COMING"
          color={textColor}
          fontSize={90}
          fontFamily={fontFamily}
          glowColor={accentColor}
        />
      </Sequence>
      <Sequence from={60} durationInFrames={12}>
        <Audio src={staticFile("sounds/whoosh.wav")} volume={0.6} />
      </Sequence>
      <Sequence from={60} durationInFrames={8}>
        <FlashCut />
      </Sequence>

      {/* === SLIDE 3: "IT'S HERE." (4.5-7s) === */}
      <Sequence from={135} durationInFrames={75}>
        <SlamText
          text="IT'S HERE."
          color={accentColor}
          fontSize={120}
          fontFamily={fontFamily}
          glowColor={accentColor}
        />
      </Sequence>
      <Sequence from={135} durationInFrames={10}>
        <Audio src={staticFile("sounds/impact.wav")} volume={1} />
      </Sequence>
      <Sequence from={135} durationInFrames={8}>
        <FlashCut />
      </Sequence>

      {/* === SLIDE 4: Counter "300M+" (7-10s) === */}
      <Sequence from={210} durationInFrames={90}>
        <TickCounter
          target={300}
          suffix="M+"
          label="people using AI daily"
          color={textColor}
          accentColor={primaryColor}
          fontFamily={fontFamily}
        />
      </Sequence>
      <Sequence from={210} durationInFrames={18}>
        <Audio src={staticFile("sounds/rise.wav")} volume={0.5} />
      </Sequence>

      {/* === SLIDE 5: "ARE YOU READY?" (10-12s) === */}
      <Sequence from={300} durationInFrames={60}>
        <ZoomText
          text="ARE YOU READY?"
          color={primaryColor}
          fontSize={90}
          fontFamily={fontFamily}
        />
      </Sequence>
      <Sequence from={300} durationInFrames={8}>
        <Audio src={staticFile("sounds/glitch.wav")} volume={0.7} />
      </Sequence>
      <Sequence from={300} durationInFrames={8}>
        <FlashCut />
      </Sequence>

      {/* === SLIDE 6: CTA (12-15s) === */}
      <Sequence from={360} durationInFrames={90}>
        <QuickCTA
          channelName={channelName}
          primaryColor={primaryColor}
          textColor={textColor}
          fontFamily={fontFamily}
        />
      </Sequence>
      <Sequence from={360} durationInFrames={12}>
        <Audio src={staticFile("sounds/whoosh.wav")} volume={0.4} />
      </Sequence>
    </AbsoluteFill>
  );
};

export const defaultAIShortProps: AIShortProps = {
  logoUrl: "",
  primaryColor: "#FFD700",
  secondaryColor: "#1a1a2e",
  accentColor: "#00D4FF",
  textColor: "#FFFFFF",
  channelName: "Stay Starving",
  fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
};

export default AIShort;
