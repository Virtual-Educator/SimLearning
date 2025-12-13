import { useEffect, useMemo, useState } from 'react';

const MANIFEST_PATH = '/simulations/csi-001/manifest.json';
const PANEL_STORAGE_KEY = 'simlearning-utility-collapsed';
const TOGGLE_SHORTCUT = 'Ctrl+Shift+U';

type SimulationManifest = {
  id: string;
  version: string;
  title: string;
  description: string;
  scene: {
    type: 'image';
    src: string;
    alt?: string;
  };
  task: {
    prompt: string;
    checklist: string[];
  };
};

function getStoredPanelState() {
  if (typeof window === 'undefined') return false;
  const stored = window.localStorage.getItem(PANEL_STORAGE_KEY);
  return stored === 'true';
}

function App() {
  const [manifest, setManifest] = useState<SimulationManifest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState<boolean>(() => getStoredPanelState());
  const [activeTab] = useState<'Task'>('Task');

  useEffect(() => {
    const controller = new AbortController();

    async function loadManifest() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(MANIFEST_PATH, { signal: controller.signal });
        if (!response.ok) {
          throw new Error('Simulation manifest was not found (csi-001).');
        }
        const data = (await response.json()) as SimulationManifest;
        setManifest(data);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError('Unable to load the simulation package. Please check the manifest and try again.');
        setManifest(null);
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }

    loadManifest();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(PANEL_STORAGE_KEY, String(isPanelCollapsed));
  }, [isPanelCollapsed]);

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'u') {
        event.preventDefault();
        setIsPanelCollapsed((prev) => !prev);
      }
    }

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, []);

  const sceneImageSrc = useMemo(() => {
    if (!manifest) return '';
    const basePath = `/simulations/${manifest.id}/`;
    return `${basePath}${manifest.scene.src.replace(/^\//, '')}`;
  }, [manifest]);

  const topBarContent = manifest ? (
    <div className="topbar__content">
      <div>
        <div className="eyebrow">Simulation</div>
        <h1 className="title">{manifest.title}</h1>
      </div>
      <p className="description">{manifest.description}</p>
    </div>
  ) : (
    <div className="topbar__content">
      <div>
        <div className="eyebrow">Simulation</div>
        <h1 className="title">SimLearning Player</h1>
      </div>
      <p className="description">Load and run interactive simulations.</p>
    </div>
  );

  const toggleButtonLabel = `${isPanelCollapsed ? 'Expand' : 'Collapse'} utility panel (${TOGGLE_SHORTCUT})`;

  return (
    <div className="app-shell">
      <header className="topbar">
        {topBarContent}
        <div className="topbar__actions">
          <button className="toggle-button" onClick={() => setIsPanelCollapsed((prev) => !prev)}>
            {toggleButtonLabel}
          </button>
        </div>
      </header>

      <main className={`content ${isPanelCollapsed ? 'content--panel-collapsed' : ''}`}>
        <section className="scene-area" aria-label="Scene">
          {isLoading && <div className="status">Loading simulation…</div>}
          {error && <div className="status status--error">{error}</div>}
          {!isLoading && !error && manifest && (
            <img src={sceneImageSrc} alt={manifest.scene.alt || manifest.title} className="scene-image" />
          )}
        </section>

        <aside className={`utility-panel ${isPanelCollapsed ? 'utility-panel--collapsed' : ''}`} aria-label="Utility panel">
          <div className="utility-panel__header">
            <nav className="tabs" aria-label="Utility tabs">
              <button className={`tab ${activeTab === 'Task' ? 'is-active' : ''}`} aria-current="page">
                Task
              </button>
              <button className="tab" disabled>
                Tools
              </button>
              <button className="tab" disabled>
                Transcript
              </button>
              <button className="tab" disabled>
                Notes
              </button>
              <button className="tab" disabled>
                Resources
              </button>
              <button className="tab" disabled>
                Settings
              </button>
            </nav>
          </div>
          <div className="utility-panel__body">
            {activeTab === 'Task' && (
              <div className="task-tab">
                {isLoading && <div className="status">Loading task…</div>}
                {error && <div className="status status--error">{error}</div>}
                {!isLoading && !error && manifest && (
                  <>
                    <p className="task-prompt">{manifest.task.prompt}</p>
                    <div className="checklist">
                      <div className="checklist__title">Checklist</div>
                      <ul>
                        {manifest.task.checklist.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}

export default App;
