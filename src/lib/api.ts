import { supabase } from './supabaseClient';

export type Simulation = {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type SimulationVersionStatus = 'draft' | 'published' | 'archived';

export type SimulationVersion = {
  id: string;
  simulation_id: string;
  version: string;
  status: SimulationVersionStatus;
  manifest: unknown;
  created_at?: string;
  published_at?: string | null;
};

export type SimulationWithVersions = Simulation & {
  simulation_versions: SimulationVersion[];
};

export type PublishedSimulationVersion = SimulationVersion & {
  simulations: Simulation;
};

export type AttemptWithSimulation = {
  id: string;
  submitted_at: string | null;
  user_id: string;
  simulation_versions: {
    version: string;
    simulations: Pick<Simulation, 'id' | 'title' | 'slug'> | null;
  } | null;
};

export type AttemptDetail = {
  id: string;
  user_id: string;
  status: string;
  submitted_at: string | null;
  simulation_versions: {
    version: string;
    simulations: Pick<Simulation, 'id' | 'title'> | null;
  } | null;
};

export type AttemptResponseRow = {
  response_key: string;
  response_text: string | null;
  response_json: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
};

export type AttemptEventRow = {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string | null;
};

export type AttemptFeedbackRow = {
  id: string;
  attempt_id: string;
  created_by: string;
  feedback: Record<string, unknown>;
  created_at: string | null;
};

export async function fetchSimulations() {
  return supabase
    .from('simulations')
    .select('id, title, slug, description, created_at, updated_at')
    .order('updated_at', { ascending: false });
}

export async function createSimulation(input: {
  title: string;
  slug: string;
  description?: string;
}) {
  return supabase
    .from('simulations')
    .insert({ ...input })
    .select('id, title, slug, description, created_at, updated_at')
    .single();
}

export async function fetchSimulationWithVersions(simulationId: string) {
  return supabase
    .from('simulations')
    .select(
      `id, title, slug, description, created_at, updated_at,
       simulation_versions(id, simulation_id, version, status, manifest, created_at, published_at)`
    )
    .eq('id', simulationId)
    .single();
}

export async function createSimulationVersion(
  simulationId: string,
  input: { version: string; manifest: unknown }
) {
  return supabase
    .from('simulation_versions')
    .insert({ ...input, simulation_id: simulationId, status: 'draft' })
    .select('id, simulation_id, version, status, manifest, created_at, published_at')
    .single();
}

export async function publishSimulationVersion(simulationId: string, versionId: string) {
  const now = new Date().toISOString();

  const archiveResult = await supabase
    .from('simulation_versions')
    .update({ status: 'archived' })
    .eq('simulation_id', simulationId)
    .eq('status', 'published');

  if (archiveResult.error) {
    return archiveResult;
  }

  return supabase
    .from('simulation_versions')
    .update({ status: 'published', published_at: now })
    .eq('id', versionId)
    .select('id, simulation_id, version, status, manifest, created_at, published_at')
    .single();
}

export async function fetchPublishedSimulationVersions() {
  return supabase
    .from('simulation_versions')
    .select('id, simulation_id, version, status, manifest, created_at, published_at, simulations (id, title, slug, description)')
    .eq('status', 'published')
    .order('created_at', { ascending: false });
}

export async function fetchPublishedSimulationVersionBySimulationId(simulationId: string) {
  return supabase
    .from('simulation_versions')
    .select(
      'id, simulation_id, version, status, manifest, created_at, published_at, simulations (id, title, slug, description)'
    )
    .eq('simulation_id', simulationId)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle();
}

export async function fetchSubmittedAttempts() {
  return supabase
    .from('attempts')
    .select(
      'id, submitted_at, user_id, simulation_versions (version, simulations (id, title, slug))'
    )
    .eq('status', 'submitted')
    .order('submitted_at', { ascending: false });
}

export async function fetchAttemptDetail(attemptId: string) {
  return supabase
    .from('attempts')
    .select('id, user_id, status, submitted_at, simulation_versions (version, simulations (id, title))')
    .eq('id', attemptId)
    .maybeSingle();
}

export async function fetchAttemptResponsesByAttempt(attemptId: string) {
  return supabase
    .from('attempt_responses')
    .select('response_key, response_text, response_json, created_at, updated_at')
    .eq('attempt_id', attemptId);
}

export async function fetchAttemptEventsByAttempt(attemptId: string) {
  return supabase
    .from('attempt_events')
    .select('id, event_type, payload, created_at')
    .eq('attempt_id', attemptId)
    .order('created_at', { ascending: true });
}

export async function fetchAttemptFeedback(attemptId: string) {
  return supabase
    .from('attempt_feedback')
    .select('id, attempt_id, created_by, feedback, created_at')
    .eq('attempt_id', attemptId)
    .maybeSingle();
}

export async function saveAttemptFeedback(input: {
  attemptId: string;
  createdBy: string;
  feedback: Record<string, unknown>;
}) {
  return supabase
    .from('attempt_feedback')
    .upsert(
      { attempt_id: input.attemptId, created_by: input.createdBy, feedback: input.feedback },
      { onConflict: 'attempt_id' }
    )
    .select('id, attempt_id, created_by, feedback, created_at')
    .single();
}
