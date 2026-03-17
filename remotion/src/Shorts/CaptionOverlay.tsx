/**
 * CaptionOverlay Component
 *
 * TikTok-style captions with word-by-word highlighting for YouTube Shorts.
 * Displays captions at the bottom of the frame with the current word highlighted.
 *
 * Usage:
 *   <CaptionOverlay captions={captions} highlightColor="#FFD700" />
 *
 * @author WAT Framework
 * @since 2026-01-29
 */

import React, { useMemo } from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  Sequence,
} from "remotion";
import { z } from "zod";

// Zod schema for caption tokens
export const captionTokenSchema = z.object({
  text: z.string(),
  startMs: z.number(),
  endMs: z.number(),
});

export const captionPageSchema = z.object({
  tokens: z.array(captionTokenSchema),
  startMs: z.number(),
  endMs: z.number(),
});

export const captionOverlaySchema = z.object({
  captions: z.array(captionPageSchema),
  highlightColor: z.string().default("#FFD700"),
  textColor: z.string().default("#FFFFFF"),
  fontSize: z.number().default(48),
  fontFamily: z.string().default("'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"),
  position: z.enum(["bottom", "center", "top"]).default("bottom"),
  showBackground: z.boolean().default(true),
});

export type CaptionToken = z.infer<typeof captionTokenSchema>;
export type CaptionPage = z.infer<typeof captionPageSchema>;
export type CaptionOverlayProps = z.infer<typeof captionOverlaySchema>;

// Constants
const ANIMATION_DURATION_FRAMES = 8;

/**
 * Single caption page component - displays one "page" of captions
 */
const CaptionPage: React.FC<{
  page: CaptionPage;
  highlightColor: string;
  textColor: string;
  fontSize: number;
  fontFamily: string;
  showBackground: boolean;
}> = ({ page, highlightColor, textColor, fontSize, fontFamily, showBackground }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Calculate current time in milliseconds (relative to this page)
  const currentTimeMs = (frame / fps) * 1000;
  const absoluteTimeMs = page.startMs + currentTimeMs;

  // Entrance animation
  const entrance = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 80 },
  });

  const opacity = interpolate(entrance, [0, 1], [0, 1]);
  const translateY = interpolate(entrance, [0, 1], [20, 0]);

  // Container styles
  const containerStyle: React.CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    gap: "8px",
    padding: showBackground ? "16px 24px" : "0",
    backgroundColor: showBackground ? "rgba(0, 0, 0, 0.7)" : "transparent",
    borderRadius: showBackground ? "12px" : "0",
    opacity,
    transform: `translateY(${translateY}px)`,
    maxWidth: "90%",
  };

  return (
    <div style={containerStyle}>
      {page.tokens.map((token, index) => {
        // Determine if this token is currently active
        const isActive =
          token.startMs <= absoluteTimeMs && token.endMs > absoluteTimeMs;

        // Highlight animation for active word
        const scale = isActive ? 1.15 : 1;
        const wordColor = isActive ? highlightColor : textColor;

        // Text shadow for readability
        const textShadow = isActive
          ? `0 0 20px ${highlightColor}, 0 2px 4px rgba(0,0,0,0.8)`
          : "0 2px 4px rgba(0,0,0,0.8)";

        const wordStyle: React.CSSProperties = {
          display: "inline-block",
          fontSize: `${fontSize}px`,
          fontFamily,
          fontWeight: 800,
          color: wordColor,
          transform: `scale(${scale})`,
          transition: "all 0.1s ease-out",
          textShadow,
          letterSpacing: "-0.02em",
        };

        return (
          <span key={`${token.text}-${index}`} style={wordStyle}>
            {token.text}
          </span>
        );
      })}
    </div>
  );
};

/**
 * Main CaptionOverlay component
 *
 * Orchestrates multiple caption pages with proper timing using Sequences.
 */
export const CaptionOverlay: React.FC<CaptionOverlayProps> = ({
  captions,
  highlightColor = "#FFD700",
  textColor = "#FFFFFF",
  fontSize = 48,
  fontFamily = "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
  position = "bottom",
  showBackground = true,
}) => {
  const { fps, height } = useVideoConfig();

  // Calculate position based on prop
  const positionStyle = useMemo((): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: "absolute",
      left: 0,
      right: 0,
      display: "flex",
      justifyContent: "center",
      zIndex: 100,
    };

    switch (position) {
      case "top":
        return { ...base, top: "10%" };
      case "center":
        return { ...base, top: "50%", transform: "translateY(-50%)" };
      case "bottom":
      default:
        return { ...base, bottom: "15%" };
    }
  }, [position]);

  // Render caption pages as sequences
  return (
    <div style={positionStyle}>
      {captions.map((page, index) => {
        const startFrame = Math.floor((page.startMs / 1000) * fps);
        const durationMs = page.endMs - page.startMs;
        const durationFrames = Math.ceil((durationMs / 1000) * fps);

        return (
          <Sequence
            key={`caption-page-${index}`}
            from={startFrame}
            durationInFrames={durationFrames}
          >
            <CaptionPage
              page={page}
              highlightColor={highlightColor}
              textColor={textColor}
              fontSize={fontSize}
              fontFamily={fontFamily}
              showBackground={showBackground}
            />
          </Sequence>
        );
      })}
    </div>
  );
};

/**
 * Helper function to create caption pages from raw transcript data
 *
 * Takes an array of words with timing and groups them into displayable pages.
 *
 * @param words - Array of {text, startMs, endMs} objects
 * @param wordsPerPage - Maximum words per page (default: 6)
 * @param combineWithinMs - Combine words within this time window (default: 1200)
 */
export function createCaptionPages(
  words: CaptionToken[],
  wordsPerPage: number = 6,
  combineWithinMs: number = 1200
): CaptionPage[] {
  if (!words.length) return [];

  const pages: CaptionPage[] = [];
  let currentPage: CaptionToken[] = [];
  let pageStartMs = words[0].startMs;

  for (const word of words) {
    // Start new page if:
    // 1. Current page is full
    // 2. Gap between words is too large
    const shouldStartNewPage =
      currentPage.length >= wordsPerPage ||
      (currentPage.length > 0 &&
        word.startMs - currentPage[currentPage.length - 1].endMs > combineWithinMs);

    if (shouldStartNewPage && currentPage.length > 0) {
      pages.push({
        tokens: currentPage,
        startMs: pageStartMs,
        endMs: currentPage[currentPage.length - 1].endMs,
      });
      currentPage = [];
      pageStartMs = word.startMs;
    }

    currentPage.push(word);
  }

  // Add final page
  if (currentPage.length > 0) {
    pages.push({
      tokens: currentPage,
      startMs: pageStartMs,
      endMs: currentPage[currentPage.length - 1].endMs,
    });
  }

  return pages;
}

export default CaptionOverlay;
