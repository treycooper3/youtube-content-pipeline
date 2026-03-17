/**
 * CallToAction - Mid-Video Engagement Overlays
 *
 * Animated CTAs for likes, subscribes, comments, and links.
 * Designed to overlay on top of video content mid-stream.
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

const ctaTypeEnum = z.enum([
  "like-subscribe",
  "link-description",
  "comment-below",
  "custom",
]);

const ctaPositionEnum = z.enum([
  "bottom-left",
  "bottom-center",
  "bottom-right",
  "center",
]);

export const callToActionSchema = z.object({
  type: ctaTypeEnum.default("like-subscribe"),
  customText: z.string().default(""),
  position: ctaPositionEnum.default("bottom-right"),
  primaryColor: z.string().default("#FFD700"),
  backgroundColor: z.string().default("rgba(0, 0, 0, 0.85)"),
  textColor: z.string().default("#FFFFFF"),
  fontFamily: z
    .string()
    .default(
      "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
    ),
});

export type CallToActionProps = z.infer<typeof callToActionSchema>;

const positionStyles: Record<string, React.CSSProperties> = {
  "bottom-left": { bottom: 80, left: 60 },
  "bottom-center": { bottom: 80, left: "50%", transform: "translateX(-50%)" },
  "bottom-right": { bottom: 80, right: 60 },
  center: { top: "50%", left: "50%", transform: "translate(-50%, -50%)" },
};

export const CallToAction: React.FC<CallToActionProps> = ({
  type = "like-subscribe",
  customText = "",
  position = "bottom-right",
  primaryColor = "#FFD700",
  backgroundColor = "rgba(0, 0, 0, 0.85)",
  textColor = "#FFFFFF",
  fontFamily = "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Entrance spring
  const entrance = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  // Exit fade
  const exitOpacity = interpolate(
    frame,
    [durationInFrames - fps * 0.3, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const scale = interpolate(entrance, [0, 1], [0.8, 1]);

  // Pulse for emphasis
  const pulse = interpolate(
    frame % (fps * 2),
    [0, fps * 0.3, fps * 2],
    [1, 1.05, 1],
    { extrapolateRight: "clamp" }
  );

  // Icon bounce
  const iconBounce = interpolate(
    frame % fps,
    [0, fps * 0.15, fps * 0.3],
    [0, -8, 0],
    { extrapolateRight: "clamp" }
  );

  const renderContent = () => {
    if (type === "like-subscribe") {
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span
            style={{
              fontSize: 32,
              transform: `translateY(${iconBounce}px)`,
              display: "inline-block",
            }}
          >
            👍
          </span>
          <span style={{ fontSize: 22, fontWeight: 700, color: textColor }}>
            LIKE
          </span>
          <div
            style={{
              width: 2,
              height: 30,
              backgroundColor: primaryColor,
              margin: "0 4px",
            }}
          />
          <span
            style={{
              fontSize: 32,
              transform: `translateY(${iconBounce}px)`,
              display: "inline-block",
            }}
          >
            🔔
          </span>
          <span style={{ fontSize: 22, fontWeight: 700, color: textColor }}>
            SUBSCRIBE
          </span>
        </div>
      );
    }

    if (type === "link-description") {
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              fontSize: 28,
              transform: `translateY(${iconBounce}px)`,
              display: "inline-block",
            }}
          >
            👇
          </span>
          <span style={{ fontSize: 22, fontWeight: 700, color: textColor }}>
            Link in Description
          </span>
        </div>
      );
    }

    if (type === "comment-below") {
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              fontSize: 28,
              transform: `translateY(${iconBounce}px)`,
              display: "inline-block",
            }}
          >
            💬
          </span>
          <span style={{ fontSize: 22, fontWeight: 700, color: textColor }}>
            Drop a Comment!
          </span>
        </div>
      );
    }

    // custom
    return (
      <span style={{ fontSize: 22, fontWeight: 700, color: textColor }}>
        {customText}
      </span>
    );
  };

  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          ...positionStyles[position],
          backgroundColor,
          padding: "16px 28px",
          borderRadius: 12,
          borderLeft: `4px solid ${primaryColor}`,
          fontFamily,
          transform: `scale(${scale * pulse})`,
          opacity: entrance * exitOpacity,
          backdropFilter: "blur(10px)",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.4)",
        }}
      >
        {renderContent()}
      </div>
    </AbsoluteFill>
  );
};

export default CallToAction;
