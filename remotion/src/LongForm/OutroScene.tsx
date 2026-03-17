/**
 * OutroScene - YouTube Video End Screen
 *
 * Subscribe CTA, channel branding, and next video teaser.
 * 5-8 seconds, appended to end of long-form videos.
 *
 * Reuses SubscribeCTA component from Shorts for consistency.
 *
 * @author WAT Framework
 * @since 2026-02-16
 */

import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";

export const outroSceneSchema = z.object({
  channelName: z.string().default("Stay Starving"),
  nextVideoTitle: z.string().optional(),
  logoUrl: z.string().default(""),
  primaryColor: z.string().default("#FFD700"),
  secondaryColor: z.string().default("#1a1a2e"),
  textColor: z.string().default("#FFFFFF"),
  subscribeColor: z.string().default("#FF0000"),
  fontFamily: z
    .string()
    .default(
      "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
    ),
  socialHandles: z
    .array(z.object({ platform: z.string(), handle: z.string() }))
    .default([]),
});

export type OutroSceneProps = z.infer<typeof outroSceneSchema>;

export const OutroScene: React.FC<OutroSceneProps> = ({
  channelName = "Stay Starving",
  nextVideoTitle,
  logoUrl = "",
  primaryColor = "#FFD700",
  secondaryColor = "#1a1a2e",
  textColor = "#FFFFFF",
  subscribeColor = "#FF0000",
  fontFamily = "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
  socialHandles = [],
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Resolve logo: use provided URL, or fall back to staticFile
  const resolvedLogo = logoUrl || staticFile("logos/logo.png");

  // Entrance fade
  const entranceOpacity = interpolate(frame, [0, fps * 0.5], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Logo animation
  const logoScale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  // "Thanks for watching" text
  const thanksOpacity = spring({
    frame: frame - Math.floor(fps * 0.3),
    fps,
    config: { damping: 20, stiffness: 60 },
  });

  // Subscribe button
  const subEntrance = spring({
    frame: frame - Math.floor(fps * 0.8),
    fps,
    config: { damping: 15, stiffness: 80 },
  });
  const subScale = interpolate(subEntrance, [0, 1], [0.8, 1]);

  // Subscribe pulse
  const subPulse = interpolate(
    frame % (fps * 1.5),
    [0, fps * 0.3, fps * 1.5],
    [1, 1.06, 1],
    { extrapolateRight: "clamp" }
  );

  // Bell shake
  const bellRotation = frame > fps * 1.2
    ? interpolate(
        (frame - fps * 1.2) % (fps * 2),
        [0, 3, 6, 9, 12],
        [0, -15, 15, -10, 0],
        { extrapolateRight: "clamp" }
      )
    : 0;

  // Next video teaser
  const nextEntrance = spring({
    frame: frame - Math.floor(fps * 1.5),
    fps,
    config: { damping: 15, stiffness: 80 },
  });

  // Social handles
  const socialEntrance = spring({
    frame: frame - Math.floor(fps * 2),
    fps,
    config: { damping: 20, stiffness: 60 },
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: secondaryColor,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        opacity: entranceOpacity,
      }}
    >
      {/* Logo */}
      <Img
        src={resolvedLogo}
        style={{
          width: 120,
          height: 120,
          objectFit: "contain",
          transform: `scale(${logoScale})`,
          marginBottom: 20,
        }}
        onError={() => {}}
      />

      {/* Thanks message */}
      <p
        style={{
          fontFamily,
          fontSize: 32,
          fontWeight: 400,
          color: `${textColor}cc`,
          margin: 0,
          marginBottom: 40,
          opacity: thanksOpacity,
        }}
      >
        Thanks for watching
      </p>

      {/* Subscribe button */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          transform: `scale(${subScale * subPulse})`,
          opacity: subEntrance,
        }}
      >
        {/* Bell icon */}
        <div
          style={{
            fontSize: 40,
            transform: `rotate(${bellRotation}deg)`,
            transformOrigin: "top center",
          }}
        >
          🔔
        </div>

        {/* Button */}
        <div
          style={{
            backgroundColor: subscribeColor,
            color: textColor,
            fontFamily,
            fontSize: 28,
            fontWeight: 700,
            padding: "14px 40px",
            borderRadius: 8,
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          Subscribe
        </div>
      </div>

      {/* Next video teaser */}
      {nextVideoTitle && (
        <div
          style={{
            marginTop: 50,
            opacity: nextEntrance,
            transform: `translateY(${interpolate(nextEntrance, [0, 1], [20, 0])}px)`,
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontFamily,
              fontSize: 18,
              color: `${textColor}88`,
              margin: 0,
              marginBottom: 8,
              textTransform: "uppercase",
              letterSpacing: 3,
            }}
          >
            Up Next
          </p>
          <p
            style={{
              fontFamily,
              fontSize: 28,
              fontWeight: 600,
              color: primaryColor,
              margin: 0,
            }}
          >
            {nextVideoTitle}
          </p>
        </div>
      )}

      {/* Social handles */}
      {socialHandles.length > 0 && (
        <div
          style={{
            position: "absolute",
            bottom: 60,
            display: "flex",
            gap: 40,
            opacity: socialEntrance,
          }}
        >
          {socialHandles.map((social, i) => (
            <div
              key={i}
              style={{
                fontFamily,
                fontSize: 18,
                color: `${textColor}aa`,
              }}
            >
              <span style={{ color: primaryColor, fontWeight: 600 }}>
                {social.platform}
              </span>{" "}
              {social.handle}
            </div>
          ))}
        </div>
      )}

      {/* Top and bottom accent bars */}
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

export default OutroScene;
