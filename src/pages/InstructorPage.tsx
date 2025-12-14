import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchSubmittedAttempts, type AttemptWithActivity } from '../lib/api';

interface InstructorPageProps {
  onSignOut: () => Promise<void>;
}

export function InstructorPage({ onSignOut }: InstructorPageProps) {
  const [attempts, setAttempts] = useState<AttemptWithActivity[]>([]);
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
        const activity = Array.isArray(row.activities) ? row.activities[0] : row.activities;
        const simVersionRaw = activity?.simulation_versions;
        const simVersion = (Array.isArray(simVersionRaw) ? simVersionRaw[0] : simVersionRaw) as any;
        const simulationRaw = simVersion?.simulations;
        const simulation = (Array.isArray(simulationRaw) ? simulationRaw[0] : simulationRaw) as any;

        return {
          id: row.id,
          attempt_no: row.attempt_no,
          submitted_at: row.submitted_at,
          student_id: row.student_id,
          activities: activity
            ? {
                id: activity.id,
                title: activity.title,
                simulation_versions: simVersion
                  ? {
                      version: simVersion.version,
                      simulations: Array.isArray(simulation) ? simulation[0] : simulation ?? null,
                    }
                  : null,
              }
            : null,
        } satisfies AttemptWithActivity;
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
                    <th style={{ padding: '8px 6px' }}>Activity</th>
                    <th style={{ padding: '8px 6px' }}>Simulation</th>
                    <th style={{ padding: '8px 6px' }}>Attempt</th>
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
                          {attempt.activities?.title ?? 'Unknown activity'}
                        </Link>
                      </td>
                      <td style={{ padding: '10px 6px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <strong>{attempt.activities?.simulation_versions?.simulations?.title ?? 'Unknown simulation'}</strong>
                          <span style={{ color: '#475569', fontSize: 13 }}>
                            Version {attempt.activities?.simulation_versions?.version ?? '—'}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 6px', color: '#475569' }}>#{attempt.attempt_no}</td>
                      <td style={{ padding: '10px 6px', color: '#475569' }}>{attempt.student_id}</td>
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
