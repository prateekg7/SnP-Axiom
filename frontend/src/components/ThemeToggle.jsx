import React from 'react';

export default function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={onToggle}
      className="theme-toggle-btn"
      title={`Switch to ${isDark ? 'cream' : 'dark'} mode`}
      aria-label={`Switch to ${isDark ? 'cream' : 'dark'} mode`}
    >
      <span>{isDark ? 'theme: dark' : 'theme: cream'}</span>
    </button>
  );
}
