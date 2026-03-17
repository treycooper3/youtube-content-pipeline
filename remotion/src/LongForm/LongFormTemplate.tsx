/**
 * LongFormTemplate - Master Long-Form Video Composition
 *
 * Wraps a base video (OffthreadVideo) with overlay layers:
 *   - Captions (reuses CaptionOverlay from Shorts)
 *   - Lower thirds
 *   - Text overlays
 *   - Gradient overlay for text readability
 *
 * Intros and outros are separate compositions rendered independently
 * and composited via FFmpeg (for performance with long videos).
 *
 * For short preview renders, this can include inline intro/outro.
 *
 * @author WAT Framework
 * @since 2026-02-16
 */

import React from "react";
import {
  AbsoluteFill,
  OffthreadVideo,
  Sequence,
  useVideoConfig,
} from "remotion";
import { z } from "zod";
import {
  CaptionOverlay,
  captionPageSchema,
} from "../Shorts/CaptionOverlay";
import { LowerThird, lowerThirdSchema } from "./LowerThird";
import { TextOverlay, textOverlaySchema } from "./TextOverlay";

// Lower third overlay definition
const lowerThirdOverlaySchema = z.object({
  startMs: z.number(),
  durationMs: z.number().default(4000),
  props: lowerThirdSchema,
});

// Text overlay definition
const textOverlayDefSchema = z.object({
  startMs: z.number(),
  durationMs: z.number().default(3000),
  props: textOverlaySchema,
});

export const longFormTemplateSchema = z.object({
  // Video source
  videoUrl: z.string(),
  startFrom: z.number().default(0),

  // Captions
  captions: z.array(captionPageSchema).default([]),
  showCaptions: z.boolean().default(true),
  captionHighlightColor: z.string().default("#FFD700"),
  captionPosition: z.enum(["bottom", "center", "top"]).default("bottom"),

  // Lower thirds
  lowerThirds: z.array(lowerThirdOverlaySchema).default([]),

  // Text overlays
  textOverlays: z.array(textOverlayDefSchema).default([]),

  // Styling
  showGradientOverlay: z.boolean().default(true),

  // Performance
  useOffthreadVideo: z.boolean().default(true),
});

export type LongFormTemplateProps = z.infer<typeof longFormTemplateSchema>;

export const LongFormTemplate: React.FC<LongFormTemplateProps> = ({
  videoUrl,
  startFrom = 0,
  captions = [],
  showCaptions = true,
  captionHighlightColor = "#FFD700",
  captionPosition = "bottom",
  lowerThirds = [],
  textOverlays = [],
  showGradientOverlay = true,
  useOffthreadVideo = true,
}) => {
  const { fps } = useVideoConfig();

  const startFrame = Math.floor(startFrom * fps);

  const videoStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  };

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      {/* Layer 1: Base video */}
      {videoUrl && (
        <AbsoluteFill>
          {useOffthreadVideo ? (
            <OffthreadVideo
              src={videoUrl}
              startFrom={startFrame}
              style={videoStyle}
            />
          ) : (
            <video
              src={videoUrl}
              style={videoStyle}
            />
          )}
        </AbsoluteFill>
      )}

      {/* Layer 2: Gradient overlay for text readability */}
      {showGradientOverlay && (
        <AbsoluteFill>
          {/* Bottom gradient */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "30%",
              background:
                "linear-gradient(transparent, rgba(0,0,0,0.6))",
            }}
          />
        </AbsoluteFill>
      )}

      {/* Layer 3: Lower thirds */}
      {lowerThirds.map((lt, index) => {
        const startFrame = Math.floor((lt.startMs / 1000) * fps);
        const durationFrames = Math.ceil((lt.durationMs / 1000) * fps);

        return (
          <Sequence
            key={`lt-${index}`}
            from={startFrame}
            durationInFrames={durationFrames}
          >
            <LowerThird {...lt.props} />
          </Sequence>
        );
      })}

      {/* Layer 4: Text overlays */}
      {textOverlays.map((to, index) => {
        const startFrame = Math.floor((to.startMs / 1000) * fps);
        const durationFrames = Math.ceil((to.durationMs / 1000) * fps);

        return (
          <Sequence
            key={`to-${index}`}
            from={startFrame}
            durationInFrames={durationFrames}
          >
            <TextOverlay {...to.props} />
          </Sequence>
        );
      })}

      {/* Layer 5: Captions */}
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
    </AbsoluteFill>
  );
};

export const defaultLongFormProps: LongFormTemplateProps = {
  videoUrl: "",
  startFrom: 0,
  captions: [],
  showCaptions: true,
  captionHighlightColor: "#FFD700",
  captionPosition: "bottom",
  lowerThirds: [],
  textOverlays: [],
  showGradientOverlay: true,
  useOffthreadVideo: true,
};

export default LongFormTemplate;
