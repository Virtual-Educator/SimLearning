import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ImageScene from '../scenes/ImageScene';
import { BottomActionBar } from '../components/BottomActionBar';
import { SceneFrame } from '../components/SceneFrame';
import { TopBar } from '../components/TopBar';
import { UtilityPanel, UtilityTab } from '../components/UtilityPanel';
import { getAttemptEvents, getAttemptEventsSince, logEvent, resetAttemptEvents } from '../sim/attempt';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { resolveSceneImageUrl } from '../lib/sceneUrl';

const PANEL_STORAGE_KEY = 'simlearning-utility-collapsed';
const TOGGLE_SHORTCUT = 'Ctrl+Shift+U';

export type SimulationManifest = {
  id: string;
  version: string;
  title: string;
  description: string;
  scene: {
    type: 'image';
    src?: string;
    image_path?: string;
    storage?: { bucket: string; path: string };
    entry?: string;
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
  attempt_no: number;
};

type AttemptResponse = {
  response_key: string;
  response_text: string | null;
  response_json?: { text?: string } | null;
  updated_at?: string | null;
  created_at?: string | null;
};

type AttemptEventRow = {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at?: string;
};

interface ActivityMeta {
  title: string;
  course_label: string;
  simulation_title: string;
  version: string;
  course_id?: string | null;
}

function getStoredPanelState() {
  if (typeof window === 'undefined') return false;
  const stored = window.localStorage.getItem(PANEL_STORAGE_KEY);
  return stored === 'true';
}

interface PlayerActivityPageProps {
  onSignOut: () => Promise<void>;
}

export function PlayerActivityPage({ onSignOut }: PlayerActivityPageProps) {
  const { activityId, attemptId: attemptIdParam } = useParams<{ activityId?: string; attemptId?: string }>();
  const { session } = useAuth();
  const [manifest, setManifest] = useState<SimulationManifest | null>(null);
  const [packagePath, setPackagePath] = useState<string | null>(null);
  const [activityMeta, setActivityMeta] = useState<ActivityMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState<boolean>(() => getStoredPanelState());
  const [activeTab, setActiveTab] = useState<UtilityTab>('Task');
  const [showGrid, setShowGrid] = useState(false);
  const [pinMode, setPinMode] = useState(false);
  const [pins, setPins] = useState<PinLocation[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [attemptStatus, setAttemptStatus] = useState<AttemptRecord['status']>('draft');
  const [attemptNo, setAttemptNo] = useState<number | null>(null);
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
  const [sceneImageSrc, setSceneImageSrc] = useState('');
  const [sceneLoading, setSceneLoading] = useState(false);
  const [sceneRetryAttempted, setSceneRetryAttempted] = useState(false);
  const [sceneError, setSceneError] = useState<string | null>(null);
  const [sceneSource, setSceneSource] = useState<'storage' | 'public' | null>(null);

  const loadSceneImage = useCallback(
    async (targetManifest: SimulationManifest, targetPackagePath?: string | null) => {
      setSceneLoading(true);
      setSceneError(null);
      try {
        const resolved = await resolveSceneImageUrl(targetManifest, targetPackagePath);
        if (!resolved) {
          throw new Error('Scene image path is missing.');
        }
        setSceneImageSrc(resolved.url);
        setSceneSource(resolved.source);
        setSceneRetryAttempted(false);
      } catch (sceneErr) {
        const message = sceneErr instanceof Error ? sceneErr.message : 'Unable to load scene image.';
        setSceneError(message);
        setSceneImageSrc('');
      } finally {
        setSceneLoading(false);
      }
    },
    []
  );

  const togglePanelCollapse = () => {
    setIsPanelCollapsed((prev) => {
      const next = !prev;
      logEvent('panel_toggled', { collapsed: next });
      return next;
    });
  };

  const handleSceneImageError = async () => {
    if (!manifest) return;

    if (sceneSource === 'storage' && !sceneRetryAttempted) {
      try {
        const response = await fetch(sceneImageSrc, { method: 'HEAD' });
        if (response.status === 403) {
          setSceneRetryAttempted(true);
          await loadSceneImage(manifest, packagePath);
          return;
        }
      } catch (headError) {
        console.error('Unable to verify scene image status', headError);
        setSceneRetryAttempted(true);
        await loadSceneImage(manifest, packagePath);
        return;
      }
    }

    const message = 'Unable to load scene image. Please refresh the page.';
    setSceneError(message);
  };

  const handleSceneImageLoad = () => {
    setSceneError(null);
  };

  useEffect(() => {
    loadActivity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityId, attemptIdParam]);

  useEffect(() => {
    if (!manifest) return;
    loadSceneImage(manifest, packagePath);
  }, [loadSceneImage, manifest, packagePath]);

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

  const initializeAttempt = async (simulationVersionId: string, courseId?: string | null) => {
    if (!session?.user) {
      setError('You must be signed in to start an attempt.');
      setAttemptLoading(false);
      return;
    }

    setAttemptLoading(true);
    setAttemptStatus('draft');
    setAttemptId(null);
    setAttemptNo(null);

    const { data: existingAttempts, error: attemptError } = await supabase
      .from('attempts')
      .select('id, status, started_at, submitted_at, updated_at, attempt_no')
      .eq('student_id', session.user.id)
      .eq('activity_id', activityId)
      .order('attempt_no', { ascending: false });

    if (attemptError) {
      setError(`Unable to load attempt: ${attemptError.message}`);
      setAttemptLoading(false);
      return;
    }

    let attemptRecord = (existingAttempts as AttemptRecord[] | null)?.find((a) => a.status === 'draft') ?? null;

    if (!attemptRecord) {
      const { data: nextAttemptNo, error: attemptNoError } = await supabase.rpc('next_attempt_no', {
        activity_id: activityId,
        student_id: session.user.id,
      });

      if (attemptNoError || !nextAttemptNo) {
        setError(`Unable to start a new attempt: ${attemptNoError?.message ?? 'Unknown error'}`);
        setAttemptLoading(false);
        return;
      }

      const now = new Date().toISOString();
      const { data: createdAttempt, error: createError } = await supabase
        .from('attempts')
        .insert({
          student_id: session.user.id,
          activity_id: activityId,
          course_id: courseId ?? null,
          simulation_version_id: simulationVersionId,
          status: 'draft',
          attempt_no: nextAttemptNo as number,
          started_at: now,
        })
        .select('id, status, started_at, submitted_at, updated_at, attempt_no')
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
    setAttemptNo(attemptRecord.attempt_no);
    if (attemptRecord.updated_at) {
      setLastSavedAt(attemptRecord.updated_at);
    }

    const { data: responseRows, error: responsesError } = await supabase
      .from('attempt_responses')
      .select('response_key, response_text, response_json, updated_at, created_at')
      .eq('attempt_id', attemptRecord.id);

    if (responsesError) {
      setError(`Unable to load attempt responses: ${responsesError.message}`);
      setAttemptLoading(false);
      return;
    }

    const typedResponses = (responseRows ?? []) as AttemptResponse[];
    setLoadedResponses(typedResponses);
    const primaryResponse = typedResponses.find((row) => row.response_key === 'primary');
    const resolvedResponseText =
      primaryResponse?.response_text ?? (primaryResponse?.response_json as { text?: string } | null)?.text;
    if (resolvedResponseText) {
      setResponseText(resolvedResponseText);
    }
    if (primaryResponse?.updated_at || primaryResponse?.created_at) {
      setLastSavedAt(primaryResponse.updated_at ?? primaryResponse.created_at ?? null);
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

  const loadActivity = async () => {
    setIsLoading(true);
    setError(null);
    setLoadingActivity(true);
    setAttemptId(null);
    setAttemptStatus('draft');
    setAttemptNo(null);
    setResponseText('');
    setLastSavedAt(null);
    setSaveMessage(null);
    setLoadedResponses([]);
    setLoadedEvents([]);
    resetAttemptEvents();
    setEventCursor(0);
    setAttemptLoading(true);
    setSceneImageSrc('');
    setSceneError(null);
    setSceneRetryAttempted(false);
    setSceneSource(null);
    setPackagePath(null);

    if (!activityId && !attemptIdParam) {
      setError('An activity or attempt id is required.');
      setIsLoading(false);
      setLoadingActivity(false);
      return;
    }

    if (attemptIdParam) {
      const { data: attemptRow, error: attemptError } = await supabase
        .from('attempts')
        .select(
          `id, status, attempt_no, course_id, simulation_version_id, simulation_versions (id, version, manifest, package_path, simulations (id, title, description, slug))`
        )
        .eq('id', attemptIdParam)
        .maybeSingle();

      if (attemptError) {
        setError(`Unable to load attempt: ${attemptError.message}`);
        setManifest(null);
        setActivityMeta(null);
        setIsLoading(false);
        setLoadingActivity(false);
        return;
      }

      if (!attemptRow) {
        setError('Attempt not found.');
        setManifest(null);
        setActivityMeta(null);
        setIsLoading(false);
        setLoadingActivity(false);
        return;
      }

      const simVersionRaw = attemptRow.simulation_versions;
      const simVersion = Array.isArray(simVersionRaw) ? simVersionRaw[0] : simVersionRaw;
      const simulationRaw = simVersion?.simulations;
      const simulation = Array.isArray(simulationRaw) ? simulationRaw[0] : simulationRaw;

      if (!simVersion?.id) {
        setError('Simulation version not available for this attempt.');
        setManifest(null);
        setActivityMeta(null);
        setIsLoading(false);
        setLoadingActivity(false);
        return;
      }

      if (!simVersion.manifest || typeof simVersion.manifest !== 'object') {
        setError('Published manifest is invalid.');
        setManifest(null);
        setActivityMeta(null);
        setIsLoading(false);
        setLoadingActivity(false);
        return;
      }

      const scene = simVersion.manifest.scene as SimulationManifest['scene'] | undefined;
      const hasStorage = Boolean(scene?.storage?.bucket && scene.storage?.path);
      const hasSrc = Boolean(scene?.src || scene?.image_path);
      const hasEntry = Boolean(scene?.entry);

      if (!scene || typeof scene !== 'object' || scene.type !== 'image' || (!hasSrc && !hasStorage && !hasEntry)) {
        setError('Published manifest is missing a valid image scene.');
        setManifest(null);
        setActivityMeta(null);
        setIsLoading(false);
        setLoadingActivity(false);
        return;
      }

      const resolvedManifest: SimulationManifest = {
        id: simVersion.manifest.id ?? simVersion.id ?? simulation?.id ?? 'simulation',
        version: simVersion.manifest.version ?? simVersion.version ?? '—',
        title: simVersion.manifest.title ?? simulation?.title ?? 'Simulation',
        description: simVersion.manifest.description ?? simulation?.description ?? '',
        scene: simVersion.manifest.scene,
        task: simVersion.manifest.task ?? { prompt: 'No task provided.', checklist: [] },
        tools: simVersion.manifest.tools,
      };

      setManifest(resolvedManifest);
      setPackagePath(simVersion.package_path ?? null);
      const courseLabel = attemptRow.course_id ? `Course — ${attemptRow.course_id}` : 'Course';
      setActivityMeta({
        title: simulation?.title ?? 'Simulation',
        course_label: courseLabel,
        simulation_title: simulation?.title ?? 'Simulation',
        version: simVersion.version ?? '—',
        course_id: attemptRow.course_id ?? null,
      });

      setAttemptId(attemptRow.id);
      setAttemptStatus(attemptRow.status ?? 'draft');
      setAttemptNo(attemptRow.attempt_no ?? null);

      const { data: responseRows, error: responsesError } = await supabase
        .from('attempt_responses')
        .select('response_key, response_text, response_json, updated_at, created_at')
        .eq('attempt_id', attemptRow.id);

      if (responsesError) {
        setError(`Unable to load attempt responses: ${responsesError.message}`);
        setAttemptLoading(false);
        setIsLoading(false);
        setLoadingActivity(false);
        return;
      }

      const typedResponses = (responseRows ?? []) as AttemptResponse[];
      setLoadedResponses(typedResponses);
      const primaryResponse = typedResponses.find((row) => row.response_key === 'primary');
      const resolvedResponseText =
        primaryResponse?.response_text ?? (primaryResponse?.response_json as { text?: string } | null)?.text;
      if (resolvedResponseText) {
        setResponseText(resolvedResponseText);
      }
      if (primaryResponse?.updated_at || primaryResponse?.created_at) {
        setLastSavedAt(primaryResponse.updated_at ?? primaryResponse.created_at ?? null);
      }

      const { data: eventRows, error: eventsError } = await supabase
        .from('attempt_events')
        .select('id, event_type, payload, created_at')
        .eq('attempt_id', attemptRow.id)
        .order('created_at', { ascending: true });

      if (eventsError) {
        setError(`Unable to load attempt events: ${eventsError.message}`);
        setAttemptLoading(false);
        setIsLoading(false);
        setLoadingActivity(false);
        return;
      }

      setLoadedEvents((eventRows ?? []) as AttemptEventRow[]);
      setAttemptLoading(false);
      setIsLoading(false);
      setLoadingActivity(false);
      return;
    }

    const { data, error: fetchError } = await supabase
      .from('activities')
      .select(
        'id, title, course_id, course_code, course_title, simulation_id, simulation_slug, simulation_title, simulation_description, simulation_version_id, simulation_version, manifest, package_path'
      )
      .eq('id', activityId)
      .maybeSingle();

    if (fetchError) {
      setError(`Unable to load activity: ${fetchError.message}`);
      setManifest(null);
      setActivityMeta(null);
      setIsLoading(false);
      setLoadingActivity(false);
      return;
    }

    if (!data) {
      setError('Activity not found.');
      setManifest(null);
      setActivityMeta(null);
      setIsLoading(false);
      setLoadingActivity(false);
      return;
    }

    const simulation = data.simulation_title
      ? { id: data.simulation_id, title: data.simulation_title, description: data.simulation_description ?? '' }
      : null;
    const simVersion = {
      id: data.simulation_version_id,
      version: data.simulation_version ?? '—',
      manifest: data.manifest,
      package_path: data.package_path ?? null,
    };

    if (!simVersion.id) {
      setError('Simulation version not available for this activity.');
      setManifest(null);
      setActivityMeta(null);
      setIsLoading(false);
      setLoadingActivity(false);
      return;
    }

    if (!simVersion.manifest || typeof simVersion.manifest !== 'object') {
      setError('Published manifest is invalid.');
      setManifest(null);
      setActivityMeta(null);
      setIsLoading(false);
      setLoadingActivity(false);
      return;
    }

    const scene = simVersion.manifest.scene as SimulationManifest['scene'] | undefined;
    const hasStorage = Boolean(scene?.storage?.bucket && scene.storage?.path);
    const hasSrc = Boolean(scene?.src || scene?.image_path);
    const hasEntry = Boolean(scene?.entry);

    if (!scene || typeof scene !== 'object' || scene.type !== 'image' || (!hasSrc && !hasStorage && !hasEntry)) {
      setError('Published manifest is missing a valid image scene.');
      setManifest(null);
      setActivityMeta(null);
      setIsLoading(false);
      setLoadingActivity(false);
      return;
    }

    const resolvedManifest: SimulationManifest = {
      id: simVersion.manifest.id ?? simVersion.id ?? simulation?.id ?? 'simulation',
      version: simVersion.manifest.version ?? simVersion.version,
      title: simVersion.manifest.title ?? simulation?.title ?? data.title,
      description: simVersion.manifest.description ?? simulation?.description ?? '',
      scene: simVersion.manifest.scene,
      task:
        simVersion.manifest.task ?? {
          prompt: 'No task provided.',
          checklist: [],
        },
      tools: simVersion.manifest.tools,
    };

    setManifest(resolvedManifest);
    setPackagePath(simVersion.package_path ?? null);
    const courseLabel = data.course_code
      ? `${data.course_code}${data.course_title ? ` — ${data.course_title}` : ''}`
      : 'Course';

    setActivityMeta({
      title: data.title,
      course_label: courseLabel,
      simulation_title: simulation?.title ?? 'Simulation',
      version: simVersion.version,
      course_id: data.course_id ?? null,
    });
    setShowGrid(false);
    setPinMode(false);
    setPins([]);
    await initializeAttempt(simVersion.id, data.course_id ?? null);
    setIsLoading(false);
    setLoadingActivity(false);
  };

  const gridAllowed = Boolean(manifest?.tools?.grid);
  const pinsAllowed = Boolean(manifest?.tools?.pins);
  const attemptLocked = attemptStatus === 'submitted';
  const activeError = error ?? sceneError;
  const combinedLoading = isLoading || attemptLoading || sceneLoading;
  const controlsDisabled = combinedLoading || attemptLocked || Boolean(activeError) || submitting;

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
      .upsert(
        {
          attempt_id: attemptId,
          response_key: 'primary',
          response_text: responseText,
          response_json: { text: responseText },
        },
        { onConflict: 'attempt_id,response_key' }
      )
      .select('response_key, response_text, response_json, updated_at, created_at')
      .single();

    if (responseError) {
      console.error('Unable to save draft response', {
        attemptId,
        error: responseError.message,
      });
      setError(`Unable to save draft response: ${responseError.message}`);
      setSavingDraft(false);
      return false;
    }

    setLastSavedAt(responseRow?.updated_at ?? responseRow?.created_at ?? now);

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
      .select(
        'id, student_id, activity_id, attempt_no, simulation_version_id, status, started_at, submitted_at, response_meta, created_at, updated_at'
      )
      .eq('id', attemptId)
      .single();

    if (attemptError) {
      setError(`Unable to download attempt: ${attemptError.message}`);
      setDownloadInProgress(false);
      return;
    }

    const { data: responses, error: responsesError } = await supabase
      .from('attempt_responses')
      .select('id, response_key, response_text, response_json, created_at, updated_at')
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

  const resolvedTitle = activityMeta?.title ?? 'SimLearning Player';
  const resolvedDescription = activityMeta?.course_label ?? 'Load and run interactive simulations.';
  const toggleButtonLabel = `${isPanelCollapsed ? 'Expand' : 'Collapse'} utility panel (${TOGGLE_SHORTCUT})`;
  const canSaveDraft =
    Boolean(attemptId) && !attemptLocked && !savingDraft && !combinedLoading && !submitting && !activeError;
  const canSubmitAttempt =
    Boolean(attemptId) &&
    attemptStatus === 'draft' &&
    !submitting &&
    !combinedLoading &&
    !savingDraft &&
    !activeError;
  const canDownloadAttempt =
    Boolean(attemptId) && !attemptLoading && !downloadInProgress && !combinedLoading && !activeError;

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
                  ← Back to simulations
                </Link>
              </p>
              <h2 style={{ margin: 0 }}>Activity</h2>
              <p style={{ margin: '4px 0', color: '#475569' }}>
                {activityMeta?.simulation_title ? `${activityMeta.simulation_title} (v${activityMeta.version})` : 'Loading…'}
              </p>
              <p style={{ margin: '4px 0', color: '#475569' }}>{activityMeta?.course_label ?? ''}</p>
              {attemptNo !== null && (
                <p style={{ margin: '4px 0', color: '#0f172a', fontWeight: 600 }}>Attempt #{attemptNo}</p>
              )}
            </div>
            <button className="form__submit" onClick={loadActivity} disabled={loadingActivity}>
              Refresh
            </button>
          </div>
          {loadingActivity && <p>Loading activity…</p>}
          {activeError && <div className="form__error">{activeError}</div>}
          {!loadingActivity && !activeError && !manifest && <p>No published manifest found for this activity.</p>}
        </div>
      </section>

      <main className={`workspace ${isPanelCollapsed ? 'workspace--panel-collapsed' : ''}`}>
        <SceneFrame isLoading={combinedLoading} error={activeError}>
          {!combinedLoading && !activeError && manifest && (
            <ImageScene
              imageSrc={sceneImageSrc}
              alt={manifest.scene.alt || manifest.title}
              showGrid={gridAllowed && showGrid}
              allowPins={pinsAllowed}
              pinMode={pinMode}
              pins={pins}
              onAddPin={handleAddPin}
              onRemovePin={handleRemovePin}
              onImageError={handleSceneImageError}
              onImageLoad={handleSceneImageLoad}
            />
          )}
        </SceneFrame>

        <UtilityPanel
          collapsed={isPanelCollapsed}
          onToggleCollapse={togglePanelCollapse}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          isLoading={combinedLoading}
          error={activeError}
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
