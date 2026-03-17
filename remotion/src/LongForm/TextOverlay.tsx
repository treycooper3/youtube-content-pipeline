/**
 * TextOverlay - Animated Text Callout
 *
 * Pop-in text with optional background pill for emphasis,
 * callouts, key points, or section headers.
 *
 * @author WAT Framework
 * @since 2026-02-16
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

export const textOverlaySchema = z.object({
  text: z.string(),
  position: z
    .enum(["top-left", "top-center", "top-right", "center", "bottom-left", "bottom-center", "bottom-right"])
    .default("center"),
  fontSize: z.number().default(48),
  fontWeight: z.number().default(700),
  textColor: z.string().default("#FFFFFF"),
  backgroundColor: z.string().optional(),
  accentColor: z.string().default("#FFD700"),
  animation: z.enum(["pop", "slide-up", "slide-left", "fade"]).default("pop"),
  fontFamily: z
    .string()
    .default(
      "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
    ),
});

export type TextOverlayProps = z.infer<typeof textOverlaySchema>;

const getPositionStyle = (position: string): React.CSSProperties => {
  const base: React.CSSProperties = { position: "absolute" };

  switch (position) {
    case "top-left":
      return { ...base, top: "8%", left: "5%" };
    case "top-center":
      return { ...base, top: "8%", left: "50%", transform: "translateX(-50%)" };
    case "top-right":
      return { ...base, top: "8%", right: "5%" };
    case "center":
      return { ...base, top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
    case "bottom-left":
      return { ...base, bottom: "12%", left: "5%" };
    case "bottom-center":
      return { ...base, bottom: "12%", left: "50%", transform: "translateX(-50%)" };
    case "bottom-right":
      return { ...base, bottom: "12%", right: "5%" };
    default:
      return { ...base, top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  }
};

export const TextOverlay: React.FC<TextOverlayProps> = ({
  text,
  position = "center",
  fontSize = 48,
  fontWeight = 700,
  textColor = "#FFFFFF",
  backgroundColor,
  accentColor = "#FFD700",
  animation = "pop",
  fontFamily = "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Entrance animation based on type
  const entrance = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  // Exit animation (last 0.3 seconds)
  const exitStart = durationInFrames - Math.floor(fps * 0.3);
  const exit = frame >= exitStart
    ? interpolate(frame, [exitStart, durationInFrames], [1, 0], {
        extrapolateRight: "clamp",
      })
    : 1;

  let animStyle: React.CSSProperties = {};

  switch (animation) {
    case "pop":
      animStyle = {
        transform: `scale(${interpolate(entrance, [0, 1], [0.5, 1])})`,
        opacity: entrance * exit,
      };
      break;
    case "slide-up":
      animStyle = {
        transform: `translateY(${interpolate(entrance, [0, 1], [30, 0])}px)`,
        opacity: entrance * exit,
      };
      break;
    case "slide-left":
      animStyle = {
        transform: `translateX(${interpolate(entrance, [0, 1], [50, 0])}px)`,
        opacity: entrance * exit,
      };
      break;
    case "fade":
      animStyle = {
        opacity: entrance * exit,
      };
      break;
  }

  const posStyle = getPositionStyle(position);

  return (
    <AbsoluteFill>
      <div
        style={{
          ...posStyle,
          ...animStyle,
          fontFamily,
          fontSize,
          fontWeight,
          color: textColor,
          textShadow: "0 2px 8px rgba(0,0,0,0.6)",
          ...(backgroundColor
            ? {
                backgroundColor,
                padding: "12px 24px",
                borderRadius: 12,
                backdropFilter: "blur(8px)",
              }
            : {}),
          whiteSpace: "nowrap",
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

export default TextOverlay;
