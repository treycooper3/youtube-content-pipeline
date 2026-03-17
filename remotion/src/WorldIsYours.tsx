import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  random,
} from "remotion";
import { z } from "zod";

export const worldIsYoursSchema = z.object({
  message: z.string(),
});

// Goodyear-style blimp - classic silver airship
const GoodyearBlimp: React.FC<{ frame: number; message: string }> = ({
  frame,
  message,
}) => {
  // Slow, majestic drift from right to left
  const translateX = interpolate(frame, [0, 450], [100, -30], {
    extrapolateRight: "clamp",
  });

  // Gentle floating motion
  const translateY = Math.sin(frame * 0.02) * 15;
  const rotate = Math.sin(frame * 0.015) * 1;

  return (
    <div
      style={{
        position: "absolute",
        top: "18%",
        left: `${translateX}%`,
        transform: `translateY(${translateY}px) rotate(${rotate}deg)`,
        filter: "drop-shadow(0 0 60px rgba(255, 200, 100, 0.3))",
      }}
    >
      <svg width="700" height="350" viewBox="0 0 700 350">
        <defs>
          {/* Classic silver blimp gradient */}
          <linearGradient id="blimpBody" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#e8e8e8" />
            <stop offset="25%" stopColor="#c0c0c0" />
            <stop offset="50%" stopColor="#a0a0a0" />
            <stop offset="75%" stopColor="#808080" />
            <stop offset="100%" stopColor="#505050" />
          </linearGradient>

          {/* Glow effect for LED sign */}
          <filter id="ledGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Ambient light on blimp */}
          <radialGradient id="ambientLight" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="rgba(255,220,180,0.3)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>

          <clipPath id="signClip">
            <rect x="120" y="95" width="380" height="50" rx="3" />
          </clipPath>
        </defs>

        {/* Main blimp envelope - elongated Goodyear shape */}
        <ellipse
          cx="310"
          cy="120"
          rx="280"
          ry="95"
          fill="url(#blimpBody)"
        />

        {/* Highlight on top */}
        <ellipse
          cx="310"
          cy="120"
          rx="280"
          ry="95"
          fill="url(#ambientLight)"
        />

        {/* Tail fins - classic X pattern */}
        <g transform="translate(540, 120)">
          {/* Top fin */}
          <path d="M0,-20 L80,-70 L80,-30 L20,-20 Z" fill="#707070" />
          {/* Bottom fin */}
          <path d="M0,20 L80,70 L80,30 L20,20 Z" fill="#606060" />
          {/* Right fin */}
          <path d="M10,0 L70,-40 L70,40 L10,0 Z" fill="#656565" />
        </g>

        {/* LED Electronic Sign Board */}
        <rect
          x="115"
          y="90"
          width="390"
          height="60"
          rx="5"
          fill="#0a0a0a"
          stroke="#333"
          strokeWidth="2"
        />

        {/* Inner LED panel */}
        <rect
          x="120"
          y="95"
          width="380"
          height="50"
          rx="3"
          fill="#050505"
        />

        {/* Scrolling LED Text */}
        <g clipPath="url(#signClip)">
          <text
            x={310}
            y="132"
            textAnchor="middle"
            fontFamily="Arial Black, Impact, sans-serif"
            fontSize="32"
            fill="#ffcc00"
            filter="url(#ledGlow)"
            fontWeight="bold"
            letterSpacing="6"
          >
            {message}
          </text>
        </g>

        {/* LED dot pattern overlay for realism */}
        <g clipPath="url(#signClip)" opacity="0.1">
          {Array.from({ length: 40 }).map((_, i) =>
            Array.from({ length: 6 }).map((_, j) => (
              <circle
                key={`${i}-${j}`}
                cx={125 + i * 9.5}
                cy={100 + j * 8}
                r="1"
                fill="#ffcc00"
              />
            ))
          )}
        </g>

        {/* Gondola/Cabin */}
        <g transform="translate(260, 215)">
          {/* Support cables */}
          <line x1="0" y1="0" x2="-60" y2="-30" stroke="#444" strokeWidth="2" />
          <line x1="100" y1="0" x2="160" y2="-30" stroke="#444" strokeWidth="2" />
          <line x1="30" y1="0" x2="10" y2="-50" stroke="#444" strokeWidth="2" />
          <line x1="70" y1="0" x2="90" y2="-50" stroke="#444" strokeWidth="2" />

          {/* Cabin body */}
          <rect x="0" y="0" width="100" height="45" rx="8" fill="#2a2a2a" stroke="#444" />
          {/* Windows */}
          <rect x="10" y="8" width="20" height="15" rx="2" fill="#1a3a5a" opacity="0.8" />
          <rect x="40" y="8" width="20" height="15" rx="2" fill="#1a3a5a" opacity="0.8" />
          <rect x="70" y="8" width="20" height="15" rx="2" fill="#1a3a5a" opacity="0.8" />
          {/* Navigation lights */}
          <circle cx="5" cy="40" r="3" fill="#ff0000" opacity="0.9" />
          <circle cx="95" cy="40" r="3" fill="#00ff00" opacity="0.9" />
        </g>

        {/* Blinking lights on blimp */}
        <circle
          cx="50"
          cy="120"
          r="4"
          fill={frame % 30 < 15 ? "#ff3333" : "#330000"}
        />
        <circle
          cx="570"
          cy="120"
          r="4"
          fill={frame % 30 < 15 ? "#ff3333" : "#330000"}
        />
      </svg>
    </div>
  );
};

