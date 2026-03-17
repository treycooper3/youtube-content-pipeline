/**
 * SplitScreen - Multi-Source Video Layout
 *
 * Show multiple video sources simultaneously in grid layouts.
 * Supports 2-up, 3-up, and 4-up with animated borders.
 *
 * @author WAT Framework
 * @since 2026-02-17
 */

import React from "react";
import {
  AbsoluteFill,
  OffthreadVideo,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";

const layoutEnum = z.enum(["side-by-side", "top-bottom", "grid-4", "pip"]);

const sourceSchema = z.object({
  url: z.string(),
  label: z.string().optional(),
});

export const splitScreenSchema = z.object({
  layout: layoutEnum.default("side-by-side"),
  sources: z.array(sourceSchema).default([]),
  borderColor: z.string().default("#FFD700"),
  borderWidth: z.number().default(4),
  backgroundColor: z.string().default("#1a1a2e"),
  showLabels: z.boolean().default(false),
  labelColor: z.string().default("#FFFFFF"),
  fontFamily: z
    .string()
    .default(
      "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
    ),
});

export type SplitScreenProps = z.infer<typeof splitScreenSchema>;

interface PanelConfig {
  top: string;
  left: string;
  width: string;
  height: string;
}

const getLayoutPanels = (layout: string, count: number): PanelConfig[] => {
  if (layout === "side-by-side") {
    return Array.from({ length: Math.min(count, 3) }, (_, i) => ({
      top: "0%",
      left: `${(i * 100) / Math.min(count, 3)}%`,
      width: `${100 / Math.min(count, 3)}%`,
      height: "100%",
    }));
  }

  if (layout === "top-bottom") {
    return Array.from({ length: Math.min(count, 2) }, (_, i) => ({
      top: `${i * 50}%`,
      left: "0%",
      width: "100%",
      height: "50%",
    }));
  }

  if (layout === "grid-4") {
    return [
      { top: "0%", left: "0%", width: "50%", height: "50%" },
      { top: "0%", left: "50%", width: "50%", height: "50%" },
      { top: "50%", left: "0%", width: "50%", height: "50%" },
      { top: "50%", left: "50%", width: "50%", height: "50%" },
    ].slice(0, count);
  }

  if (layout === "pip") {
    return [
      { top: "0%", left: "0%", width: "100%", height: "100%" },
      { top: "60%", left: "65%", width: "30%", height: "30%" },
    ].slice(0, count);
  }

  return [];
};

export const SplitScreen: React.FC<SplitScreenProps> = ({
  layout = "side-by-side",
  sources = [],
  borderColor = "#FFD700",
  borderWidth = 4,
  backgroundColor = "#1a1a2e",
  showLabels = false,
  labelColor = "#FFFFFF",
  fontFamily = "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const panels = getLayoutPanels(layout, sources.length);

  return (
    <AbsoluteFill style={{ backgroundColor }}>
      {sources.map((source, i) => {
        const panel = panels[i];
        if (!panel) return null;

        const entrance = spring({
          frame: frame - i * 5,
          fps,
          config: { damping: 15, stiffness: 100 },
        });

        const scale = interpolate(entrance, [0, 1], [0.95, 1]);

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: panel.top,
              left: panel.left,
              width: panel.width,
              height: panel.height,
              overflow: "hidden",
              border:
                layout === "pip" && i === 1
                  ? `${borderWidth + 1}px solid ${borderColor}`
                  : `${borderWidth / 2}px solid ${borderColor}`,
              borderRadius: layout === "pip" && i === 1 ? 12 : 0,
              transform: `scale(${scale})`,
              boxShadow:
                layout === "pip" && i === 1
                  ? "0 4px 20px rgba(0,0,0,0.5)"
                  : "none",
            }}
          >
            {source.url && (
              <OffthreadVideo
                src={source.url}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            )}

            {showLabels && source.label && (
              <div
                style={{
                  position: "absolute",
                  bottom: 12,
                  left: 12,
                  backgroundColor: "rgba(0, 0, 0, 0.7)",
                  color: labelColor,
                  fontFamily,
                  fontSize: 16,
                  fontWeight: 600,
                  padding: "6px 14px",
                  borderRadius: 6,
                  borderLeft: `3px solid ${borderColor}`,
                }}
              >
                {source.label}
              </div>
            )}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export default SplitScreen;
