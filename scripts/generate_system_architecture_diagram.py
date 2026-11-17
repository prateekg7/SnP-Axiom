#!/usr/bin/env python3
"""
Flowchart v3: Perfected vertical spacing, generous middle channel,
compact connector badges that fit cleanly without clipping borders.
"""

import matplotlib.pyplot as plt
import matplotlib.patches as patches
from pathlib import Path

# Setup canvas: 30 x 16 inches at 200 DPI (6000 x 3200 px)
fig, ax = plt.subplots(figsize=(30, 16), dpi=200)
ax.set_xlim(0, 100)
ax.set_ylim(0, 100)
ax.axis("off")
fig.patch.set_facecolor("#ffffff")

FONT = "Helvetica Neue" if "Helvetica Neue" in [f.name for f in plt.matplotlib.font_manager.fontManager.ttflist] else "sans-serif"

# -------------------------------------------------------------
# 1. Main Header
# -------------------------------------------------------------
ax.text(
    50, 96.6,
    "Figure 3.1: System Architecture & Quantitative Pipeline Flowchart",
    fontsize=25, fontweight="bold", color="#0f172a", ha="center", va="center", fontfamily=FONT
)
ax.text(
    50, 93.9,
    "S&P 500 Cash Index (SPX) • Dual-Track Hybrid Engine (Multi-Task ML + Adaptive v2) • Risk Analytics & Live Execution",
    fontsize=14.0, fontweight="medium", color="#475569", ha="center", va="center", fontfamily=FONT
)

# Header divider
ax.plot([2.0, 98.0], [92.2, 92.2], color="#cbd5e1", linewidth=1.5, zorder=2)

# Helper function to draw flowchart nodes
def draw_flow_node(
    ax, x, y, w, h,
    border_color, header_bg,
    badge_text, title_text,
    bullets,
    is_decision=False
):
    # Shadow
    shadow = patches.FancyBboxPatch(
        (x + 0.35, y - 0.35), w, h,
        boxstyle="round,pad=0.0,rounding_size=1.2",
        facecolor="#0f172a", alpha=0.04, edgecolor="none", zorder=2
    )
    ax.add_patch(shadow)

    # Box body
    card = patches.FancyBboxPatch(
        (x, y), w, h,
        boxstyle="round,pad=0.0,rounding_size=1.2",
        facecolor="#ffffff", edgecolor=border_color, linewidth=2.5 if is_decision else 2.0, zorder=3
    )
    ax.add_patch(card)

    # Header bar
    header_h = 6.0
    header_band = patches.FancyBboxPatch(
        (x, y + h - header_h), w, header_h,
        boxstyle="round,pad=0.0,rounding_size=1.2",
        facecolor=header_bg, edgecolor="none", zorder=4
    )
    ax.add_patch(header_band)

    # Top accent line
    top_strip = patches.FancyBboxPatch(
        (x, y + h - 0.8), w, 0.8,
        boxstyle="round,pad=0.0,rounding_size=0.3",
        facecolor=border_color, edgecolor="none", zorder=5
    )
    ax.add_patch(top_strip)

    # Header text
    ax.text(
        x + 1.0, y + h - 2.0, badge_text.upper(),
        fontsize=9.8, fontweight="bold", color=border_color, va="center", zorder=6, fontfamily=FONT
    )
    ax.text(
        x + 1.0, y + h - 4.2, title_text,
        fontsize=14.5, fontweight="bold", color="#0f172a", va="center", zorder=6, fontfamily=FONT
    )

    # Divider below header
    ax.plot([x, x + w], [y + h - header_h, y + h - header_h], color=border_color, linewidth=1.0, alpha=0.3, zorder=5)

    # Bullets (Generous vertical spacing, perfectly centered in card)
    curr_y = y + h - header_h - 2.5
    for bold_tag, detail in bullets:
        ax.text(
            x + 1.0, curr_y, f"• {bold_tag}:",
            fontsize=12.2, fontweight="bold", color="#0f172a", va="top", zorder=6, fontfamily=FONT
        )
        curr_y -= 1.8
        ax.text(
            x + 1.5, curr_y, detail,
            fontsize=11.0, color="#334155", va="top", zorder=6, fontfamily=FONT
        )
        curr_y -= 3.8

