#!/usr/bin/env python3
"""
Publication-Quality Figure 3.1: End-to-End System Architecture (v3)
Perfected spacing, higher contrast, generous 3.0-unit inter-column channels,
and balanced content across all 10 modular cards.
"""

import matplotlib.pyplot as plt
import matplotlib.patches as patches
from pathlib import Path

# Setup ultra-high-definition canvas (4400 x 2500, aspect ~ 1.76 : 1)
fig, ax = plt.subplots(figsize=(29.3, 16.6), dpi=200)
ax.set_xlim(0, 100)
ax.set_ylim(0, 100)
ax.axis("off")
fig.patch.set_facecolor("#ffffff")

# Typography
FONT = "Helvetica Neue" if "Helvetica Neue" in [f.name for f in plt.matplotlib.font_manager.fontManager.ttflist] else "sans-serif"

# -------------------------------------------------------------
# 1. Main Header Banner
# -------------------------------------------------------------
ax.text(
    50, 97.4,
    "Figure 3.1: End-to-End System Architecture of the Adaptive Hybrid Machine Learning Framework",
    fontsize=25, fontweight="bold", color="#0f172a", ha="center", va="center", fontfamily=FONT
)
ax.text(
    50, 94.7,
    "S&P 500 Cash Index (SPX) • Multi-Task Random Forest (110 Trees) • Adaptive v2 Regime Spine • Conformal Risk Analytics • Real-Time Web & Pine Script",
    fontsize=14.5, fontweight="medium", color="#475569", ha="center", va="center", fontfamily=FONT
)

# Subtle header divider
ax.plot([1.8, 98.2], [93.1, 93.1], color="#cbd5e1", linewidth=1.5, zorder=2)

# Helper function to draw cards
def draw_card(
    ax, x, y, w, h,
    border_color, header_bg,
    step_num, step_name, subtitle,
    items
):
    # Card soft drop-shadow
    shadow = patches.FancyBboxPatch(
        (x + 0.3, y - 0.3), w, h,
        boxstyle="round,pad=0.0,rounding_size=1.0",
        facecolor="#0f172a", alpha=0.04, edgecolor="none", zorder=2
    )
    ax.add_patch(shadow)

    # Card background body
    card = patches.FancyBboxPatch(
        (x, y), w, h,
        boxstyle="round,pad=0.0,rounding_size=1.0",
        facecolor="#ffffff", edgecolor=border_color, linewidth=2.0, zorder=3
    )
    ax.add_patch(card)

    # Top header background
    header_h = 5.8
    header_band = patches.FancyBboxPatch(
        (x, y + h - header_h), w, header_h,
        boxstyle="round,pad=0.0,rounding_size=1.0",
        facecolor=header_bg, edgecolor="none", zorder=4
    )
    ax.add_patch(header_band)

    # Top accent colored strip
    top_strip = patches.FancyBboxPatch(
        (x, y + h - 0.7), w, 0.7,
        boxstyle="round,pad=0.0,rounding_size=0.2",
        facecolor=border_color, edgecolor="none", zorder=5
    )
    ax.add_patch(top_strip)

    # Header text (stacked)
    ax.text(
        x + 0.8, y + h - 1.9, f"STAGE {step_num} • {subtitle.upper()}",
        fontsize=9.5, fontweight="bold", color=border_color, va="center", zorder=6, fontfamily=FONT
    )
    ax.text(
        x + 0.8, y + h - 3.8, step_name,
        fontsize=14.5, fontweight="bold", color="#0f172a", va="center", zorder=6, fontfamily=FONT
    )

    # Divider under header
    ax.plot([x, x + w], [y + h - header_h, y + h - header_h], color=border_color, linewidth=1.0, alpha=0.35, zorder=5)

    # Card content items
    curr_y = y + h - header_h - 1.5
    for title, desc in items:
        # Title bullet
        ax.text(
            x + 0.8, curr_y, title,
            fontsize=12.0, fontweight="bold", color="#0f172a", va="top", zorder=6, fontfamily=FONT
        )
        curr_y -= 1.6
        # Multiline description
        lines = desc.split("\n")
        for line in lines:
            ax.text(
                x + 1.2, curr_y, line,
                fontsize=10.5, color="#334155", va="top", zorder=6, fontfamily=FONT
            )
            curr_y -= 1.4
        curr_y -= 0.65

