import React from 'react';

interface TopBarProps {
  title: string;
  description: string;
  onTogglePanel: () => void;
  toggleLabel: string;
  onSignOut?: () => Promise<void>;
}

export function TopBar({ title, description, onTogglePanel, toggleLabel, onSignOut }: TopBarProps) {
  const handleSignOut = async () => {
    if (onSignOut) {
      await onSignOut();
    }
  };

  return (
    <header className="topbar">
      <div className="topbar__content">
        <div>
          <div className="eyebrow">Simulation</div>
          <h1 className="title">{title}</h1>
        </div>
        <p className="description">{description}</p>
      </div>
      <div className="topbar__actions">
        <button className="toggle-button" onClick={onTogglePanel}>
          {toggleLabel}
        </button>
        {onSignOut && (
          <button className="toggle-button" onClick={handleSignOut}>
            Sign out
          </button>
        )}
      </div>
    </header>
  );
}
