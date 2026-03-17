/**
 * TransitionScene - Cinematic Transitions Between Video Segments
 *
 * Animated transitions for bridging between AI-generated clips,
 * real footage, and Remotion scenes. Multiple styles available.
 *
 * @author WAT Framework
 * @since 2026-02-17
 */

import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";

const transitionStyleEnum = z.enum([
  "fade-black",
  "swipe-left",
  "swipe-right",
  "swipe-up",
  "zoom-in",
  "zoom-out",
  "glitch",
  "slide-reveal",
]);

export const transitionSceneSchema = z.object({
  style: transitionStyleEnum.default("fade-black"),
  primaryColor: z.string().default("#FFD700"),
  secondaryColor: z.string().default("#1a1a2e"),
  direction: z.enum(["in", "out"]).default("in"),
});

export type TransitionSceneProps = z.infer<typeof transitionSceneSchema>;

export const TransitionScene: React.FC<TransitionSceneProps> = ({
  style = "fade-black",
  primaryColor = "#FFD700",
  secondaryColor = "#1a1a2e",
  direction = "in",
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();

  const progress = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 80 },
    durationInFrames,
  });

  const reverseProgress = direction === "out" ? 1 - progress : progress;

  if (style === "fade-black") {
    const opacity = interpolate(
      frame,
      [0, durationInFrames / 2, durationInFrames],
      direction === "in" ? [0, 1, 0] : [1, 0, 1],
      { extrapolateRight: "clamp" }
    );
    return (
      <AbsoluteFill style={{ backgroundColor: secondaryColor, opacity }} />
    );
  }

  if (style === "swipe-left" || style === "swipe-right") {
    const dir = style === "swipe-left" ? -1 : 1;
    const x = interpolate(reverseProgress, [0, 1], [dir * width, 0]);
    return (
      <AbsoluteFill style={{ backgroundColor: secondaryColor }}>
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: primaryColor,
            transform: `translateX(${x}px)`,
          }}
        />
      </AbsoluteFill>
    );
  }

  if (style === "swipe-up") {
    const y = interpolate(reverseProgress, [0, 1], [height, 0]);
    return (
      <AbsoluteFill style={{ backgroundColor: secondaryColor }}>
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: primaryColor,
            transform: `translateY(${y}px)`,
          }}
        />
      </AbsoluteFill>
    );
  }

  if (style === "zoom-in" || style === "zoom-out") {
    const scale = style === "zoom-in"
      ? interpolate(reverseProgress, [0, 1], [0, 20])
      : interpolate(reverseProgress, [0, 1], [20, 0]);
    const opacity = interpolate(reverseProgress, [0, 0.3, 0.7, 1], [0, 1, 1, 0]);
    return (
      <AbsoluteFill
        style={{
          backgroundColor: secondaryColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 100,
            height: 100,
            borderRadius: "50%",
            backgroundColor: primaryColor,
            transform: `scale(${scale})`,
            opacity,
          }}
        />
      </AbsoluteFill>
    );
  }

  if (style === "glitch") {
    const glitchOffset1 = Math.sin(frame * 0.8) * 20 * (1 - reverseProgress);
    const glitchOffset2 = Math.cos(frame * 1.2) * 15 * (1 - reverseProgress);
    const sliceHeight = height / 8;
    const opacity = interpolate(
      frame,
      [0, durationInFrames * 0.3, durationInFrames * 0.7, durationInFrames],
      [0, 1, 1, 0],
      { extrapolateRight: "clamp" }
    );

    return (
      <AbsoluteFill style={{ backgroundColor: secondaryColor, opacity }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              top: i * sliceHeight,
              left: 0,
              width: "100%",
              height: sliceHeight + 1,
              backgroundColor: i % 2 === 0 ? primaryColor : secondaryColor,
              transform: `translateX(${i % 2 === 0 ? glitchOffset1 : glitchOffset2}px)`,
              opacity: 0.8 + Math.random() * 0.2,
            }}
          />
        ))}
      </AbsoluteFill>
    );
  }

  if (style === "slide-reveal") {
    const slideX = interpolate(reverseProgress, [0, 1], [-width, 0]);
    return (
      <AbsoluteFill style={{ overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: primaryColor,
            transform: `translateX(${slideX}px)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: secondaryColor,
            transform: `translateX(${slideX + width * 0.1}px)`,
          }}
        />
      </AbsoluteFill>
    );
  }

  // Default fallback
  return <AbsoluteFill style={{ backgroundColor: secondaryColor }} />;
};

export default TransitionScene;
