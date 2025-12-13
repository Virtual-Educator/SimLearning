import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  createSimulationVersion,
  fetchSimulationWithVersions,
  fetchPublishedSimulationVersionBySimulationId,
  publishSimulationVersion,
  type SimulationWithVersions,
  type SimulationVersion,
} from '../lib/api';

interface AdminSimulationDetailPageProps {
  onSignOut: () => Promise<void>;
}

export function AdminSimulationDetailPage({ onSignOut }: AdminSimulationDetailPageProps) {
  const { simulationId } = useParams<{ simulationId: string }>();
  const [simulation, setSimulation] = useState<SimulationWithVersions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [version, setVersion] = useState('');
  const [manifestInput, setManifestInput] = useState('');
  const [latestPublishedVersion, setLatestPublishedVersion] = useState<SimulationVersion | null>(null);
  const [isManifestDirty, setIsManifestDirty] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const sortedVersions: SimulationVersion[] = useMemo(() => {
    if (!simulation) return [];
    return [...simulation.simulation_versions].sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA;
    });
  }, [simulation]);

  const latestPublishedManifestText = useMemo(() => {
    if (!latestPublishedVersion?.manifest) return '';
    try {
      return JSON.stringify(latestPublishedVersion.manifest, null, 2);
    } catch (err) {
      return '';
    }
  }, [latestPublishedVersion]);

  useEffect(() => {
    if (!simulationId) return;
    loadSimulation(simulationId);
  }, [simulationId]);

  useEffect(() => {
    if (isManifestDirty) return;
    if (!latestPublishedManifestText) return;
    if (manifestInput.trim() !== '') return;

    setManifestInput(latestPublishedManifestText);
  }, [isManifestDirty, latestPublishedManifestText, manifestInput]);

  async function loadSimulation(id: string) {
    setLoading(true);
    setError(null);
    const [simulationResult, latestPublishedResult] = await Promise.all([
      fetchSimulationWithVersions(id),
      fetchPublishedSimulationVersionBySimulationId(id),
    ]);

    if (simulationResult.error) {
      setError('Unable to load simulation details.');
    } else {
      setSimulation(simulationResult.data ?? null);
    }

    if (!latestPublishedResult.error) {
      setLatestPublishedVersion(latestPublishedResult.data ?? null);
    }

    setLoading(false);
  }

  function handleManifestChange(value: string) {
    if (!isManifestDirty) {
      setIsManifestDirty(true);
    }
    setManifestInput(value);
  }

  function handleCloneLatestManifest() {
    if (!latestPublishedManifestText) return;
    if (isManifestDirty) return;

    setManifestInput(latestPublishedManifestText);
  }

  async function handleCreateVersion(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (!simulationId) return;
    if (!version.trim()) {
      setFormError('Version is required.');
      return;
    }

    if (!manifestInput.trim()) {
      setFormError('Manifest JSON is required and must be valid JSON.');
      return;
    }

    let parsedManifest: unknown;
    try {
      parsedManifest = JSON.parse(manifestInput);
    } catch (err) {
      setFormError('Manifest JSON must be valid JSON.');
      return;
    }

    setIsSubmitting(true);
    const { data, error: submitError } = await createSimulationVersion(simulationId, {
      version: version.trim(),
      manifest: parsedManifest,
    });

    if (submitError) {
      setFormError(submitError.message || 'Unable to create version.');
    } else if (data) {
      setSimulation((prev) =>
        prev
          ? { ...prev, simulation_versions: [data, ...(prev.simulation_versions || [])] }
          : prev
      );
      setVersion('');
      setManifestInput('');
      setIsManifestDirty(false);
    }

    setIsSubmitting(false);
  }

  async function handlePublish(versionId: string) {
    if (!simulationId) return;
    setPublishingId(versionId);
    const { data, error: publishError } = await publishSimulationVersion(simulationId, versionId);
    if (publishError) {
      setError(publishError.message || 'Unable to publish version.');
    } else if (data) {
      setSimulation((prev) => {
        if (!prev) return prev;
        const publishedVersionId = data.id;
        const publishedAt = data.published_at ?? null;
        const updated: SimulationVersion[] = prev.simulation_versions.map((v) => {
          if (v.id === publishedVersionId) {
            return { ...v, status: 'published', published_at: publishedAt };
          }
          if (v.status === 'published' && v.id !== publishedVersionId) {
            return { ...v, status: 'archived' };
          }
          return v;
        });
        return { ...prev, simulation_versions: updated };
      });
    }
    setPublishingId(null);
  }

  if (loading) {
    return (
      <div className="page">
        <div className="card">
          <p>Loading simulation…</p>
        </div>
      </div>
    );
  }

  if (error || !simulation) {
    return (
      <div className="page">
        <div className="card">
          <p>{error || 'Simulation not found.'}</p>
          <div style={{ marginTop: 12 }}>
            <Link to="/admin" style={{ color: '#0ea5e9', fontWeight: 600 }}>
              Back to admin
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="card" style={{ maxWidth: '960px', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <div>
            <p style={{ margin: 0, color: '#475569' }}>
              <Link to="/admin" style={{ color: '#0ea5e9', textDecoration: 'none', fontWeight: 600 }}>
                ← Back to simulations
              </Link>
            </p>
            <h1 style={{ margin: '8px 0 0' }}>{simulation.title}</h1>
            <p style={{ margin: '4px 0', color: '#475569' }}>Slug: {simulation.slug}</p>
          </div>
          <button className="form__submit" onClick={onSignOut}>
            Sign out
          </button>
        </div>

        {simulation.description && (
          <p style={{ marginTop: 12, color: '#334155' }}>{simulation.description}</p>
        )}

        <section style={{ marginTop: 24 }}>
          <h2 style={{ marginBottom: 12 }}>New version</h2>
          <form className="form" onSubmit={handleCreateVersion}>
            <label className="form__label">
              Version
              <input
                className="form__input"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="0.1.0"
                required
              />
            </label>
            <label className="form__label">
              Manifest JSON
              <textarea
                className="form__input"
                value={manifestInput}
                onChange={(e) => handleManifestChange(e.target.value)}
                rows={8}
                placeholder='{ "scene": {} }'
                required
              />
            </label>

            {latestPublishedManifestText && (
              <button
                className="form__submit"
                type="button"
                onClick={handleCloneLatestManifest}
                style={{ alignSelf: 'flex-start' }}
              >
                Clone latest published
              </button>
            )}

            {formError && <div className="form__error">{formError}</div>}

            <button className="form__submit" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Create draft version'}
            </button>
          </form>
        </section>

        {latestPublishedManifestText && (
          <section style={{ marginTop: 24 }}>
            <h3 style={{ marginBottom: 8 }}>Latest published manifest</h3>
            <p style={{ marginTop: 0, color: '#475569' }}>
              Pulled from the most recently published version.
            </p>
            <pre
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: 12,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {latestPublishedManifestText}
            </pre>
          </section>
        )}

        <section style={{ marginTop: 32 }}>
          <h2 style={{ marginBottom: 12 }}>Versions</h2>
          {sortedVersions.length === 0 && <p>No versions yet.</p>}
          {sortedVersions.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '8px 6px' }}>Version</th>
                    <th style={{ padding: '8px 6px' }}>Status</th>
                    <th style={{ padding: '8px 6px' }}>Created</th>
                    <th style={{ padding: '8px 6px' }}>Published</th>
                    <th style={{ padding: '8px 6px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedVersions.map((versionRow) => (
                    <tr key={versionRow.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 6px' }}>{versionRow.version}</td>
                      <td style={{ padding: '10px 6px', textTransform: 'capitalize' }}>{versionRow.status}</td>
                      <td style={{ padding: '10px 6px', color: '#475569' }}>
                        {versionRow.created_at ? new Date(versionRow.created_at).toLocaleString() : '—'}
                      </td>
                      <td style={{ padding: '10px 6px', color: '#475569' }}>
                        {versionRow.published_at ? new Date(versionRow.published_at).toLocaleString() : '—'}
                      </td>
                      <td style={{ padding: '10px 6px' }}>
                        {versionRow.status !== 'published' && (
                          <button
                            className="form__submit"
                            onClick={() => handlePublish(versionRow.id)}
                            disabled={publishingId === versionRow.id}
                          >
                            {publishingId === versionRow.id ? 'Publishing…' : 'Publish'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
