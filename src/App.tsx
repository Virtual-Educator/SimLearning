import { useEffect, useMemo, useState } from 'react';
import ImageScene from './scenes/ImageScene';
import { BottomActionBar } from './components/BottomActionBar';
import { SceneFrame } from './components/SceneFrame';
import { TopBar } from './components/TopBar';
import { UtilityPanel, UtilityTab } from './components/UtilityPanel';
import { logEvent } from './sim/attempt';

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

function App() {
  const [manifest, setManifest] = useState<SimulationManifest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState<boolean>(() => getStoredPanelState());
  const [activeTab, setActiveTab] = useState<UtilityTab>('Task');
  const [showGrid, setShowGrid] = useState(false);
  const [pinMode, setPinMode] = useState(false);
  const [pins, setPins] = useState<PinLocation[]>([]);

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
      <TopBar title={resolvedTitle} description={resolvedDescription} onTogglePanel={() => setIsPanelCollapsed((prev) => !prev)} toggleLabel={toggleButtonLabel} />

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

export default App;
