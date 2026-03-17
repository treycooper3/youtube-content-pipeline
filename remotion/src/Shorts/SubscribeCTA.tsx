/**
 * SubscribeCTA Component
 *
 * Animated subscribe call-to-action for YouTube Shorts.
 * Features a bouncing bell icon, subscribe text, and pointing arrow.
 *
 * Usage:
 *   <SubscribeCTA channelName="Stay Starving" />
 *
 * @author WAT Framework
 * @since 2026-01-29
 */

import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  Easing,
} from "remotion";
import { z } from "zod";

// Zod schema for props
export const subscribeCTASchema = z.object({
  channelName: z.string().default("Stay Starving"),
  primaryColor: z.string().default("#FF0000"),
  textColor: z.string().default("#FFFFFF"),
  showBell: z.boolean().default(true),
  showArrow: z.boolean().default(true),
  size: z.enum(["small", "medium", "large"]).default("medium"),
});

export type SubscribeCTAProps = z.infer<typeof subscribeCTASchema>;

// Size configurations
const SIZE_CONFIG = {
  small: { scale: 0.7, fontSize: 24, iconSize: 32 },
  medium: { scale: 1, fontSize: 32, iconSize: 48 },
  large: { scale: 1.3, fontSize: 42, iconSize: 64 },
};

/**
 * Bell Icon SVG Component
 */
const BellIcon: React.FC<{ size: number; color: string; shake: number }> = ({
  size,
  color,
  shake,
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{
        transform: `rotate(${shake}deg)`,
        transformOrigin: "top center",
      }}
    >
      <path
        d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={color}
      />
      <path
        d="M13.73 21a2 2 0 0 1-3.46 0"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Bell clapper */}
      <circle cx="12" cy="17" r="1.5" fill="#FFFFFF" />
    </svg>
  );
};

/**
 * Arrow Icon SVG Component
 */
const ArrowIcon: React.FC<{ size: number; color: string; bounce: number }> = ({
  size,
  color,
  bounce,
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{ transform: `translateY(${bounce}px)` }}
    >
      <path
        d="M12 5v14M5 12l7 7 7-7"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

/**
 * Subscribe Button Component
 */
const SubscribeButton: React.FC<{
  text: string;
  primaryColor: string;
  textColor: string;
  scale: number;
  fontSize: number;
}> = ({ text, primaryColor, textColor, scale, fontSize }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Pulse animation
  const pulse = interpolate(
    Math.sin(frame * 0.15),
    [-1, 1],
    [1, 1.05]
  );

  const buttonStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    padding: "16px 32px",
    backgroundColor: primaryColor,
    borderRadius: "8px",
    boxShadow: `0 4px 20px ${primaryColor}80`,
    transform: `scale(${scale * pulse})`,
  };

  const textStyle: React.CSSProperties = {
    fontSize: `${fontSize}px`,
    fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
    fontWeight: 700,
    color: textColor,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  };

  return (
    <div style={buttonStyle}>
      <span style={textStyle}>{text}</span>
    </div>
  );
};

/**
 * Main SubscribeCTA Component
 */
export const SubscribeCTA: React.FC<SubscribeCTAProps> = ({
  channelName = "Stay Starving",
  primaryColor = "#FF0000",
  textColor = "#FFFFFF",
  showBell = true,
  showArrow = true,
  size = "medium",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const config = SIZE_CONFIG[size];

  // Entrance animation - staggered
  const bellEntrance = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  const buttonEntrance = spring({
    frame: frame - 8,
    fps,
    config: { damping: 15, stiffness: 80 },
  });

  const arrowEntrance = spring({
    frame: frame - 16,
    fps,
    config: { damping: 18, stiffness: 60 },
  });

  // Bell shake animation
  const bellShake = interpolate(
    Math.sin(frame * 0.8),
    [-1, 1],
    [-15, 15],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Arrow bounce animation
  const arrowBounce = interpolate(
    Math.sin(frame * 0.3),
    [-1, 1],
    [-5, 5]
  );

  // Container styles
  const containerStyle: React.CSSProperties = {
    position: "absolute",
    bottom: "25%",
    left: 0,
    right: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "20px",
    zIndex: 200,
  };

  // Bell container with entrance
  const bellContainerStyle: React.CSSProperties = {
    opacity: bellEntrance,
    transform: `scale(${bellEntrance}) translateY(${interpolate(bellEntrance, [0, 1], [30, 0])}px)`,
  };

  // Button container with entrance
  const buttonContainerStyle: React.CSSProperties = {
    opacity: buttonEntrance,
    transform: `scale(${buttonEntrance})`,
  };

  // Arrow container with entrance
  const arrowContainerStyle: React.CSSProperties = {
    opacity: arrowEntrance,
    transform: `translateY(${interpolate(arrowEntrance, [0, 1], [-20, 0])}px)`,
  };

  // Channel name style
  const channelNameStyle: React.CSSProperties = {
    fontSize: `${config.fontSize * 0.7}px`,
    fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
    fontWeight: 500,
    color: textColor,
    opacity: 0.9,
    marginBottom: "8px",
  };

  return (
    <div style={containerStyle}>
      {/* Bell Icon */}
      {showBell && (
        <div style={bellContainerStyle}>
          <BellIcon
            size={config.iconSize}
            color={primaryColor}
            shake={bellShake * bellEntrance}
          />
        </div>
      )}

      {/* Subscribe Button */}
      <div style={buttonContainerStyle}>
        <span style={channelNameStyle}>{channelName}</span>
        <SubscribeButton
          text="Subscribe"
          primaryColor={primaryColor}
          textColor={textColor}
          scale={config.scale}
          fontSize={config.fontSize}
        />
      </div>

      {/* Arrow pointing down */}
      {showArrow && (
        <div style={arrowContainerStyle}>
          <ArrowIcon
            size={config.iconSize * 0.75}
            color={textColor}
            bounce={arrowBounce}
          />
        </div>
      )}
    </div>
  );
};

export default SubscribeCTA;
