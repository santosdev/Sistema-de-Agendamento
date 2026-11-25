/**
 * Design tokens needed from JavaScript (Motion, emails, .ics, canvas-free previews).
 * Mirrors app/theme.css. Source of truth: DESIGN.md.
 */

export const EVENT_COLORS = {
  violet: "#6D28D9",
  blue: "#2563EB",
  teal: "#0F766E",
  green: "#15803D",
  amber: "#B45309",
  rose: "#BE123C",
  fuchsia: "#C026D3",
  slate: "#475569",
} as const;

export type EventColor = keyof typeof EVENT_COLORS;

export const DEFAULT_EVENT_COLOR: EventColor = "violet";

export const EVENT_COLOR_NAMES = Object.keys(EVENT_COLORS) as EventColor[];

/** Durations in seconds, as Motion expects. */
export const DURATION = {
  fast: 0.12,
  base: 0.2,
  slow: 0.32,
} as const;

export const EASE = {
  outSoft: [0.23, 1, 0.32, 1],
  inOutSoft: [0.77, 0, 0.175, 1],
} as const;

/** Max items that get a staggered entrance; the rest appear at once. */
export const STAGGER = {
  step: 0.015,
  maxItems: 12,
} as const;