# Connector helper with refined pill labels
def draw_connector(ax, x1, y1, x2, y2, label=None, color="#64748b", rad=0.0):
    ax.annotate(
        "", xy=(x2, y2), xytext=(x1, y1),
        arrowprops=dict(
            arrowstyle="->,head_length=0.65,head_width=0.45",
            color=color, lw=2.2,
            connectionstyle=f"arc3,rad={rad}",
            shrinkA=3, shrinkB=3
        ),
        zorder=10
    )
    if label:
        mx = (x1 + x2) / 2
        my = (y1 + y2) / 2
        ax.text(
            mx, my, label,
            fontsize=9.5, fontweight="bold", color="#0f172a",
            ha="center", va="center",
            bbox=dict(boxstyle="round,pad=0.32", facecolor="#ffffff", edgecolor=color, lw=1.3, alpha=0.98),
            zorder=12, fontfamily=FONT
        )

# -------------------------------------------------------------
# GEOMETRY (5 Columns, width = 16.6, gap = 3.0)
# -------------------------------------------------------------
W = 16.6
C1 = 2.0
C2 = 21.6
C3 = 41.2
C4 = 60.8
C5 = 80.4

TOP_Y = 51.0
TOP_H = 40.5
BOT_Y = 3.5
BOT_H = 43.5

# -------------------------------------------------------------
# COLUMN 1: INGESTION & FEATURES
# -------------------------------------------------------------
draw_card(
    ax, C1, TOP_Y, W, TOP_H,
    border_color="#2563eb", header_bg="#eff6ff",
    step_num="1", step_name="Market Data Ingestion", subtitle="SPX 5m RTH Cash Feed",
    items=[
        ("• 5m Candle Ingestion Feed", "SPX cash index (^GSPC) regular trading\nhours (09:30 - 16:00 EST). 78 bars/day."),
        ("• Volume Aggregation Layer", "Sum of constituent share volume with\nzero-volume holiday & cash fallback."),
        ("• Intraday Reference Anchors", "Computes Session VWAP, Prior Day\nHigh (PDH), Low (PDL), and Close (PDC)."),
        ("• Opening Range Filter (OR)", "First 30m high/low bounds (09:30-10:00)\nfor breakout and mean-reversion gating."),
        ("• Real-Time Polling Stream", "Async live worker polling 5m ticks with\nboundary validation and gap resets."),
    ]
)

draw_card(
    ax, C1, BOT_Y, W, BOT_H,
    border_color="#0891b2", header_bg="#ecfeff",
    step_num="2", step_name="Causal Feature Pipeline", subtitle="36 Normalized Features",
    items=[
        ("• Multi-Horizon Log Returns", "r1 (5m), r3 (15m), r6 (30m), r12 (60m)\nlagged price change trajectories."),
        ("• Moving Average Ribbon Distances", "Relative distances from EMA 9, 21, 50,\nand 200 expressed in basis points."),
        ("• Volatility & Dispersion Scales", "ATR(14), Realized Volatility (12 & 36 bars),\nand Parkinson high-low variance."),
        ("• Directional Trend Strength", "Wilder's ADX(14), +DI, -DI momentum\nindicators for trend vs chop detection."),
        ("• Candle Morphology & Spread", "Real-body ratio, upper/lower wick frac,\nhigh-low spread, and volume ratios."),
        ("• VWAP Z-Distance & Clock", "VWAP displacement normalized by ATR;\nminute-of-day cyclical sine/cosine time."),
    ]
)

