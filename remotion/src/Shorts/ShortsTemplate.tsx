/**
 * ShortsTemplate Component
 *
 * Main 9:16 vertical video wrapper for YouTube Shorts automation.
 * Combines video clip, captions, and subscribe CTA into a complete Short.
 *
 * Dimensions: 1080 x 1920 (9:16 aspect ratio)
 * Max Duration: 90 seconds at 30fps = 2700 frames
 *
 * Usage:
 *   npx remotion render ShortsTemplate --props='{"clipUrl": "...", ...}'
 *
 * @author WAT Framework
 * @since 2026-01-29
 */

import React from "react";
import {
  AbsoluteFill,
  Sequence,
  Video,
  OffthreadVideo,
  useVideoConfig,
  staticFile,
  Img,
  interpolate,
  useCurrentFrame,
  spring,
} from "remotion";
import { z } from "zod";
import { CaptionOverlay, captionPageSchema } from "./CaptionOverlay";
import { SubscribeCTA } from "./SubscribeCTA";

// Zod schema for the Shorts template
export const shortsTemplateSchema = z.object({
  // Video source
  clipUrl: z.string().describe("URL or path to the video clip"),
  startFrom: z.number().default(0).describe("Start time in seconds"),

  // Captions
  captions: z.array(captionPageSchema).default([]),
  captionHighlightColor: z.string().default("#FFD700"),
  captionPosition: z.enum(["bottom", "center", "top"]).default("bottom"),
  showCaptions: z.boolean().default(true),

  // Subscribe CTA
  showSubscribeCTA: z.boolean().default(true),
  ctaDelaySeconds: z.number().default(0).describe("Delay before showing CTA (0 = end of video)"),
  ctaDurationSeconds: z.number().default(3).describe("How long to show CTA"),
  channelName: z.string().default("Stay Starving"),

  // Branding
  showWatermark: z.boolean().default(false),
  watermarkUrl: z.string().optional(),

  // Background
  backgroundColor: z.string().default("#000000"),

  // Video settings
  useOffthreadVideo: z.boolean().default(true).describe("Use OffthreadVideo for better performance"),
});

export type ShortsTemplateProps = z.infer<typeof shortsTemplateSchema>;

/**
 * Watermark overlay component
 */
const Watermark: React.FC<{ url?: string }> = ({ url }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Subtle fade in
  const opacity = interpolate(frame, [0, fps], [0, 0.6], {
    extrapolateRight: "clamp",
  });

  const style: React.CSSProperties = {
    position: "absolute",
    top: 40,
    right: 40,
    width: 80,
    height: 80,
    opacity,
    zIndex: 50,
  };

  if (!url) {
    // Default text watermark
    return (
      <div
        style={{
          ...style,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          fontFamily: "'SF Pro Display', sans-serif",
          fontWeight: 600,
          color: "rgba(255,255,255,0.6)",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}
      >
        @StayStarving
      </div>
    );
  }

  return <Img src={url} style={style} />;
};

/**
 * Video container with proper scaling for 9:16
 */
const VideoContainer: React.FC<{
  clipUrl: string;
  startFrom: number;
  useOffthread: boolean;
}> = ({ clipUrl, startFrom, useOffthread }) => {
  const { fps } = useVideoConfig();
  const startFrame = Math.floor(startFrom * fps);

  const videoStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  };

  // Use OffthreadVideo for better rendering performance
  if (useOffthread) {
    return (
      <OffthreadVideo
        src={clipUrl}
        startFrom={startFrame}
        style={videoStyle}
      />
    );
  }

  return (
    <Video
      src={clipUrl}
      startFrom={startFrame}
      style={videoStyle}
    />
  );
};

/**
 * Gradient overlay for better text readability
 */
const GradientOverlay: React.FC = () => {
  const style: React.CSSProperties = {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "40%",
    background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)",
    pointerEvents: "none",
    zIndex: 10,
  };

  return <div style={style} />;
};

