import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ImageScene from '../scenes/ImageScene';
import { BottomActionBar } from '../components/BottomActionBar';
import { SceneFrame } from '../components/SceneFrame';
import { TopBar } from '../components/TopBar';
import { UtilityPanel, UtilityTab } from '../components/UtilityPanel';
import { logEvent } from '../sim/attempt';
import {
  fetchPublishedSimulationVersionBySimulationId,
  type Simulation,
} from '../lib/api';

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

interface PlayerSimulationPageProps {
  onSignOut: () => Promise<void>;
}

export function PlayerSimulationPage({ onSignOut }: PlayerSimulationPageProps) {
  const { simulationId } = useParams<{ simulationId: string }>();
  const [manifest, setManifest] = useState<SimulationManifest | null>(null);
  const [simulationMeta, setSimulationMeta] = useState<Simulation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState<boolean>(() => getStoredPanelState());
  const [activeTab, setActiveTab] = useState<UtilityTab>('Task');
  const [showGrid, setShowGrid] = useState(false);
  const [pinMode, setPinMode] = useState(false);
  const [pins, setPins] = useState<PinLocation[]>([]);
  const [loadingPublished, setLoadingPublished] = useState(false);

  const sceneImageSrc = useMemo(() => {
    if (!manifest) return '';
    const basePath = `/simulations/${manifest.id}/`;
    return `${basePath}${manifest.scene.src.replace(/^\/+/, '')}`;
  }, [manifest]);

  useEffect(() => {
    loadPublishedSimulation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulationId]);

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

  const loadPublishedSimulation = async () => {
    setIsLoading(true);
    setError(null);
    setLoadingPublished(true);

    if (!simulationId) {
      setError('Simulation id is required.');
      setIsLoading(false);
      setLoadingPublished(false);
      return;
    }

    const { data, error: fetchError } = await fetchPublishedSimulationVersionBySimulationId(simulationId);

    if (fetchError) {
      setError('Unable to load the published simulation.');
      setManifest(null);
      setSimulationMeta(null);
      setIsLoading(false);
      setLoadingPublished(false);
      return;
    }

    if (!data) {
      setError('No published version is available for this simulation.');
      setManifest(null);
      setSimulationMeta(null);
      setIsLoading(false);
      setLoadingPublished(false);
      return;
    }

    const manifestJson = data.manifest_json as Partial<SimulationManifest> | null;

    if (!manifestJson || typeof manifestJson !== 'object') {
      setError('Published manifest is invalid.');
      setManifest(null);
      setSimulationMeta(null);
      setIsLoading(false);
      setLoadingPublished(false);
      return;
    }

    if (!manifestJson.scene || typeof manifestJson.scene !== 'object' || manifestJson.scene.type !== 'image' || !manifestJson.scene.src) {
      setError('Published manifest is missing a valid image scene.');
      setManifest(null);
      setSimulationMeta(null);
      setIsLoading(false);
      setLoadingPublished(false);
      return;
    }

    const resolvedManifest: SimulationManifest = {
      id: manifestJson.id ?? data.simulation_id,
      version: manifestJson.version ?? data.version,
      title: manifestJson.title ?? data.simulations?.title ?? 'Simulation',
      description: manifestJson.description ?? data.simulations?.description ?? '',
      scene: manifestJson.scene,
      task:
        manifestJson.task ?? {
          prompt: 'No task provided.',
          checklist: [],
        },
      tools: manifestJson.tools,
    };

    setManifest(resolvedManifest);
    setSimulationMeta(data.simulations ?? null);
    setShowGrid(false);
    setPinMode(false);
    setPins([]);
    setIsLoading(false);
    setLoadingPublished(false);
  };

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

  const resolvedTitle = manifest?.title ?? simulationMeta?.title ?? 'SimLearning Player';
  const resolvedDescription = manifest?.description ?? simulationMeta?.description ?? 'Load and run interactive simulations.';
  const toggleButtonLabel = `${isPanelCollapsed ? 'Expand' : 'Collapse'} utility panel (${TOGGLE_SHORTCUT})`;

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
            <div>
              <p style={{ margin: '0 0 6px' }}>
                <Link to="/player" style={{ color: '#0ea5e9', fontWeight: 600, textDecoration: 'none' }}>
                  ← Back to published list
                </Link>
              </p>
              <h2 style={{ margin: 0 }}>Simulation version</h2>
              <p style={{ margin: '4px 0', color: '#475569' }}>
                {manifest ? `Version ${manifest.version}` : 'Load the latest published version.'}
              </p>
            </div>
            <button className="form__submit" onClick={loadPublishedSimulation} disabled={loadingPublished}>
              Refresh
            </button>
          </div>
          {loadingPublished && <p>Loading published version…</p>}
          {error && <div className="form__error">{error}</div>}
          {!loadingPublished && !error && !manifest && <p>No published manifest found for this simulation.</p>}
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