# Flowchart Arrow helper
def draw_flow_arrow(ax, x1, y1, x2, y2, label=None, color="#64748b", rad=0.0, lw=2.4):
    ax.annotate(
        "", xy=(x2, y2), xytext=(x1, y1),
        arrowprops=dict(
            arrowstyle="-|>,head_length=0.7,head_width=0.45",
            color=color, lw=lw,
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
            fontsize=9.0, fontweight="bold", color="#0f172a",
            ha="center", va="center",
            bbox=dict(boxstyle="round,pad=0.28", facecolor="#ffffff", edgecolor=color, lw=1.3, alpha=0.98),
            zorder=12, fontfamily=FONT
        )

# -------------------------------------------------------------
# GEOMETRY
# -------------------------------------------------------------
W = 16.6
C1 = 2.0
C2 = 21.6
C3 = 41.2
C4 = 60.8
C5 = 80.4

TOP_Y = 55.0
TOP_H = 32.5
BOT_Y = 8.5
BOT_H = 32.5

# -------------------------------------------------------------
# 1. INGESTION & ANCHORS (C1 Top)
# -------------------------------------------------------------
draw_flow_node(
    ax, C1, TOP_Y, W, TOP_H,
    border_color="#2563eb", header_bg="#eff6ff",
    badge_text="Input Stage",
    title_text="SPX Market Data Feed",
    bullets=[
        ("5m OHLCV Candles", "Regular trading hours (09:30–16:00 EST)"),
        ("Intraday Anchors", "Session VWAP, Prior Day High/Low (PDH/PDL)"),
        ("Opening Range (OR)", "First 30m high/low breakout bounds"),
        ("Constituent Volume", "Aggregated volume with cash zero fallback")
    ]
)

# -------------------------------------------------------------
# 2. CAUSAL FEATURE PIPELINE (C1 Bottom)
# -------------------------------------------------------------
draw_flow_node(
    ax, C1, BOT_Y, W, BOT_H,
    border_color="#0891b2", header_bg="#ecfeff",
    badge_text="Feature Pipeline",
    title_text="36 Causal Indicators",
    bullets=[
        ("Multi-Horizon Returns", "Log-returns: r1 (5m), r3, r6, and r12 (60m)"),
        ("Trend Ribbons", "Normalized distances from EMA 9, 21, 50, 200"),
        ("Volatility Scales", "ATR(14), Realized Vol (12 & 36), Parkinson"),
        ("Morphology & Clock", "Wick ratios, VWAP z-dist, minute-of-day")
    ]
)

# -------------------------------------------------------------
# 3. MULTI-TASK RANDOM FOREST (C2 Top)
# -------------------------------------------------------------
draw_flow_node(
    ax, C2, TOP_Y, W, TOP_H,
    border_color="#059669", header_bg="#ecfdf5",
    badge_text="ML Track (110 Trees)",
    title_text="Multi-Task Random Forest",
    bullets=[
        ("Head 1: r_1 Regressor", "35 Trees | 5m expected return regressor"),
        ("Head 2: Direction y_close", "30 Trees | 5m directional classifier"),
        ("Head 3: 30m Path Regressor", "25 Trees | 30m terminal path regressor"),
        ("Head 4: Touch-Up Classifier", "20 Trees | Next-bar barrier touch classifier")
    ]
)

# -------------------------------------------------------------
# 4. ADAPTIVE V2 REGIME SPINE (C2 Bottom)
# -------------------------------------------------------------
draw_flow_node(
    ax, C2, BOT_Y, W, BOT_H,
    border_color="#dc2626", header_bg="#fef2f2",
    badge_text="Rule Track (Deterministic)",
    title_text="Adaptive v2 Regime Spine",
    bullets=[
        ("ADX Regime Filter", "TREND (ADX >= 25) vs RANGE (ADX < 25)"),
        ("Ribbon Alignment", "Multi-EMA 9 > 21 > 50 trend confirmation"),
        ("Anchor Boundaries", "VWAP slope & 30m Opening Range breakouts"),
        ("Rule Output Signal", "Continuous score: v2_norm in [-1.0, +1.0]")
    ]
)

# -------------------------------------------------------------
# 5. UNCERTAINTY & CALIBRATION (C3 Top)
# -------------------------------------------------------------
draw_flow_node(
    ax, C3, TOP_Y, W, TOP_H,
    border_color="#7c3aed", header_bg="#f5f3ff",
    badge_text="Uncertainty Quantification",
    title_text="Calibration & Conformal",
    bullets=[
        ("Platt Sigmoid Scaler", "P_cal = 1 / (1 + exp(-(A * P_raw + B)))"),
        ("Conformal Intervals", "90% empirical coverage: [y_hat ± q_90]"),
        ("Multi-Horizon Fans", "Uncertainty expansion across 30m path"),
        ("Reliability Audit", "Minimizes Brier score & eliminates tree bias")
    ]
)

# -------------------------------------------------------------
# 6. DOUBLE-GATED DECISION ARBITER (C3 Bottom)
# -------------------------------------------------------------
draw_flow_node(
    ax, C3, BOT_Y, W, BOT_H,
    border_color="#9333ea", header_bg="#faf5ff",
    badge_text="Decision Arbiter",
    title_text="Double-Gated Fusion",
    bullets=[
        ("Score Synthesis", "ML = 0.50*y_close + 0.30*r_1 + 0.20*path"),
        ("Regime Blending", "Trend (60% v2 + 40% ML) | Range (50/50)"),
        ("Dual-Concurrence Gate", "Score >= ±0.32 AND |ML| >= 0.04 confirm"),
        ("Output Action", "Dispatches discrete: { LONG, SHORT, HOLD }")
    ],
    is_decision=True
)

# -------------------------------------------------------------
# 7. QUANTITATIVE RISK ENGINE (C4 Top)
# -------------------------------------------------------------
draw_flow_node(
    ax, C4, TOP_Y, W, TOP_H,
    border_color="#d97706", header_bg="#fffbeb",
    badge_text="Risk Analytics",
    title_text="Quantitative Risk Engine",
    bullets=[
        ("2,000-Path Monte Carlo", "Geometric Brownian Motion cone (10/50/90%)"),
        ("Black-Scholes Barrier", "First-passage touch hit rates (5m–30m)"),
        ("Value-at-Risk (95%)", "Parametric VaR & Historical CVaR shortfall"),
        ("Scalp Probability", "3-point instant velocity hit rate structure")
    ]
)

# -------------------------------------------------------------
# 8. STATEFUL EXECUTION ENGINE (C4 Bottom)
# -------------------------------------------------------------
draw_flow_node(
    ax, C4, BOT_Y, W, BOT_H,
    border_color="#ea580c", header_bg="#fff7ed",
    badge_text="Execution Simulator",
    title_text="Paper Trading Engine",
    bullets=[
        ("Next-Open Execution", "Realistic fill with 0.15 pt/side friction"),
        ("Dynamic ATR Brackets", "2.0x ATR Profit Target / 1.0x ATR Stop Loss"),
        ("Time-Stop Timeout", "Forced exit after 6 holding bars (30 min)"),
        ("15:55 Session Flatten", "Zero overnight gap risk; MTM trade ledger")
    ]
)

# -------------------------------------------------------------
# 9. REACT LIVE DASHBOARD (C5 Top)
# -------------------------------------------------------------
draw_flow_node(
    ax, C5, TOP_Y, W, TOP_H,
    border_color="#0f172a", header_bg="#f1f5f9",
    badge_text="Web Interface",
    title_text="React Live Dashboard (3000)",
    bullets=[
        ("Candlestick Canvas", "TradingView Lightweight Chart + 5m candles"),
        ("Recurring S&R Zones", "ATR supply & demand bands with polarity flips"),
        ("Forward Projections", "6-step trajectory cone with 90% conformal fan"),
        ("Real-Time Telemetry", "Dynamic confusion matrix, equity curves, VaR")
    ]
)

# -------------------------------------------------------------
# 10. FASTAPI & PINE ECOSYSTEM (C5 Bottom)
# -------------------------------------------------------------
draw_flow_node(
    ax, C5, BOT_Y, W, BOT_H,
    border_color="#1e293b", header_bg="#f8fafc",
    badge_text="Production Deployment",
    title_text="FastAPI & Pine Ecosystem",
    bullets=[
        ("FastAPI Backend (8001)", "Async 5m polling worker & REST API endpoints"),
        ("WebSocket Stream", "Low-latency live tick & forecast broadcast"),
        ("Standalone Pine Script", "110-tree Random Forest compiled to Pine v6"),
        ("Execution Parity", "Full bar-for-bar parity with Python backtest")
    ]
)

# -------------------------------------------------------------
# CLEAN FLOWCHART CONNECTORS (Short, crisp labels that fit gaps)
# -------------------------------------------------------------
# 1. Ingestion -> Features (Vertical down)
draw_flow_arrow(ax, C1 + W/2, TOP_Y, C1 + W/2, BOT_Y + BOT_H, label="OHLCV + Anchors", color="#2563eb")

# 2. Features -> Multi-Task RF (Diagonal up through wide 14-unit channel)
draw_flow_arrow(ax, C1 + W, BOT_Y + BOT_H*0.8, C2, TOP_Y + TOP_H*0.3, label="36 Features", color="#0891b2", rad=0.08)

# 3. Features -> Adaptive v2 (Horizontal)
draw_flow_arrow(ax, C1 + W, BOT_Y + BOT_H*0.4, C2, BOT_Y + BOT_H*0.4, label="Trend Feats", color="#0891b2")

# 4. Multi-Task RF -> Calibration (Horizontal)
draw_flow_arrow(ax, C2 + W, TOP_Y + TOP_H*0.5, C3, TOP_Y + TOP_H*0.5, label="Raw Probs", color="#059669")

# 5. Calibration -> Decision Arbiter (Vertical down)
draw_flow_arrow(ax, C3 + W/2, TOP_Y, C3 + W/2, BOT_Y + BOT_H, label="Calib Touch", color="#7c3aed")

# 6. Adaptive v2 -> Decision Arbiter (Horizontal)
draw_flow_arrow(ax, C2 + W, BOT_Y + BOT_H*0.5, C3, BOT_Y + BOT_H*0.5, label="v2_norm", color="#dc2626")

# 7. Calibration -> Quant Risk Engine (Horizontal)
draw_flow_arrow(ax, C3 + W, TOP_Y + TOP_H*0.5, C4, TOP_Y + TOP_H*0.5, label="90% Bounds", color="#7c3aed")

# 8. Decision Arbiter -> Execution Engine (Horizontal)
draw_flow_arrow(ax, C3 + W, BOT_Y + BOT_H*0.5, C4, BOT_Y + BOT_H*0.5, label="Signals", color="#9333ea")

# 9. Quant Risk Engine -> React Dashboard (Horizontal)
draw_flow_arrow(ax, C4 + W, TOP_Y + TOP_H*0.5, C5, TOP_Y + TOP_H*0.5, label="Risk Cone", color="#d97706")

# 10. Execution Engine -> FastAPI & Pine (Horizontal)
draw_flow_arrow(ax, C4 + W, BOT_Y + BOT_H*0.5, C5, BOT_Y + BOT_H*0.5, label="Fills & MTM", color="#ea580c")

# 11. Dashboard <-> FastAPI (Vertical bidirectional sync)
ax.annotate(
    "", xy=(C5 + W/2, TOP_Y), xytext=(C5 + W/2, BOT_Y + BOT_H),
    arrowprops=dict(
        arrowstyle="<|-|>,head_length=0.7,head_width=0.45",
        color="#1e293b", lw=2.4, shrinkA=3, shrinkB=3
    ),
    zorder=10
)
ax.text(
    C5 + W/2, (TOP_Y + BOT_Y + BOT_H)/2, "WebSockets & REST",
    fontsize=9.0, fontweight="bold", color="#0f172a",
    ha="center", va="center",
    bbox=dict(boxstyle="round,pad=0.28", facecolor="#ffffff", edgecolor="#1e293b", lw=1.3, alpha=0.98),
    zorder=12, fontfamily=FONT
)

# Output save
output_path = Path("reports/figures/fig3_1_system_architecture.png")
plt.savefig(output_path, bbox_inches="tight", dpi=200)
print(f"Generated clean flowchart v3 at: {output_path}")
