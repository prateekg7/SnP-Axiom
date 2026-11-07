import React from 'react';
import { LayoutGrid, Sliders, Clock, Folder, Award, Search, Moon, ChevronDown, X, Sparkles } from 'lucide-react';

export default function MarketHeader({ market, isConnected, activeTab, setActiveTab }) {
  return (
    <header className="top-header-bar">
      <div className="header-left-cluster">
        <button
          type="button"
          onClick={() => setActiveTab('dashboard')}
          className={`pill-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2xs)' }}
        >
          <LayoutGrid size={15} />
          <span>Dashboard</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ledger')}
          className={`pill-btn ${activeTab === 'ledger' ? 'active' : ''}`}
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2xs)' }}
        >
          <Sliders size={15} />
          <span>Ledger</span>
        </button>

        <button type="button" className="header-icon-btn" title="Session time">
          <Clock size={16} />
        </button>
        <button type="button" className="header-icon-btn" title="Datasets">
          <Folder size={16} />
        </button>
        <button type="button" className="header-icon-btn" title="Model tier">
          <Award size={16} />
        </button>

        {/* Active Instrument Tab Chip */}
        <div className="active-pair-chip">
          <div className="pair-badge-icon">
            <Sparkles size={14} />
          </div>
          <div>
            <div className="pair-badge-title">SPX / USD</div>
            <div className="pair-badge-sub">{market?.source || 'Yahoo Finance'}</div>
          </div>
          <button
            type="button"
            className="pill-btn"
            style={{ padding: 'var(--space-3xs)', border: 'none', background: 'transparent' }}
            title="Reset"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      <div className="header-right-cluster">
        <button type="button" className="header-icon-btn" title="Search">
          <Search size={16} />
        </button>

        <span className={`pill ${market?.is_regular_session ? 'pill-green' : 'pill-amber'}`}>
          <Clock size={12} />
          <span>{market?.is_regular_session ? 'regular session' : 'closed'}</span>
        </span>

        <button type="button" className="header-icon-btn" title="Session mode">
          <Moon size={16} />
        </button>

        <div className="profile-pill">
          <div className="profile-avatar">QD</div>
          <span>Quant Desk</span>
          <ChevronDown size={14} />
        </div>
      </div>
    </header>
  );
}