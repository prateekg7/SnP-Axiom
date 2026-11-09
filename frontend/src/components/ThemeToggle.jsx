import React from 'react';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={onToggle}
      className="theme-toggle-btn"
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      {isDark ? (
        <Sun size={14} aria-hidden="true" className="theme-toggle-icon" />
      ) : (
        <Moon size={14} aria-hidden="true" className="theme-toggle-icon" />
      )}
      <span className="theme-toggle-text">{isDark ? 'Light' : 'Dark'}</span>
    </button>
  );
}