# -------------------------------------------------------------
# COLUMN 2: MACHINE LEARNING & RULE SPINE
# -------------------------------------------------------------
draw_card(
    ax, C2, TOP_Y, W, TOP_H,
    border_color="#059669", header_bg="#ecfdf5",
    step_num="3", step_name="Multi-Task Random Forest", subtitle="110 Trees Primary Engine",
    items=[
        ("• Head 1: 5m Return Regressor (r_1)", "35 Trees | max_depth=6 | min_leaf=40\nPredicts next-bar expected return E[r_t+1]."),
        ("• Head 2: Direction (y_close_up)", "30 Trees | max_depth=6 | min_leaf=40\nBinary classifier P(Close_t+1 > Close_t)."),
        ("• Head 3: 30m Path Regressor", "25 Trees | max_depth=6 | min_leaf=40\nPredicts 6-bar terminal trajectory return."),
        ("• Head 4: Touch-Up Classifier", "20 Trees | max_depth=5 | min_leaf=40\nNext-bar barrier hit: P(High_t+1 > Close_t)."),
        ("• Regularization & Split Metrics", "MSE criterion (regressors) & Gini impurity\n(classifiers). High OOB generalization."),
    ]
)

draw_card(
    ax, C2, BOT_Y, W, BOT_H,
    border_color="#dc2626", header_bg="#fef2f2",
    step_num="4", step_name="Adaptive v2 Rule Spine", subtitle="Deterministic Regime Filter",
    items=[
        ("• ADX(14) Intraday Regime Filter", "Categorizes market state into TREND\n(ADX >= 25.0) vs RANGE (ADX < 25.0)."),
        ("• Multi-EMA Ribbon Concurrence", "Evaluates hierarchical order alignment:\nEMA 9 > 21 > 50 (Bull) / 9 < 21 < 50 (Bear)."),
        ("• Anchor Boundary Conformance", "Evaluates price position against VWAP\nslope, PDH/PDL, and OR 30m breakout."),
        ("• Standalone Rule Signal (v2_norm)", "Synthesizes indicators into bounded\ncontinuous signal: v2_norm in [-1.0, +1.0]."),
        ("• False-Breakout & Range Shield", "Vetoes chop during lunch doldrums;\nfilters low-volatility false momentum."),
        ("• Dynamic Rule Weight Allocation", "Allocates 60% rule weight in trending\nregimes; transitions to 50% in ranges."),
    ]
)

# -------------------------------------------------------------
# COLUMN 3: CALIBRATION & DECISION ARBITER
# -------------------------------------------------------------
draw_card(
    ax, C3, TOP_Y, W, TOP_H,
    border_color="#7c3aed", header_bg="#f5f3ff",
    step_num="5", step_name="Uncertainty & Calibration", subtitle="Platt Scaling & Conformal",
    items=[
        ("• Platt Sigmoid Calibrator", "Non-linear logistic transformation:\nP_cal = 1 / (1 + exp(-(A * P_raw + B)))\nMinimizes Brier score on touch probabilities."),
        ("• Conformal Prediction Intervals", "Distribution-free calibration residual bounds:\nInterval_90% = [y_hat - q_90, y_hat + q_90]\nGuarantees 90% empirical coverage."),
        ("• Multi-Horizon Path Uncertainty", "Propagates uncertainty cones across\nsequential 6-step (30m) forward paths."),
        ("• Reliability & Log-Loss Audit", "Eliminates tree probability overconfidence;\ncalibrates tail risks against intraday shocks."),
        ("• Real-Time Uncertainty Envelopes", "Dynamically expands bracket bands during\nvolatility spikes to avoid premature stops."),
    ]
)