// Palm tree silhouette
const PalmTree: React.FC<{ x: number; scale: number; sway: number }> = ({
  x,
  scale,
  sway,
}) => {
  const frame = useCurrentFrame();
  const swayAngle = Math.sin(frame * 0.03 + sway) * 3;

  return (
    <svg
      style={{
        position: "absolute",
        bottom: 0,
        left: `${x}%`,
        transform: `scaleX(${scale > 0 ? 1 : -1}) rotate(${swayAngle}deg)`,
        transformOrigin: "bottom center",
      }}
      width={150 * Math.abs(scale)}
      height={300 * Math.abs(scale)}
      viewBox="0 0 100 200"
    >
      {/* Trunk */}
      <path
        d="M45,200 Q48,150 50,100 Q52,150 55,200"
        fill="none"
        stroke="#1a1a1a"
        strokeWidth="8"
      />
      {/* Fronds */}
      <g transform="translate(50, 100)">
        <path d="M0,0 Q-40,-20 -60,10" stroke="#1a1a1a" strokeWidth="3" fill="none" />
        <path d="M0,0 Q-30,-40 -50,-20" stroke="#1a1a1a" strokeWidth="3" fill="none" />
        <path d="M0,0 Q-10,-50 -20,-30" stroke="#1a1a1a" strokeWidth="3" fill="none" />
        <path d="M0,0 Q10,-50 20,-30" stroke="#1a1a1a" strokeWidth="3" fill="none" />
        <path d="M0,0 Q30,-40 50,-20" stroke="#1a1a1a" strokeWidth="3" fill="none" />
        <path d="M0,0 Q40,-20 60,10" stroke="#1a1a1a" strokeWidth="3" fill="none" />
        <path d="M0,0 Q0,-55 5,-35" stroke="#1a1a1a" strokeWidth="3" fill="none" />
      </g>
    </svg>
  );
};

// Star with twinkle
const Star: React.FC<{ x: number; y: number; size: number; seed: number }> = ({
  x,
  y,
  size,
  seed,
}) => {
  const frame = useCurrentFrame();
  const twinkle = interpolate(
    Math.sin(frame * 0.08 + seed * 10),
    [-1, 1],
    [0.2, 1]
  );

  return (
    <div
      style={{
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
        borderRadius: "50%",
        backgroundColor: "#fff",
        opacity: twinkle,
        boxShadow: `0 0 ${size * 3}px rgba(255,255,255,0.8)`,
      }}
    />
  );
};

