# DESIGN.md - SPX Axiom Quantitative Terminal

## Context (from discovery)

- Artifact type: dashboard / quantitative trading terminal
- Positioning: institutional financial simulation
- Audience: quantitative trader, portfolio manager, risk analyst
- Primary action: evaluate intraday SPX directional signals, volatility regimes, and asymmetric bracket executions
- Adjectives: disciplined, institutional, sharp, transparent
- Visual word translations:
  - disciplined: tight tabular grid spacing, zero decorative padding
  - institutional: pitch-black TradingView dark canvas, high-contrast candlesticks
  - sharp: monospace tabular data alignment, crisp 1px borders
  - transparent: explicit empirical coverage numbers and out-of-sample confusion matrix
- Aesthetic essence: technical, restrained, operational
- Single-minded proposition: real-time statistical forecasting without marketing veneer or robotic jargon
- Mode: dark mode default with light mode toggle
- Density: dense
- Constraints: target instrument strictly S&P 500 cash index (SPX), zero broker execution, WCAG 2.2 AA accessibility, zero em dashes

## Aesthetic

- Direction: TradingView dark workstation with modern-minimal craft
- Defining trait: two-tier information architecture separating real-time market action (upper) from historical out-of-sample verification (lower)
- Signature move: live 30-minute forward trajectory path and 90% conformal prediction envelope rendered directly over live candles

## Typography

- Display: Plus Jakarta Sans (Google Fonts, OFL)
- Body: Public Sans (Google Fonts, OFL)
- Figures and code: JetBrains Mono (Google Fonts, OFL)
- Scale: base 14px, modular scale 1.15
  - text-xs: 0.75rem (12px), line-height 1.35 (labels, badges, table cells)
  - text-sm: 0.8125rem (13px), line-height 1.4 (subheadings, secondary figures)
  - text-md: 0.875rem (14px), line-height 1.5 (panel titles, body prose)
  - text-lg: 1.0625rem (17px), line-height 1.4 (metric highlights)
  - text-xl: 1.25rem (20px), line-height 1.2 (key prices, target percentages)
  - text-display: 2.0rem (32px), line-height 1.1 (hero P&L figure)
- Weights: 400 regular, 500 medium, 600 semibold, 700 bold
- Numeric rule: all currency figures, point deltas, and counts use tabular-nums with monospace font

## Color System

- Strategy: authentic financial terminal palette matching TradingView pitch-black dark theme, avoiding the generic purple gradient AI aesthetic
- Dark mode distribution: 75% dark neutral / 15% structural borders / 10% semantic status
- Palette (dark mode):
  - bg (paper): oklch(10% 0.008 260) (#0b0d13 pitch black)
  - surface (paper-2): oklch(14% 0.01 260) (#131722 panel background)
  - surface elevated (paper-3): oklch(18% 0.012 260) (#1a1f2c tile background)
  - surface hover (paper-4): oklch(24% 0.015 260) (#242a3a pill background)
  - fg (ink): oklch(96% 0.01 240) (#f0f3fa primary text)
  - fg muted (ink-2): oklch(86% 0.01 240) (#d1d4dc secondary text)
  - muted: oklch(62% 0.015 240) (#787b86 labels)
  - border: oklch(22% 0.015 260) (#1e222d hair borders)
  - border focus: oklch(30% 0.018 260) (#2a2e39 interactive borders)
  - up (green): oklch(76% 0.18 160) (#089981 candlestick up / buy / profit)
  - up wash: oklch(18% 0.04 160)
  - down (red): oklch(72% 0.22 25) (#f23645 candlestick down / sell / loss)
  - down wash: oklch(18% 0.04 25)
  - sma (blue): oklch(72% 0.2 260) (#2962ff middle Bollinger band / buy quote)
  - amber: oklch(80% 0.16 75) (#f59e0b market closed / hold signal)
  - violet: oklch(75% 0.2 300) (#a855f7 trajectory path)
- Light mode overrides:
  - bg: oklch(96% 0.008 240) (#f0f3fa light paper)
  - surface: oklch(99% 0.005 240) (#ffffff clean white)
  - fg: oklch(16% 0.012 250) (#131722 deep charcoal)

## Spacing, Radius, Shadow

- Base unit: 4px
  - space-3xs: 2px
  - space-2xs: 4px
  - space-xs: 8px
  - space-sm: 12px
  - space-md: 16px
  - space-lg: 20px
  - space-xl: 28px
- Radius:
  - card: 8px
  - tile: 6px
  - pill: 9999px
- Shadows: zero soft drop shadows. Defined 1px hair borders only for institutional precision.

## Layout and Composition

- Structure: full-width workstation with two rows:
  - Row 1: Candlestick chart (67% width) beside predictive signals and forecast log table (33% width)
  - Row 2: Directional accuracy matrix (50% width) beside paper trading performance and regime statistics (50% width)
- Composition rule: tight padding inside tiles (8px to 12px), clean structural gaps between panels (12px to 16px)

## Component Craft Layer

- Buttons: three explicit states (default, hover, active scale 0.98, focus-visible 2px solid ring).
- Tables: right-aligned tabular numbers, sticky header row with subtle separator, hover highlight.
- Heatmap: 2x2 confusion matrix with proportional color wash intensities for True Up, False Down, False Up, True Down.
- Accessibility: contrast ratios above 4.5:1 on all text elements, keyboard navigation with focus rings, reduced-motion fallbacks.

## Slop Audit Checklist Results

- Zero generic AI typography (no Inter, no system-ui).
- Zero purple-to-blue gradient cards or spotlight glows.
- Zero cards-inside-cards with heavy stacked borders.
- Zero robotic machine learning jargon in UI copy:
  - Replaced LSTM multi-task mentions with Directional Model and Multi-horizon signal.
  - Replaced LightGBM mentions with Calibrated Forecaster.
  - Replaced Open-Jev epistemic mentions with Risk filter and Signal confidence.
  - Replaced Platt-Brier mathematical formulas with clean financial probability descriptions.
- Sloplint mechanical audit status: clean (0 FAIL, 0 REFLEX, 0 WARN across all source files).

