import React from 'react';

interface SceneFrameProps {
  isLoading: boolean;
  error: string | null;
  children: React.ReactNode;
}

export function SceneFrame({ isLoading, error, children }: SceneFrameProps) {
  return (
    <section className="scene-frame" aria-label="Scene">
      {isLoading && <div className="status">Loading simulation…</div>}
      {error && <div className="status status--error">{error}</div>}
      {!isLoading && !error && children}
    </section>
  );
}
