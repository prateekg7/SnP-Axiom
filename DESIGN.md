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
  - Header: minimal navigation strip with instrument title on the left and theme toggle with Sun or Moon icon on the right
  - Upper row: Candlestick chart (67% width) alongside predictive signals table and forecast log table (33% width)
  - Lower row: Directional accuracy matrix (50% width) alongside paper trading performance and regime statistics (50% width)
- Flat surface structure: eliminates nested cards within cards. Functional containers sit directly on the primary canvas. Metrics and signals appear inside flat data rows separated by 1px hairline dividers.
- Spacing: 4px to 6px grid gaps between primary terminal cards. Padding within data rows ranges from 2px to 8px for compact density.

## Typography

- Primary interface and display font: Geist (weights 300 to 800)
- Numerals, prices, deltas, chart labels, and tables: Geist Mono (weights 300 to 700)
- Shadcn menu controls: isolated to `--font-shadcn` (IBM Plex Sans with system fallbacks)
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
  - Chart grid lines: #222634 (visible dotted coordinate grid)

- Light theme (standard neutral light):
  - Canvas background: oklch(97.5% 0.006 240) (#f8fafc)
  - Surface panels: oklch(99.2% 0.005 240) (#ffffff)
  - Elevated tiles: oklch(95% 0.006 240) (#f1f5f9)
  - Interactive hover: oklch(91% 0.008 240) (#e2e8f0)
  - Primary ink: oklch(14% 0.015 240) (#0f172a)
  - Secondary ink: oklch(28% 0.015 240) (#334155)
  - Muted labels: oklch(54% 0.012 240) (#64748b)
  - Hairline borders: oklch(89% 0.005 240) (#e2e8f0)
  - Interactive borders: oklch(80% 0.008 240) (#cbd5e1)
  - Upward movement: oklch(48% 0.160 160) (#089981)
  - Downward movement: oklch(50% 0.220 25) (#f23645)
  - Chart grid lines: #dbe0e8 (visible light coordinate grid)

## Radii and Shapes

- Corner radius:
  - Panels and containers: 2px (`--radius-card`)
  - Badges, status tags, tabs, and buttons: 2px (`--radius-tile`)
  - Pills: eliminated. No elements use `border-radius: 9999px`.
- Shadows: zero soft drop shadows. Visual depth is established through 1px hairline rules and slight surface luminosity shifts.
- Badges and buttons: rectangular, flat tags with crisp 2px corners. Inactive tabs use transparent backgrounds without border outlines, preventing visual clutter.

## Charts and Data Visualization

- Price chart series views:
  - Candlesticks: standard OHLC bodies and wicks
  - OHLC Bars: high-contrast institutional bar chart with open and close tick marks
  - Area: continuous closing price line with translucent area gradient fill
  - Baseline: relative price deviation above or below the session anchor
- Traditional indicator overlays:
  - Bollinger Bands: 20-period simple moving average with two standard deviation envelope
  - Exponential moving averages: EMA 9 for fast momentum, EMA 21 for intermediate direction, EMA 50 for trend baseline
  - Session VWAP: intraday volume-weighted average price benchmark
  - Active indicator values appear in the chart status header and as right-axis price lines
- Top menu dropdown controls:
  - Radix primitive dropdowns replace dense button clusters with 40px hit targets
  - View menu: selects chart series rendering mode
  - Predictions menu: toggles 30m forward trajectory, 5m barrier level, or clears projections
  - Indicators menu: independent checkboxes for Bollinger Bands, EMA 9, EMA 21, EMA 50, and VWAP
- Timeframe zoom controls:
  - Sized at 34px height with monospace labels
  - 1D maps to 78 intraday 5-minute bars
  - 5D maps to 390 bars covering one trading week
  - 1M maps to 1,560 bars covering one trading month
  - All fits the complete historical range
- Prediction visualizations on chart:
  - 30m forward trajectory: 6-step projected path line spanning five to thirty minutes ahead
  - 30m confidence envelope: 90% asymmetric predictive interval bounds
  - 30m extrema lines: projected low and high channel bounds
  - 5m directional target: single-step price level marker
  - Control modes: 30m path, 5m target, all, off
- Predictive signals panel:
  - 5m cycle view: directional close, calibrated touch barrier probability, drift rate, and spread threshold
  - 30m cycle view: 30m expected close, six-horizon trajectory progression strip, 90% confidence envelope, and projected extrema
  - Combined view: paired 5m directional vectors alongside 30m terminal destinations
- Forecast log table:
  - 5m log view: time, reference price, 5m expected delta, barrier probability, action, and resolution status
  - 30m log view: time, reference price, 30m destination delta, 30m low and high range, action, and resolution status
- Axis rendering: right-hand price scale and bottom time scale with faint grid lines.
- Confusion matrix: 2x2 grid contrasting predicted directions against actual outcomes, with selective intensity washes on hit and miss cells.

## Anti-Slop Audit Checklist

- Zero decorative SVG icons in chrome, headers, badges, or buttons.
- Zero rounded pill structures.
- Zero nested card-in-card containers or decorative drop shadows.
- Zero generic AI typography (Inter, Space Grotesk, Plus Jakarta Sans).
- Zero robotic jargon in interface copy (no raw model references; labels use plain financial terminology like Directional Model and Calibrated Forecaster).
- Sloplint verification: clean with zero failures, zero reflex flags, and zero warnings.