draw_card(
    ax, C3, BOT_Y, W, BOT_H,
    border_color="#9333ea", header_bg="#faf5ff",
    step_num="6", step_name="Double-Gated Arbiter", subtitle="Dual-Concurrence Gate",
    items=[
        ("• Multi-Head ML Score Synthesis", "ML_Score = 0.50 * y_close_up +\n0.30 * r_1_norm + 0.20 * r_path_30m."),
        ("• Regime-Adaptive Blending", "• TREND: Score = 0.60 * v2 + 0.40 * ML\n• RANGE: Score = 0.50 * v2 + 0.50 * ML."),
        ("• Strict Dual-Concurrence Gating", "• LONG:  Hybrid >= +0.32 AND ML >= +0.04\n• SHORT: Hybrid <= -0.32 AND ML <= -0.04\n• HOLD:  Disagreement or |ML| < 0.04."),
        ("• Risk Gates & Entry Windows", "Suppresses entries outside 09:35-15:50 EST;\nblocks trades on volatility regime spikes."),
        ("• Final Action: { LONG, SHORT, HOLD }", "Discrete state machine dispatched to paper\nengine and live dashboard feed."),
    ]
)

# -------------------------------------------------------------
# COLUMN 4: QUANT RISK & EXECUTION
# -------------------------------------------------------------
draw_card(
    ax, C4, TOP_Y, W, TOP_H,
    border_color="#d97706", header_bg="#fffbeb",
    step_num="7", step_name="Quantitative Risk Engine", subtitle="Monte Carlo & Analytical Barrier",
    items=[
        ("• 2,000-Path Monte Carlo Cone", "Geometric Brownian Motion (GBM) paths:\nS(t+dt) = S(t)*exp((mu-0.5*sig^2)dt + sig*sqrt(dt)*Z)\nExtracts 10%, 50% (median), and 90% paths."),
        ("• Black-Scholes Barrier Structure", "Analytical first-passage touch probability\nfor TP (+2 ATR) and SL (-1 ATR) targets\nacross 5m, 10m, 15m, and 30m horizons."),
        ("• Value-at-Risk & Expected Shortfall", "Computes 95% Parametric VaR, Historical\nCVaR, and terminal 30m return histogram."),
        ("• Scalp Probability Term Structure", "Calculates instantaneous 3-point scalp hit\nrates to evaluate immediate trade velocity."),
        ("• Dynamic Tail Risk Monitoring", "Tracks 95% Expected Shortfall to trigger\nimmediate holding halts during flash crashes."),
    ]
)

draw_card(
    ax, C4, BOT_Y, W, BOT_H,
    border_color="#ea580c", header_bg="#fff7ed",
    step_num="8", step_name="Execution & Paper Engine", subtitle="Realistic Friction Simulation",
    items=[
        ("• Next-Bar Open Execution", "Orders filled at bar t+1 Open with realistic\n0.15 index pt/side commission & slippage."),
        ("• Dynamic Volatility Brackets", "• Take-Profit (TP): Entry +/- 2.0x ATR(14)\n• Stop-Loss (SL): Entry -/+ 1.0x ATR(14)\nMaintains asymmetric 2:1 profit/loss ratio."),
        ("• Time-Stop Limit (6 Bars / 30m)", "Forces position closure if neither bracket\ntarget is touched within 6 holding bars."),
        ("• Strict 15:55 Session Flatten", "Liquidates all active open exposures before\nmarket close to eliminate overnight gap risk."),
        ("• Continuous Performance Ledger", "Mark-to-market trade ledger, win rate,\nprofit factor, and equity curve tracking."),
    ]
)

# -------------------------------------------------------------
# COLUMN 5: DASHBOARD & DEPLOYMENT
# -------------------------------------------------------------
draw_card(
    ax, C5, TOP_Y, W, TOP_H,
    border_color="#0f172a", header_bg="#f1f5f9",
    step_num="9", step_name="React Live Dashboard", subtitle="Port 3000 Web UI",
    items=[
        ("• Interactive Candlestick Canvas", "Real-time TradingView Lightweight Charts\nrendering 5m candles and moving averages."),
        ("• Recurring Shaded S&R Zones", "Multi-timeframe supply & demand corridors\nwith dynamic ATR bounds & polarity flips."),
        ("• Forward Path & Conformal Fan", "Sequential 6-step 30m projections paired\nwith 90% conformal uncertainty envelope."),
        ("• Real-Time Quant Risk Gauges", "Live Monte Carlo simulation quantiles,\nterminal histograms, and VaR/CVaR bars."),
        ("• Dynamic Telemetry & Confusion Matrix", "Real-time win rate, profit factor, drawdown,\nand direction accuracy classifications."),
    ]
)

