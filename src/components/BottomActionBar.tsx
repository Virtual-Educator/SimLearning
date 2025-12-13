import React from 'react';

export function BottomActionBar() {
  return (
    <div className="bottom-action-bar" role="contentinfo" aria-label="Attempt actions">
      <div className="bottom-action-bar__status">
        <span className="status-pill status-pill--draft">Draft</span>
      </div>
      <div className="bottom-action-bar__actions">
        <button className="action-button" type="button" disabled>
          Save draft
        </button>
        <button className="action-button" type="button" disabled>
          Download attempt
        </button>
        <button className="action-button action-button--primary" type="button" disabled>
          Submit
        </button>
      </div>
    </div>
  );
}
