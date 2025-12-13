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
  manifest_json: unknown;
  created_at?: string;
  published_at?: string | null;
};

export type SimulationWithVersions = Simulation & {
  simulation_versions: SimulationVersion[];
};

export type PublishedSimulationVersion = SimulationVersion & {
  simulations: Simulation;
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
       simulation_versions(id, simulation_id, version, status, manifest_json, created_at, published_at)`
    )
    .eq('id', simulationId)
    .single();
}

export async function createSimulationVersion(
  simulationId: string,
  input: { version: string; manifest_json: unknown }
) {
  return supabase
    .from('simulation_versions')
    .insert({ ...input, simulation_id: simulationId, status: 'draft' })
    .select('id, simulation_id, version, status, manifest_json, created_at, published_at')
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
    .select('id, simulation_id, version, status, manifest_json, created_at, published_at')
    .single();
}

export async function fetchPublishedSimulationVersions() {
  return supabase
    .from('simulation_versions')
    .select('id, simulation_id, version, status, manifest_json, created_at, published_at, simulations (id, title, slug, description)')
    .eq('status', 'published')
    .order('created_at', { ascending: false });
}
