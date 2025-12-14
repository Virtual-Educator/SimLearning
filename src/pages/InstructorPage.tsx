import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchSubmittedAttempts, type AttemptWithSimulation } from '../lib/api';

interface InstructorPageProps {
  onSignOut: () => Promise<void>;
}

export function InstructorPage({ onSignOut }: InstructorPageProps) {
  const [attempts, setAttempts] = useState<AttemptWithSimulation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAttempts();
  }, []);

  async function loadAttempts() {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await fetchSubmittedAttempts();
    if (fetchError) {
      setError('Unable to load submitted attempts.');
    } else {
      const normalizedAttempts = (data ?? []).map((row) => {
        const simVersion = Array.isArray(row.simulation_versions)
          ? row.simulation_versions[0]
          : row.simulation_versions;

        const simulation = simVersion?.simulations;
        const normalizedSimulation = Array.isArray(simulation) ? simulation[0] : simulation;

        return {
          id: row.id,
          submitted_at: row.submitted_at,
          user_id: row.user_id,
          simulation_versions: simVersion
            ? {
                version: simVersion.version,
                simulations: normalizedSimulation ?? null,
              }
            : null,
        } satisfies AttemptWithSimulation;
      });

      setAttempts(normalizedAttempts);
    }
    setLoading(false);
  }

  return (
    <div className="page">
      <div className="card" style={{ maxWidth: '960px', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <div>
            <h1 style={{ margin: '0 0 8px' }}>Submitted attempts</h1>
            <p style={{ margin: 0, color: '#475569' }}>
              Review student submissions across all simulations.
            </p>
          </div>
          <button className="form__submit" onClick={onSignOut}>
            Sign out
          </button>
        </div>

        <section style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>Submissions</h2>
            <button className="form__submit" onClick={loadAttempts} disabled={loading}>
              Refresh
            </button>
          </div>

          {loading && <p>Loading submitted attempts…</p>}
          {error && <div className="form__error">{error}</div>}
          {!loading && !error && attempts.length === 0 && <p>No submitted attempts found.</p>}
          {!loading && !error && attempts.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '8px 6px' }}>Simulation</th>
                    <th style={{ padding: '8px 6px' }}>Version</th>
                    <th style={{ padding: '8px 6px' }}>Student</th>
                    <th style={{ padding: '8px 6px' }}>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((attempt) => (
                    <tr key={attempt.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 6px' }}>
                        <Link
                          to={`/instructor/attempts/${attempt.id}`}
                          style={{ color: '#0ea5e9', fontWeight: 600 }}
                        >
                          {attempt.simulation_versions?.simulations?.title ?? 'Unknown simulation'}
                        </Link>
                      </td>
                      <td style={{ padding: '10px 6px' }}>{attempt.simulation_versions?.version ?? '—'}</td>
                      <td style={{ padding: '10px 6px', color: '#475569' }}>{attempt.user_id}</td>
                      <td style={{ padding: '10px 6px', color: '#475569' }}>
                        {attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleString() : '—'}
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
