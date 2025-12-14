import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ImageScene from '../scenes/ImageScene';
import { BottomActionBar } from '../components/BottomActionBar';
import { SceneFrame } from '../components/SceneFrame';
import { TopBar } from '../components/TopBar';
import { UtilityPanel, UtilityTab } from '../components/UtilityPanel';
import { getAttemptEvents, getAttemptEventsSince, logEvent, resetAttemptEvents } from '../sim/attempt';
import {
  fetchPublishedSimulationVersionBySimulationId,
  type Simulation,
} from '../lib/api';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

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

type AttemptRecord = {
  id: string;
  status: 'draft' | 'submitted' | 'graded' | string;
  started_at?: string;
  submitted_at?: string | null;
  updated_at?: string | null;
};

type AttemptResponse = {
  response_key: string;
  response_text: string | null;
  updated_at?: string | null;
};

type AttemptEventRow = {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at?: string;
};

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
  const { session } = useAuth();
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
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [attemptStatus, setAttemptStatus] = useState<AttemptRecord['status']>('draft');
  const [attemptLoading, setAttemptLoading] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [loadedResponses, setLoadedResponses] = useState<AttemptResponse[]>([]);
  const [loadedEvents, setLoadedEvents] = useState<AttemptEventRow[]>([]);
  const [eventCursor, setEventCursor] = useState(0);
  const [downloadInProgress, setDownloadInProgress] = useState(false);

  const sceneImageSrc = useMemo(() => {
    if (!manifest) return '';
    const basePath = `/simulations/${manifest.id}/`;
    return `${basePath}${manifest.scene.src.replace(/^\/+/, '')}`;
  }, [manifest]);

  const togglePanelCollapse = () => {
    setIsPanelCollapsed((prev) => {
      const next = !prev;
      logEvent('panel_toggled', { collapsed: next });
      return next;
    });
  };

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
        togglePanelCollapse();
      }
    }

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, []);

  const initializeAttempt = async (simulationVersionId: string) => {
    if (!session?.user) {
      setError('You must be signed in to start an attempt.');
      setAttemptLoading(false);
      return;
    }

    setAttemptLoading(true);
    setAttemptStatus('draft');
    setAttemptId(null);

    const { data: existingAttempt, error: attemptError } = await supabase
      .from('attempts')
      .select('id, status, started_at, submitted_at, updated_at')
      .eq('user_id', session.user.id)
      .eq('simulation_version_id', simulationVersionId)
      .eq('status', 'draft')
      .maybeSingle();

    if (attemptError) {
      setError(`Unable to load attempt: ${attemptError.message}`);
      setAttemptLoading(false);
      return;
    }

    let attemptRecord = existingAttempt as AttemptRecord | null;

    if (!attemptRecord) {
      const now = new Date().toISOString();
      const { data: createdAttempt, error: createError } = await supabase
        .from('attempts')
        .insert({
          user_id: session.user.id,
          simulation_version_id: simulationVersionId,
          status: 'draft',
          started_at: now,
        })
        .select('id, status, started_at, submitted_at, updated_at')
        .single();

      if (createError) {
        setError(`Unable to create attempt: ${createError.message}`);
        setAttemptLoading(false);
        return;
      }

      attemptRecord = createdAttempt as AttemptRecord;
    }

    setAttemptId(attemptRecord.id);
    setAttemptStatus(attemptRecord.status);
    if (attemptRecord.updated_at) {
      setLastSavedAt(attemptRecord.updated_at);
    }

    const { data: responseRows, error: responsesError } = await supabase
      .from('attempt_responses')
      .select('response_key, response_text, updated_at')
      .eq('attempt_id', attemptRecord.id);

    if (responsesError) {
      setError(`Unable to load attempt responses: ${responsesError.message}`);
      setAttemptLoading(false);
      return;
    }

    const typedResponses = (responseRows ?? []) as AttemptResponse[];
    setLoadedResponses(typedResponses);
    const primaryResponse = typedResponses.find((row) => row.response_key === 'primary');
    if (primaryResponse?.response_text) {
      setResponseText(primaryResponse.response_text);
    }
    if (primaryResponse?.updated_at) {
      setLastSavedAt(primaryResponse.updated_at);
    }

    const { data: eventRows, error: eventsError } = await supabase
      .from('attempt_events')
      .select('id, event_type, payload, created_at')
      .eq('attempt_id', attemptRecord.id)
      .order('created_at', { ascending: true });

    if (eventsError) {
      setError(`Unable to load attempt events: ${eventsError.message}`);
      setAttemptLoading(false);
      return;
    }

    setLoadedEvents((eventRows ?? []) as AttemptEventRow[]);
    setAttemptLoading(false);
  };

  const loadPublishedSimulation = async () => {
    setIsLoading(true);
    setError(null);
    setLoadingPublished(true);
    setAttemptId(null);
    setAttemptStatus('draft');
    setResponseText('');
    setLastSavedAt(null);
    setSaveMessage(null);
    setLoadedResponses([]);
    setLoadedEvents([]);
    resetAttemptEvents();
    setEventCursor(0);

    if (!simulationId) {
      setError('Simulation id is required.');
      setIsLoading(false);
      setLoadingPublished(false);
      return;
    }

    const { data, error: fetchError } = await fetchPublishedSimulationVersionBySimulationId(simulationId);

    if (fetchError) {
      setError(`Unable to load the published simulation: ${fetchError.message}`);
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

    const manifestJson = data.manifest as Partial<SimulationManifest> | null;

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
    await initializeAttempt(data.id);
    setIsLoading(false);
    setLoadingPublished(false);
  };

  const gridAllowed = Boolean(manifest?.tools?.grid);
  const pinsAllowed = Boolean(manifest?.tools?.pins);
  const attemptLocked = attemptStatus === 'submitted';
  const combinedLoading = isLoading || attemptLoading;
  const controlsDisabled = combinedLoading || attemptLocked || Boolean(error) || submitting;

  const handleGridToggle = () => {
    if (!gridAllowed || controlsDisabled) return;
    setShowGrid((prev) => {
      const next = !prev;
      logEvent('grid_toggled', { enabled: next });
      return next;
    });
  };

  const handlePinModeToggle = () => {
    if (!pinsAllowed || controlsDisabled) return;
    setPinMode((prev) => {
      const next = !prev;
      logEvent('pin_mode_toggled', { enabled: next });
      return next;
    });
  };

  const handleAddPin = ({ x, y }: { x: number; y: number }) => {
    if (controlsDisabled || !pinsAllowed) return;
    setPins((prev) => {
      const nextId = prev.length > 0 ? Math.max(...prev.map((pin) => pin.id)) + 1 : 1;
      const newPin = { id: nextId, x, y };
      logEvent('pin_added', newPin);
      return [...prev, newPin];
    });
  };

  const handleRemovePin = (id: number) => {
    if (controlsDisabled || !pinsAllowed) return;
    setPins((prev) => {
      const remaining = prev.filter((pin) => pin.id !== id);
      logEvent('pin_removed', { id });
      return remaining;
    });
  };

  const persistDraft = async (showToast = true) => {
    if (!attemptId) return false;

    setError(null);
    setSavingDraft(true);
    setSaveMessage(null);
    const now = new Date().toISOString();

    const { data: responseRow, error: responseError } = await supabase
      .from('attempt_responses')
      .upsert({ attempt_id: attemptId, response_key: 'primary', response_text: responseText })
      .select('response_key, response_text, updated_at')
      .single();

    if (responseError) {
      setError(`Unable to save draft response: ${responseError.message}`);
      setSavingDraft(false);
      return false;
    }

    if (responseRow?.updated_at) {
      setLastSavedAt(responseRow.updated_at);
    }

    const newEvents = getAttemptEventsSince(eventCursor);
    if (newEvents.length > 0) {
      const eventPayload = newEvents.map((event) => ({
        attempt_id: attemptId,
        event_type: event.type,
        payload: { ...(event.payload ?? {}), timestamp: event.timestamp },
      }));

      const { error: eventsError } = await supabase.from('attempt_events').insert(eventPayload);
      if (eventsError) {
        setError(`Unable to save attempt events: ${eventsError.message}`);
        setSavingDraft(false);
        return false;
      }

      setEventCursor(getAttemptEvents().length);
    } else {
      setEventCursor(getAttemptEvents().length);
    }

    setSavingDraft(false);
    setAttemptStatus('draft');
    setLastSavedAt((prev) => prev ?? now);
    if (showToast) {
      setSaveMessage('Draft saved');
      setTimeout(() => setSaveMessage(null), 3000);
    }
    return true;
  };

  const handleSaveDraft = async () => {
    await persistDraft(true);
  };

  const handleSubmitAttempt = async () => {
    if (!attemptId || attemptLocked) return;
    setError(null);
    setSubmitting(true);

    const draftSaved = await persistDraft(false);
    if (!draftSaved) {
      setSubmitting(false);
      return;
    }

    const now = new Date().toISOString();
    const { data: updatedAttempt, error: submitError } = await supabase
      .from('attempts')
      .update({ status: 'submitted', submitted_at: now })
      .eq('id', attemptId)
      .select('status, submitted_at, updated_at')
      .single();

    if (submitError) {
      setError(`Unable to submit attempt: ${submitError.message}`);
      setSubmitting(false);
      return;
    }

    setAttemptStatus(updatedAttempt?.status ?? 'submitted');
    setLastSavedAt(updatedAttempt?.updated_at ?? now);
    setSubmitting(false);
    setPinMode(false);
  };

  const handleDownloadAttempt = async () => {
    if (!attemptId) return;
    setError(null);
    setDownloadInProgress(true);

    const { data: attemptRow, error: attemptError } = await supabase
      .from('attempts')
      .select('id, simulation_version_id, status, started_at, submitted_at, updated_at, response_meta, pins, transcript')
      .eq('id', attemptId)
      .single();

    if (attemptError) {
      setError(`Unable to download attempt: ${attemptError.message}`);
      setDownloadInProgress(false);
      return;
    }

    const { data: responses, error: responsesError } = await supabase
      .from('attempt_responses')
      .select('id, response_key, response_text, created_at, updated_at')
      .eq('attempt_id', attemptId);

    if (responsesError) {
      setError(`Unable to load attempt responses: ${responsesError.message}`);
      setDownloadInProgress(false);
      return;
    }

    const { data: events, error: eventsError } = await supabase
      .from('attempt_events')
      .select('id, event_type, payload, created_at')
      .eq('attempt_id', attemptId)
      .order('created_at', { ascending: true });

    if (eventsError) {
      setError(`Unable to load attempt events: ${eventsError.message}`);
      setDownloadInProgress(false);
      return;
    }

    const exportPayload = {
      attempt: attemptRow,
      responses: responses ?? [],
      events: events ?? [],
    };

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'attempt.json';
    link.click();
    URL.revokeObjectURL(url);
    setDownloadInProgress(false);
  };

  const resolvedTitle = manifest?.title ?? simulationMeta?.title ?? 'SimLearning Player';
  const resolvedDescription = manifest?.description ?? simulationMeta?.description ?? 'Load and run interactive simulations.';
  const toggleButtonLabel = `${isPanelCollapsed ? 'Expand' : 'Collapse'} utility panel (${TOGGLE_SHORTCUT})`;
  const canSaveDraft = Boolean(attemptId) && !attemptLocked && !savingDraft && !combinedLoading && !submitting && !error;
  const canSubmitAttempt =
    Boolean(attemptId) && attemptStatus === 'draft' && !submitting && !combinedLoading && !savingDraft && !error;
  const canDownloadAttempt = Boolean(attemptId) && !attemptLoading && !downloadInProgress && !combinedLoading && !error;

  return (
    <div className="app-shell">
      <TopBar
        title={resolvedTitle}
        description={resolvedDescription}
        onTogglePanel={togglePanelCollapse}
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
        <SceneFrame isLoading={combinedLoading} error={error}>
          {!combinedLoading && !error && manifest && (
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
          onToggleCollapse={togglePanelCollapse}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          isLoading={combinedLoading}
          error={error}
          task={manifest?.task ?? null}
          gridAllowed={gridAllowed}
          pinsAllowed={pinsAllowed}
          showGrid={showGrid}
          pinMode={pinMode}
          onGridToggle={handleGridToggle}
          onPinModeToggle={handlePinModeToggle}
          responseText={responseText}
          onResponseChange={setResponseText}
          controlsDisabled={controlsDisabled}
        />
      </main>

      <BottomActionBar
        status={attemptStatus}
        onSaveDraft={handleSaveDraft}
        onSubmit={handleSubmitAttempt}
        onDownload={handleDownloadAttempt}
        canSave={canSaveDraft}
        canSubmit={canSubmitAttempt}
        canDownload={canDownloadAttempt && !downloadInProgress}
        saving={savingDraft}
        submitting={submitting}
        lastSavedAt={lastSavedAt}
        saveMessage={saveMessage}
      />
    </div>
  );
}
