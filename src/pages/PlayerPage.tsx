import { useEffect, useMemo, useState } from 'react';
import ImageScene from '../scenes/ImageScene';
import { BottomActionBar } from '../components/BottomActionBar';
import { SceneFrame } from '../components/SceneFrame';
import { TopBar } from '../components/TopBar';
import { UtilityPanel, UtilityTab } from '../components/UtilityPanel';
import { logEvent } from '../sim/attempt';
import {
  fetchPublishedSimulationVersions,
  type PublishedSimulationVersion,
} from '../lib/api';

const MANIFEST_PATH = '/simulations/csi-001/manifest.json';
const PANEL_STORAGE_KEY = 'simlearning-utility-collapsed';
const TOGGLE_SHORTCUT = 'Ctrl+Shift+U';

export type SimulationManifest = {
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
  tools?: {
    pins?: boolean;
    grid?: boolean;
  };
};

export type PinLocation = { id: number; x: number; y: number };

function getStoredPanelState() {
  if (typeof window === 'undefined') return false;
  const stored = window.localStorage.getItem(PANEL_STORAGE_KEY);
  return stored === 'true';
}

interface PlayerPageProps {
  onSignOut: () => Promise<void>;
}

export function PlayerPage({ onSignOut }: PlayerPageProps) {
  const [manifest, setManifest] = useState<SimulationManifest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState<boolean>(() => getStoredPanelState());
  const [activeTab, setActiveTab] = useState<UtilityTab>('Task');
  const [showGrid, setShowGrid] = useState(false);
  const [pinMode, setPinMode] = useState(false);
  const [pins, setPins] = useState<PinLocation[]>([]);
  const [publishedSimulations, setPublishedSimulations] = useState<PublishedSimulationVersion[]>([]);
  const [publishedError, setPublishedError] = useState<string | null>(null);
  const [loadingPublished, setLoadingPublished] = useState(false);

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
        setShowGrid(false);
        setPinMode(false);
        setPins([]);
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

  const loadPublishedSimulations = async () => {
    setLoadingPublished(true);
    setPublishedError(null);
    const { data, error } = await fetchPublishedSimulationVersions();
    if (error) {
      setPublishedError('Unable to load published simulations.');
    } else {
      setPublishedSimulations(data ?? []);
    }
    setLoadingPublished(false);
  };

  useEffect(() => {
    loadPublishedSimulations();
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
    return `${basePath}${manifest.scene.src.replace(/^\/+/, '')}`;
  }, [manifest]);

  const toggleButtonLabel = `${isPanelCollapsed ? 'Expand' : 'Collapse'} utility panel (${TOGGLE_SHORTCUT})`;

  const gridAllowed = Boolean(manifest?.tools?.grid);
  const pinsAllowed = Boolean(manifest?.tools?.pins);

  const handleGridToggle = () => {
    if (!gridAllowed) return;
    setShowGrid((prev) => {
      const next = !prev;
      logEvent('grid_toggled', { enabled: next });
      return next;
    });
  };

  const handlePinModeToggle = () => {
    if (!pinsAllowed) return;
    setPinMode((prev) => {
      const next = !prev;
      logEvent('pin_mode_toggled', { enabled: next });
      return next;
    });
  };

  const handleAddPin = ({ x, y }: { x: number; y: number }) => {
    setPins((prev) => {
      const nextId = prev.length > 0 ? Math.max(...prev.map((pin) => pin.id)) + 1 : 1;
      const newPin = { id: nextId, x, y };
      logEvent('pin_added', newPin);
      return [...prev, newPin];
    });
  };

  const handleRemovePin = (id: number) => {
    setPins((prev) => {
      const remaining = prev.filter((pin) => pin.id !== id);
      logEvent('pin_removed', { id });
      return remaining;
    });
  };

  const resolvedTitle = manifest?.title ?? 'SimLearning Player';
  const resolvedDescription = manifest?.description ?? 'Load and run interactive simulations.';

  return (
    <div className="app-shell">
      <TopBar
        title={resolvedTitle}
        description={resolvedDescription}
        onTogglePanel={() => setIsPanelCollapsed((prev) => !prev)}
        toggleLabel={toggleButtonLabel}
        onSignOut={onSignOut}
      />

      <section style={{ padding: '16px' }}>
        <div className="card" style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <h2 style={{ margin: 0 }}>Published simulations</h2>
            <button className="form__submit" onClick={loadPublishedSimulations} disabled={loadingPublished}>
              Refresh
            </button>
          </div>
          {loadingPublished && <p>Loading…</p>}
          {publishedError && <div className="form__error">{publishedError}</div>}
          {!loadingPublished && !publishedError && publishedSimulations.length === 0 && (
            <p style={{ marginBottom: 0 }}>No published simulations yet.</p>
          )}
          {!loadingPublished && !publishedError && publishedSimulations.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: 16,
                marginTop: 12,
              }}
            >
              {publishedSimulations.map((item) => (
                <div
                  key={item.id}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: 12,
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    background: '#fff',
                  }}
                >
                  <div>
                    <p style={{ margin: '0 0 4px', color: '#475569', fontSize: 14 }}>Version {item.version}</p>
                    <h3 style={{ margin: 0 }}>{item.simulations.title}</h3>
                  </div>
                  <p style={{ margin: 0, color: '#475569' }}>
                    {item.simulations.description || 'No description provided.'}
                  </p>
                  <div style={{ marginTop: 'auto' }}>
                    <button
                      className="form__submit"
                      type="button"
                      onClick={() => {
                        console.log('Open simulation', item.simulation_id);
                      }}
                    >
                      Open
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <main className={`workspace ${isPanelCollapsed ? 'workspace--panel-collapsed' : ''}`}>
        <SceneFrame isLoading={isLoading} error={error}>
          {!isLoading && !error && manifest && (
            <ImageScene
              imageSrc={sceneImageSrc}
              alt={manifest.scene.alt || manifest.title}
              showGrid={gridAllowed && showGrid}
              allowPins={pinsAllowed}
              pinMode={pinMode}
              pins={pins}
              onAddPin={handleAddPin}
              onRemovePin={handleRemovePin}
            />
          )}
        </SceneFrame>

        <UtilityPanel
          collapsed={isPanelCollapsed}
          onToggleCollapse={() => setIsPanelCollapsed((prev) => !prev)}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          isLoading={isLoading}
          error={error}
          task={manifest?.task ?? null}
          gridAllowed={gridAllowed}
          pinsAllowed={pinsAllowed}
          showGrid={showGrid}
          pinMode={pinMode}
          onGridToggle={handleGridToggle}
          onPinModeToggle={handlePinModeToggle}
        />
      </main>

      <BottomActionBar />
    </div>
  );
}
