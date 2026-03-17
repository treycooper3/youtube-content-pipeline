/**
 * IntroScene - Branded YouTube Video Intro
 *
 * Animated logo reveal + video title with Stay Starving branding.
 * 3-5 seconds, designed to be prepended to long-form videos.
 *
 * @author WAT Framework
 * @since 2026-02-16
 */

import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";

export const introSceneSchema = z.object({
  title: z.string().default(""),
  subtitle: z.string().optional(),
  logoUrl: z.string().default(""),
  primaryColor: z.string().default("#FFD700"),
  secondaryColor: z.string().default("#1a1a2e"),
  textColor: z.string().default("#FFFFFF"),
  fontFamily: z
    .string()
    .default(
      "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
    ),
});

export type IntroSceneProps = z.infer<typeof introSceneSchema>;

export const IntroScene: React.FC<IntroSceneProps> = ({
  title = "",
  subtitle,
  logoUrl = "",
  primaryColor = "#FFD700",
  secondaryColor = "#1a1a2e",
  textColor = "#FFFFFF",
  fontFamily = "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Resolve logo: use provided URL, or fall back to staticFile
  const resolvedLogo = logoUrl || staticFile("logos/logo.png");

  // Logo scale-in animation
  const logoScale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  // Logo subtle pulse after landing
  const logoPulse = interpolate(
    frame,
    [fps * 1, fps * 1.5, fps * 2],
    [1, 1.05, 1],
    { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
  );

  // Title slide-in from bottom
  const titleEntrance = spring({
    frame: frame - Math.floor(fps * 0.5),
    fps,
    config: { damping: 15, stiffness: 80 },
  });
  const titleY = interpolate(titleEntrance, [0, 1], [40, 0]);
  const titleOpacity = interpolate(titleEntrance, [0, 1], [0, 1]);

  // Subtitle fade
  const subtitleOpacity = spring({
    frame: frame - Math.floor(fps * 1),
    fps,
    config: { damping: 20, stiffness: 60 },
  });

  // Accent line expand
  const lineWidth = interpolate(
    spring({
      frame: frame - Math.floor(fps * 0.8),
      fps,
      config: { damping: 20, stiffness: 80 },
    }),
    [0, 1],
    [0, 200]
  );

  // Exit fade (last 15 frames)
  const exitOpacity = interpolate(
    frame,
    [fps * 3.5, fps * 4],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: secondaryColor,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        opacity: exitOpacity,
      }}
    >
      {/* Intro audio track */}
      <Audio
        src={staticFile("sounds/rise.wav")}
        volume={(f) => {
          // Fade out in the last 0.5 seconds (last fps * 0.5 frames)
          const fadeStartFrame = fps * 3.5;
          return interpolate(
            f,
            [0, fadeStartFrame, fps * 4],
            [1, 1, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );
        }}
      />
      {/* Top accent bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 6,
          backgroundColor: primaryColor,
        }}
      />

      {/* Logo */}
      <Img
        src={resolvedLogo}
        style={{
          width: 200,
          height: 200,
          objectFit: "contain",
          transform: `scale(${logoScale * logoPulse})`,
          marginBottom: 30,
        }}
        onError={() => {}}
      />

      {/* Accent line */}
      <div
        style={{
          width: lineWidth,
          height: 4,
          backgroundColor: primaryColor,
          borderRadius: 2,
          marginBottom: 30,
        }}
      />

      {/* Title */}
      {title && (
        <h1
          style={{
            fontFamily,
            fontSize: 56,
            fontWeight: 700,
            color: textColor,
            margin: 0,
            textAlign: "center",
            maxWidth: "80%",
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
            lineHeight: 1.2,
          }}
        >
          {title}
        </h1>
      )}

      {/* Subtitle */}
      {subtitle && (
        <p
          style={{
            fontFamily,
            fontSize: 28,
            fontWeight: 400,
            color: primaryColor,
            margin: 0,
            marginTop: 16,
            opacity: subtitleOpacity,
            letterSpacing: 4,
            textTransform: "uppercase",
          }}
        >
          {subtitle}
        </p>
      )}

      {/* Bottom accent bar */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 6,
          backgroundColor: primaryColor,
        }}
      />
    </AbsoluteFill>
  );
};

export default IntroScene;