// Miami skyline
const MiamiSkyline: React.FC = () => {
  const buildings = [
    { x: 0, w: 80, h: 180 },
    { x: 70, w: 50, h: 250 },
    { x: 110, w: 90, h: 200 },
    { x: 190, w: 60, h: 320 },
    { x: 240, w: 100, h: 260 },
    { x: 330, w: 70, h: 220 },
    { x: 390, w: 120, h: 380 },
    { x: 500, w: 60, h: 200 },
    { x: 550, w: 80, h: 300 },
    { x: 620, w: 50, h: 240 },
    { x: 660, w: 100, h: 280 },
    { x: 750, w: 70, h: 350 },
    { x: 810, w: 90, h: 220 },
    { x: 890, w: 60, h: 290 },
    { x: 940, w: 80, h: 240 },
  ];

  return (
    <svg
      style={{ position: "absolute", bottom: 0, width: "100%", height: "45%" }}
      viewBox="0 0 1000 450"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="buildingDark" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1a1a25" />
          <stop offset="100%" stopColor="#0a0a10" />
        </linearGradient>
      </defs>

      {buildings.map((b, i) => (
        <g key={i}>
          <rect
            x={b.x}
            y={450 - b.h}
            width={b.w}
            height={b.h}
            fill="url(#buildingDark)"
          />
          {/* Lit windows */}
          {Array.from({ length: Math.floor(b.h / 25) }).map((_, row) =>
            Array.from({ length: Math.floor(b.w / 12) }).map((_, col) => {
              const isLit = random(`window-${i}-${row}-${col}`) > 0.4;
              const warmth = random(`warmth-${i}-${row}-${col}`);
              return (
                <rect
                  key={`${row}-${col}`}
                  x={b.x + 4 + col * 12}
                  y={450 - b.h + 8 + row * 25}
                  width="6"
                  height="10"
                  fill={isLit ? (warmth > 0.5 ? "#ffe4a0" : "#ffd070") : "#151520"}
                  opacity={isLit ? 0.9 : 0.3}
                />
              );
            })
          )}
        </g>
      ))}
    </svg>
  );
};

// Film grain overlay
const FilmGrain: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' seed='${frame}' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        opacity: 0.04,
        mixBlendMode: "overlay",
        pointerEvents: "none",
      }}
    />
  );
};

export const WorldIsYours: React.FC<z.infer<typeof worldIsYoursSchema>> = ({
  message,
}) => {
  const frame = useCurrentFrame();

  // Cinematic fade in
  const fadeIn = interpolate(frame, [0, 45], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Generate stars
  const stars = Array.from({ length: 80 }).map((_, i) => ({
    x: random(`star-x-${i}`) * 100,
    y: random(`star-y-${i}`) * 45,
    size: random(`star-size-${i}`) * 2 + 1,
    seed: i,
  }));

  return (
    <AbsoluteFill
      style={{
        // Miami night sky - warm purple/magenta tones
        background: `linear-gradient(
          to bottom,
          #0a0812 0%,
          #1a1028 25%,
          #2a1a3a 45%,
          #3a2040 60%,
          #4a2848 75%,
          #2a1a30 100%
        )`,
        opacity: fadeIn,
      }}
    >
      {/* City glow on horizon */}
      <div
        style={{
          position: "absolute",
          bottom: "20%",
          left: 0,
          right: 0,
          height: "30%",
          background: "radial-gradient(ellipse 120% 100% at 50% 100%, rgba(255,150,80,0.15) 0%, transparent 70%)",
        }}
      />

      {/* Stars */}
      {stars.map((star, i) => (
        <Star key={i} {...star} />
      ))}

      {/* Miami skyline */}
      <MiamiSkyline />

      {/* Palm trees silhouettes */}
      <PalmTree x={5} scale={0.8} sway={0} />
      <PalmTree x={12} scale={1} sway={1} />
      <PalmTree x={85} scale={-0.9} sway={2} />
      <PalmTree x={92} scale={-0.7} sway={0.5} />

      {/* The iconic Goodyear blimp */}
      <GoodyearBlimp frame={frame} message={message} />

      {/* Vignette effect */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.6) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Film grain for 80s look */}
      <FilmGrain />

      {/* Subtle lens flare from city lights */}
      <div
        style={{
          position: "absolute",
          bottom: "25%",
          left: "45%",
          width: 300,
          height: 100,
          background: "radial-gradient(ellipse, rgba(255,200,100,0.1) 0%, transparent 70%)",
          transform: "rotate(-5deg)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