/**
 * Main ShortsTemplate Component
 *
 * This is the primary composition for rendering YouTube Shorts.
 * It orchestrates the video, captions, and CTA with proper timing.
 */
export const ShortsTemplate: React.FC<ShortsTemplateProps> = ({
  clipUrl,
  startFrom = 0,
  captions = [],
  captionHighlightColor = "#FFD700",
  captionPosition = "bottom",
  showCaptions = true,
  showSubscribeCTA = true,
  ctaDelaySeconds = 0,
  ctaDurationSeconds = 3,
  channelName = "Stay Starving",
  showWatermark = false,
  watermarkUrl,
  backgroundColor = "#000000",
  useOffthreadVideo = true,
}) => {
  const { fps, durationInFrames, width, height } = useVideoConfig();

  // Calculate CTA timing
  // If ctaDelaySeconds is 0, show at the end
  const ctaStartFrame = ctaDelaySeconds === 0
    ? durationInFrames - Math.floor(ctaDurationSeconds * fps)
    : Math.floor(ctaDelaySeconds * fps);

  const ctaDurationFrames = Math.floor(ctaDurationSeconds * fps);

  // Main container style
  const containerStyle: React.CSSProperties = {
    backgroundColor,
    width: "100%",
    height: "100%",
  };

  return (
    <AbsoluteFill style={containerStyle}>
      {/* Video Layer */}
      {clipUrl && (
        <AbsoluteFill>
          <VideoContainer
            clipUrl={clipUrl}
            startFrom={startFrom}
            useOffthread={useOffthreadVideo}
          />
        </AbsoluteFill>
      )}

      {/* Gradient overlay for text readability */}
      <GradientOverlay />

      {/* Watermark */}
      {showWatermark && <Watermark url={watermarkUrl} />}

      {/* Captions Layer */}
      {showCaptions && captions.length > 0 && (
        <CaptionOverlay
          captions={captions}
          highlightColor={captionHighlightColor}
          position={captionPosition}
          textColor="#FFFFFF"
          fontSize={48}
          fontFamily="'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
          showBackground={true}
        />
      )}

      {/* Subscribe CTA */}
      {showSubscribeCTA && (
        <Sequence from={ctaStartFrame} durationInFrames={ctaDurationFrames}>
          <SubscribeCTA
            channelName={channelName}
            primaryColor="#FF0000"
            textColor="#FFFFFF"
            showBell={true}
            showArrow={true}
            size="medium"
          />
        </Sequence>
      )}
    </AbsoluteFill>
  );
};

/**
 * Export default props for testing in Remotion Studio
 */
export const defaultShortsProps: ShortsTemplateProps = {
  clipUrl: "",
  startFrom: 0,
  captions: [
    {
      tokens: [
        { text: "This", startMs: 0, endMs: 300 },
        { text: "is", startMs: 300, endMs: 500 },
        { text: "a", startMs: 500, endMs: 600 },
        { text: "sample", startMs: 600, endMs: 1000 },
        { text: "caption", startMs: 1000, endMs: 1500 },
      ],
      startMs: 0,
      endMs: 1500,
    },
    {
      tokens: [
        { text: "With", startMs: 2000, endMs: 2300 },
        { text: "word-by-word", startMs: 2300, endMs: 3000 },
        { text: "highlighting!", startMs: 3000, endMs: 3500 },
      ],
      startMs: 2000,
      endMs: 3500,
    },
  ],
  captionHighlightColor: "#FFD700",
  captionPosition: "bottom",
  showCaptions: true,
  showSubscribeCTA: true,
  ctaDelaySeconds: 0,
  ctaDurationSeconds: 3,
  channelName: "Stay Starving",
  showWatermark: false,
  backgroundColor: "#1a1a2e",
  useOffthreadVideo: true,
};

export default ShortsTemplate;
