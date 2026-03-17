/**
 * KineticTypography - Animated Full-Screen Text Sequences
 *
 * Word-by-word or phrase-by-phrase animated text for hooks,
 * quotes, key points, and emphasis moments.
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

const animationStyleEnum = z.enum([
  "typewriter",
  "bounce-in",
  "wave",
  "glitch-reveal",
  "split-reveal",
  "fade-words",
]);

export const kineticTypographySchema = z.object({
  text: z.string().default("Stay Starving"),
  style: animationStyleEnum.default("bounce-in"),
  fontSize: z.number().default(80),
  fontWeight: z.number().default(800),
  textColor: z.string().default("#FFFFFF"),
  accentColor: z.string().default("#FFD700"),
  backgroundColor: z.string().default("#1a1a2e"),
  fontFamily: z
    .string()
    .default(
      "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
    ),
  showBackground: z.boolean().default(true),
});

export type KineticTypographyProps = z.infer<typeof kineticTypographySchema>;

export const KineticTypography: React.FC<KineticTypographyProps> = ({
  text = "Stay Starving",
  style = "bounce-in",
  fontSize = 80,
  fontWeight = 800,
  textColor = "#FFFFFF",
  accentColor = "#FFD700",
  backgroundColor = "#1a1a2e",
  fontFamily = "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif",
  showBackground = true,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const words = text.split(" ");
  const framesPerWord = Math.floor((durationInFrames * 0.6) / words.length);

  // Exit fade
  const exitOpacity = interpolate(
    frame,
    [durationInFrames - fps * 0.5, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const renderWord = (word: string, index: number) => {
    const wordDelay = index * framesPerWord;
    const wordFrame = frame - wordDelay;

    if (style === "typewriter") {
      const charsVisible = Math.floor(
        interpolate(wordFrame, [0, framesPerWord], [0, word.length], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      );
      const showCursor = wordFrame >= 0 && wordFrame < framesPerWord + 10;
      return (
        <span key={index} style={{ display: "inline-block", marginRight: fontSize * 0.3 }}>
          {word.slice(0, charsVisible)}
          {showCursor && (
            <span
              style={{
                color: accentColor,
                opacity: frame % 16 < 8 ? 1 : 0,
              }}
            >
              |
            </span>
          )}
        </span>
      );
    }

    if (style === "bounce-in") {
      const entrance = spring({
        frame: wordFrame,
        fps,
        config: { damping: 8, stiffness: 120, mass: 0.5 },
      });
      const scale = interpolate(entrance, [0, 1], [0, 1]);
      const y = interpolate(entrance, [0, 1], [60, 0]);
      return (
        <span
          key={index}
          style={{
            display: "inline-block",
            marginRight: fontSize * 0.3,
            transform: `translateY(${y}px) scale(${scale})`,
            opacity: entrance,
          }}
        >
          {word}
        </span>
      );
    }

    if (style === "wave") {
      return (
        <span key={index} style={{ display: "inline-block", marginRight: fontSize * 0.3 }}>
          {word.split("").map((char, charIdx) => {
            const charDelay = wordDelay + charIdx * 2;
            const waveY = Math.sin((frame - charDelay) * 0.15) * 15;
            const charOpacity = interpolate(
              frame - charDelay,
              [0, 8],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );
            return (
              <span
                key={charIdx}
                style={{
                  display: "inline-block",
                  transform: `translateY(${waveY}px)`,
                  opacity: charOpacity,
                }}
              >
                {char}
              </span>
            );
          })}
        </span>
      );
    }

    if (style === "glitch-reveal") {
      const revealed = wordFrame > 0;
      const glitchActive = wordFrame >= 0 && wordFrame < 10;
      const offsetX = glitchActive ? Math.sin(wordFrame * 3) * 8 : 0;
      const offsetY = glitchActive ? Math.cos(wordFrame * 5) * 4 : 0;
      return (
        <span
          key={index}
          style={{
            display: "inline-block",
            marginRight: fontSize * 0.3,
            opacity: revealed ? 1 : 0,
            transform: `translate(${offsetX}px, ${offsetY}px)`,
            color: glitchActive ? accentColor : textColor,
          }}
        >
          {word}
        </span>
      );
    }

    if (style === "split-reveal") {
      const entrance = spring({
        frame: wordFrame,
        fps,
        config: { damping: 15, stiffness: 100 },
      });
      const clipTop = interpolate(entrance, [0, 1], [50, 0]);
      return (
        <span
          key={index}
          style={{
            display: "inline-block",
            marginRight: fontSize * 0.3,
            overflow: "hidden",
          }}
        >
          <span
            style={{
              display: "inline-block",
              transform: `translateY(${clipTop}%)`,
              opacity: entrance,
            }}
          >
            {word}
          </span>
        </span>
      );
    }

    // fade-words (default)
    const fadeIn = interpolate(wordFrame, [0, fps * 0.3], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    return (
      <span
        key={index}
        style={{
          display: "inline-block",
          marginRight: fontSize * 0.3,
          opacity: fadeIn,
        }}
      >
        {word}
      </span>
    );
  };

  return (
    <AbsoluteFill
      style={{
        backgroundColor: showBackground ? backgroundColor : "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: exitOpacity,
      }}
    >
      <div
        style={{
          fontFamily,
          fontSize,
          fontWeight,
          color: textColor,
          textAlign: "center",
          maxWidth: "85%",
          lineHeight: 1.3,
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        {words.map(renderWord)}
      </div>
    </AbsoluteFill>
  );
};

export default KineticTypography;
