import React from 'react';

interface BottomActionBarProps {
  status: 'draft' | 'submitted' | string;
  onSaveDraft: () => void;
  onSubmit: () => void;
  onDownload: () => void;
  canSave: boolean;
  canSubmit: boolean;
  canDownload: boolean;
  saving: boolean;
  submitting: boolean;
  lastSavedAt: string | null;
  saveMessage?: string | null;
}

export function BottomActionBar({
  status,
  onSaveDraft,
  onSubmit,
  onDownload,
  canSave,
  canSubmit,
  canDownload,
  saving,
  submitting,
  lastSavedAt,
  saveMessage,
}: BottomActionBarProps) {
  const resolvedSaveMessage = saveMessage || (lastSavedAt ? `Draft saved ${new Date(lastSavedAt).toLocaleTimeString()}` : '');
  const isSubmitted = status === 'submitted';

  return (
    <div className="bottom-action-bar" role="contentinfo" aria-label="Attempt actions">
      <div className="bottom-action-bar__status">
        <span className={`status-pill status-pill--${status}`}>{status === 'submitted' ? 'Submitted' : 'Draft'}</span>
        {resolvedSaveMessage && <span className="bottom-action-bar__meta">{resolvedSaveMessage}</span>}
      </div>
      <div className="bottom-action-bar__actions">
        <button className="action-button" type="button" onClick={onSaveDraft} disabled={!canSave}>
          {saving ? 'Saving…' : 'Save draft'}
        </button>
        <button className="action-button" type="button" onClick={onDownload} disabled={!canDownload}>
          Download attempt
        </button>
        <button
          className="action-button action-button--primary"
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
        >
          {isSubmitted ? 'Submitted' : submitting ? 'Submitting…' : 'Submit'}
        </button>
      </div>
    </div>
  );
}
