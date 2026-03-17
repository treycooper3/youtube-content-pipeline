/**
 * LowerThird - Name/Title Overlay
 *
 * Animated lower-third with name, title, and accent bar.
 * Slides in from left, holds, then slides out.
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

export const lowerThirdSchema = z.object({
  name: z.string(),
  title: z.string().default(""),
  accentColor: z.string().default("#FFD700"),
  backgroundColor: z.string().default("rgba(0, 0, 0, 0.85)"),
  textColor: z.string().default("#FFFFFF"),
  position: z.enum(["left", "right"]).default("left"),
  fontFamily: z
    .string()
    .default(
      "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
    ),
});

export type LowerThirdProps = z.infer<typeof lowerThirdSchema>;

export const LowerThird: React.FC<LowerThirdProps> = ({
  name,
  title = "",
  accentColor = "#FFD700",
  backgroundColor = "rgba(0, 0, 0, 0.85)",
  textColor = "#FFFFFF",
  position = "left",
  fontFamily = "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Slide in animation
  const slideIn = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 80 },
  });

  // Slide out animation (last 0.5 seconds)
  const exitStart = durationInFrames - Math.floor(fps * 0.5);
  const slideOut = frame >= exitStart
    ? interpolate(frame, [exitStart, durationInFrames], [0, 1], {
        extrapolateRight: "clamp",
      })
    : 0;

  // Combined transform
  const isLeft = position === "left";
  const slideInX = interpolate(slideIn, [0, 1], [isLeft ? -400 : 400, 0]);
  const slideOutX = interpolate(slideOut, [0, 1], [0, isLeft ? -400 : 400]);
  const translateX = slideInX + slideOutX;

  // Accent bar width animation
  const barWidth = interpolate(
    spring({
      frame: frame - Math.floor(fps * 0.15),
      fps,
      config: { damping: 20, stiffness: 100 },
    }),
    [0, 1],
    [0, 5]
  );

  // Name text entrance
  const nameOpacity = spring({
    frame: frame - Math.floor(fps * 0.1),
    fps,
    config: { damping: 20, stiffness: 80 },
  });

  // Title text entrance (staggered)
  const titleOpacity = spring({
    frame: frame - Math.floor(fps * 0.25),
    fps,
    config: { damping: 20, stiffness: 80 },
  });

  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          bottom: 100,
          [position]: 60,
          display: "flex",
          flexDirection: "row",
          alignItems: "stretch",
          transform: `translateX(${translateX}px)`,
        }}
      >
        {/* Accent bar */}
        <div
          style={{
            width: barWidth,
            backgroundColor: accentColor,
            borderRadius: 3,
            marginRight: isLeft ? 16 : 0,
            marginLeft: isLeft ? 0 : 16,
            order: isLeft ? 0 : 1,
          }}
        />

        {/* Text container */}
        <div
          style={{
            backgroundColor,
            padding: "16px 28px",
            borderRadius: 8,
            backdropFilter: "blur(10px)",
          }}
        >
          {/* Name */}
          <div
            style={{
              fontFamily,
              fontSize: 32,
              fontWeight: 700,
              color: textColor,
              opacity: nameOpacity,
              lineHeight: 1.2,
            }}
          >
            {name}
          </div>

          {/* Title */}
          {title && (
            <div
              style={{
                fontFamily,
                fontSize: 20,
                fontWeight: 400,
                color: accentColor,
                opacity: titleOpacity,
                marginTop: 4,
                letterSpacing: 1,
              }}
            >
              {title}
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default LowerThird;