draw_card(
    ax, C5, BOT_Y, W, BOT_H,
    border_color="#1e293b", header_bg="#f8fafc",
    step_num="10", step_name="FastAPI & Pine Ecosystem", subtitle="Production Deployment",
    items=[
        ("• FastAPI Backend Engine (Port 8001)", "• Async polling loop ingesting live 5m bars\n• Low-latency WebSocket tick broadcast\n• REST endpoints for forecasts & ledger state\n• High-performance Python 3.12 runtime."),
        ("• Standalone TradingView Pine Script v6", "• 110-tree Random Forest compiled to Pine\n• Zero external webhooks or server latency\n• Native TradingView backtesting & alert parity\n• Matches Python engine bar-for-bar."),
        ("• Multi-Model Benchmark Suite", "Continuous evaluation of Random Forest vs\nHistGBM, MLP, Native LightGBM, and SVM."),
    ]
)

# -------------------------------------------------------------
# FLOW CONNECTORS (Clean routing with 3.0-unit gaps)
# -------------------------------------------------------------
# 1. Ingestion -> Features (vertical)
draw_connector(ax, C1 + W/2, TOP_Y, C1 + W/2, BOT_Y + BOT_H, label="Bars + Anchors", color="#2563eb")

# 2. Features -> Multi-Task RF (diagonal through middle lane)
draw_connector(ax, C1 + W, BOT_Y + BOT_H*0.75, C2, TOP_Y + TOP_H*0.35, label="36 Features", color="#0891b2", rad=0.07)

# 3. Features -> Adaptive v2 (horizontal)
draw_connector(ax, C1 + W, BOT_Y + BOT_H*0.3, C2, BOT_Y + BOT_H*0.3, label="Trend Feats", color="#0891b2")

# 4. RF -> Calibration (horizontal)
draw_connector(ax, C2 + W, TOP_Y + TOP_H*0.7, C3, TOP_Y + TOP_H*0.7, label="Raw Probs", color="#059669")

# 5. RF -> Arbiter (diagonal through middle lane)
draw_connector(ax, C2 + W, TOP_Y + TOP_H*0.25, C3, BOT_Y + BOT_H*0.75, label="ML Scores", color="#059669", rad=-0.07)

# 6. Adaptive v2 -> Arbiter (horizontal)
draw_connector(ax, C2 + W, BOT_Y + BOT_H*0.3, C3, BOT_Y + BOT_H*0.3, label="v2_norm", color="#dc2626")

# 7. Calibration -> Risk Engine (horizontal)
draw_connector(ax, C3 + W, TOP_Y + TOP_H*0.7, C4, TOP_Y + TOP_H*0.7, label="Calib Bounds", color="#7c3aed")

# 8. Arbiter -> Execution (horizontal)
draw_connector(ax, C3 + W, BOT_Y + BOT_H*0.3, C4, BOT_Y + BOT_H*0.3, label="Signals", color="#9333ea")

# 9. Risk Engine -> React Dashboard (horizontal)
draw_connector(ax, C4 + W, TOP_Y + TOP_H*0.7, C5, TOP_Y + TOP_H*0.7, label="Quant Cone", color="#d97706")

# 10. Execution -> FastAPI & Pine (horizontal)
draw_connector(ax, C4 + W, BOT_Y + BOT_H*0.3, C5, BOT_Y + BOT_H*0.3, label="Trade Fills", color="#ea580c")

# Vertical sync arrows between dashboard and backend
draw_connector(ax, C5 + W/2, BOT_Y + BOT_H, C5 + W/2, TOP_Y, label="WebSockets", color="#1e293b")

output_path = Path("reports/figures/fig3_1_system_architecture.png")
plt.savefig(output_path, bbox_inches="tight", dpi=200)
print(f"Generated perfected v3 architecture diagram at: {output_path}")
