import React from 'react';

export type UtilityTab = 'Task' | 'Tools' | 'Response' | 'Notes' | 'Resources' | 'Settings';

interface TaskData {
  prompt: string;
  checklist: string[];
}

interface UtilityPanelProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  activeTab: UtilityTab;
  onTabChange: (tab: UtilityTab) => void;
  isLoading: boolean;
  error: string | null;
  task: TaskData | null;
  gridAllowed: boolean;
  pinsAllowed: boolean;
  showGrid: boolean;
  pinMode: boolean;
  onGridToggle: () => void;
  onPinModeToggle: () => void;
  responseText: string;
  onResponseChange: (value: string) => void;
  controlsDisabled?: boolean;
}

const TABS: { key: UtilityTab; label: string }[] = [
  { key: 'Task', label: 'Task' },
  { key: 'Tools', label: 'Tools' },
  { key: 'Response', label: 'Response' },
  { key: 'Notes', label: 'Notes' },
  { key: 'Resources', label: 'Resources' },
  { key: 'Settings', label: 'Settings' },
];

export function UtilityPanel({
  collapsed,
  onToggleCollapse,
  activeTab,
  onTabChange,
  isLoading,
  error,
  task,
  gridAllowed,
  pinsAllowed,
  showGrid,
  pinMode,
  onGridToggle,
  onPinModeToggle,
  responseText,
  onResponseChange,
  controlsDisabled = false,
}: UtilityPanelProps) {
  const renderTaskContent = () => {
    if (isLoading) return <div className="status">Loading task…</div>;
    if (error) return <div className="status status--error">{error}</div>;
    if (!task) return <p className="utility-panel__placeholder">Task details will appear here.</p>;

    return (
      <div className="task-tab">
        <p className="task-prompt">{task.prompt}</p>
        <div className="checklist">
          <div className="checklist__title">Checklist</div>
          <ul>
            {task.checklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  };

  const renderToolsContent = () => {
    if (isLoading) return <div className="status">Loading tools…</div>;
    if (error) return <div className="status status--error">{error}</div>;

    const noToolsAvailable = !gridAllowed && !pinsAllowed;

    return (
      <div className="tools-tab">
        {gridAllowed && (
          <label className="tool-toggle">
            <input
              type="checkbox"
              checked={showGrid}
              onChange={onGridToggle}
              disabled={controlsDisabled}
            />
            Show grid overlay
          </label>
        )}
        {pinsAllowed && (
          <label className="tool-toggle">
            <input
              type="checkbox"
              checked={pinMode}
              onChange={onPinModeToggle}
              disabled={controlsDisabled}
            />
            Pin mode (click the scene to place pins)
          </label>
        )}
        {noToolsAvailable && <p className="subtle-text">No tools are available for this scene.</p>}
        <p className="utility-panel__placeholder">Tool outputs and controls will appear here as they are added.</p>
      </div>
    );
  };

  const renderResponseContent = () => {
    if (isLoading) return <div className="status">Loading response…</div>;
    if (error) return <div className="status status--error">{error}</div>;

    return (
      <div className="response-tab">
        <label className="response-label" htmlFor="primary-response">
          Primary response
        </label>
        <textarea
          id="primary-response"
          className="response-textarea"
          value={responseText}
          onChange={(event) => onResponseChange(event.target.value)}
          placeholder="Capture your findings, reasoning, or next steps here."
          rows={10}
          disabled={controlsDisabled}
        />
        <p className="subtle-text">Responses save to your draft and are included in submissions.</p>
      </div>
    );
  };

  const renderPlaceholder = (message: string) => (
    <div className="utility-panel__placeholder">{message}</div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'Task':
        return renderTaskContent();
      case 'Tools':
        return renderToolsContent();
      case 'Response':
        return renderResponseContent();
      case 'Notes':
        return renderPlaceholder('Notes will be saved here for your reference.');
      case 'Resources':
        return renderPlaceholder('Links and references will appear in this tab.');
      case 'Settings':
        return renderPlaceholder('Simulation settings will be configurable here.');
      default:
        return null;
    }
  };

  const toggleButtonLabel = `${collapsed ? 'Expand' : 'Collapse'} utility panel`;

  return (
    <aside className={`utility-panel ${collapsed ? 'utility-panel--collapsed' : ''}`} aria-label="Utility panel">
      <button className="utility-panel__handle" onClick={onToggleCollapse} aria-label={toggleButtonLabel}>
        <span aria-hidden>{collapsed ? '‹' : '›'}</span>
      </button>
      <div className="utility-panel__content" aria-hidden={collapsed}>
        <div className="utility-panel__header">
          <nav className="tabs" aria-label="Utility tabs">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                className={`tab ${activeTab === tab.key ? 'is-active' : ''}`}
                aria-current={activeTab === tab.key ? 'page' : undefined}
                onClick={() => onTabChange(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="utility-panel__body">{renderContent()}</div>
      </div>
    </aside>
  );
}
