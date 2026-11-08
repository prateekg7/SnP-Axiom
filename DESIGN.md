# DESIGN.md: SPX Axiom Quantitative Terminal

## Context and Purpose

- Artifact type: quantitative trading terminal and research dashboard
- Positioning: institutional financial simulation workstation
- Audience: quantitative traders, portfolio managers, risk analysts
- Primary instrument: S&P 500 cash index (SPX) exclusively
- Operational scope: hypothetical paper trading simulation only
- Primary action: evaluate intraday SPX directional signals, volatility regimes, and asymmetric bracket executions
- Core values: disciplined, institutional, sharp, transparent
  - Disciplined: tight tabular spacing and zero decorative padding
  - Institutional: pitch black dark canvas and high-contrast candlesticks
  - Sharp: monospace tabular data alignment and crisp 1px borders
  - Transparent: explicit empirical coverage metrics and out-of-sample confusion matrix
- Density: dense financial workstation

## Architecture and Layout

- Layout structure: full-width workstation with two rows:
  - Upper row: Candlestick chart (67% width) alongside predictive signals table and forecast log table (33% width)
  - Lower row: Directional accuracy matrix (50% width) alongside paper trading performance and regime statistics (50% width)
- Flat surface structure: eliminates nested cards within cards. Functional containers sit directly on the primary canvas. Metrics and signals appear inside flat data rows separated by 1px hairline dividers.
- Spacing: 4px to 6px grid gaps between primary terminal cards. Padding within data rows ranges from 2px to 8px for compact density.

## Typography

- UI and display font: IBM Plex Sans (weights 400, 500, 600, 700)
- Numerals, prices, deltas, and tables: IBM Plex Mono (weights 400, 500, 600)
- Numeric formatting: all prices, point spreads, percentages, and metrics use tabular numerals (`font-variant-numeric: tabular-nums`) with right alignment.
- Scale:
  - text-xs: 0.75rem (12px), line-height 1.35 (labels, status chips, table cells)
  - text-sm: 0.8125rem (13px), line-height 1.4 (subheadings, secondary figures)
  - text-md: 0.875rem (14px), line-height 1.5 (panel titles, primary rows)
  - text-lg: 1.0625rem (17px), line-height 1.4 (metric highlights)
  - text-xl: 1.25rem (20px), line-height 1.2 (key prices, target percentages)
  - text-display: 2.0rem (32px), line-height 1.1 (hero P&L figure)

## Color Palette

- Dark theme (pitch black):
  - Canvas background: oklch(8% 0.008 260) (#080808)
  - Surface panels: oklch(10% 0.008 260) (#101010)
  - Elevated tiles: oklch(13% 0.010 260) (#151515)
  - Interactive hover: oklch(17% 0.012 260) (#1e1e1e)
  - Primary ink: oklch(96% 0.010 240) (#f0f3fa)
  - Secondary ink: oklch(86% 0.010 240) (#d1d4dc)
  - Muted labels: oklch(62% 0.015 240) (#787b86)
  - Hairline borders: oklch(18% 0.010 260) (#1c1c1c)
  - Interactive borders: oklch(24% 0.012 260) (#282828)
  - Upward movement (green): oklch(76% 0.180 160) (#089981)
  - Downward movement (red): oklch(72% 0.220 25) (#f23645)
  - Bollinger baseline (blue): oklch(72% 0.200 260) (#2962ff)
  - Neutral / Hold: oklch(80% 0.160 75) (#f59e0b)
  - Chart grid lines: #0a0a0a (faint and unobtrusive)

- Light theme (cream paper):
  - Canvas background: oklch(96% 0.018 85) (#f7f4ed)
  - Surface panels: oklch(99% 0.008 85) (#fdfbf7)
  - Elevated tiles: oklch(94% 0.020 85) (#f2ede2)
  - Interactive hover: oklch(91% 0.022 85) (#e8e0d0)
  - Primary ink: oklch(18% 0.020 70) (#1c1917)
  - Secondary ink: oklch(34% 0.020 70) (#44403c)
  - Muted labels: oklch(52% 0.020 70) (#78716c)
  - Hairline borders: oklch(88% 0.020 85) (#ded6c3)
  - Interactive borders: oklch(80% 0.025 85) (#cbbeaa)
  - Upward movement: oklch(60% 0.170 155) (#047857)
  - Downward movement: oklch(58% 0.210 25) (#dc2626)
  - Chart grid lines: #ede8dd (barely visible warm cream grid)

## Radii and Shapes

- Corner radius:
  - Panels and containers: 2px (`--radius-card`)
  - Badges, status tags, tabs, and buttons: 2px (`--radius-tile`)
  - Pills: eliminated. No elements use `border-radius: 9999px`.
- Shadows: zero soft drop shadows. Visual depth is established through 1px hairline rules and slight surface luminosity shifts.
- Badges and buttons: rectangular, flat tags with crisp 2px corners. Inactive tabs use transparent backgrounds without border outlines, preventing visual clutter.

## Charts and Data Visualization

- Price chart: candlestick rendering for 5-minute bars, Bollinger bands (20 SMA with 2 standard deviation channel), 30-minute forward trajectory path, and asymmetric predictive interval bands.
- Axis rendering: right-hand price scale and bottom time scale with faint grid lines.
- Confusion matrix: 2x2 grid contrasting predicted directions against actual outcomes, with selective intensity washes on hit and miss cells.
- Logs table: tabular log of five-minute interval predictions, confidence scores, target bounds, and simulated trade actions.

## Anti-Slop Audit Checklist

- Zero decorative SVG icons in chrome, headers, badges, or buttons.
- Zero rounded pill structures.
- Zero nested card-in-card containers or decorative drop shadows.
- Zero generic AI typography (Inter, Space Grotesk, Plus Jakarta Sans).
- Zero robotic jargon in interface copy (no raw model references; labels use plain financial terminology like Directional Model and Calibrated Forecaster).
- Sloplint verification: clean with zero failures, zero reflex flags, and zero warnings.
