/**
 * Shorts Module
 *
 * Components for automated YouTube Shorts creation.
 *
 * @author WAT Framework
 * @since 2026-01-29
 */

// Main template
export { ShortsTemplate, shortsTemplateSchema, defaultShortsProps } from "./ShortsTemplate";
export type { ShortsTemplateProps } from "./ShortsTemplate";

// Caption overlay
export {
  CaptionOverlay,
  captionOverlaySchema,
  captionPageSchema,
  captionTokenSchema,
  createCaptionPages,
} from "./CaptionOverlay";
export type { CaptionOverlayProps, CaptionPage, CaptionToken } from "./CaptionOverlay";

// Subscribe CTA
export { SubscribeCTA, subscribeCTASchema } from "./SubscribeCTA";
export type { SubscribeCTAProps } from "./SubscribeCTA";

// AI Short (test composition)
export { AIShort, aiShortSchema, defaultAIShortProps } from "./AIShort";
export type { AIShortProps } from "./AIShort";
