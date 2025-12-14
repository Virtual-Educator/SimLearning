import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getStudentAssignedSimulations, type StudentAssignedSimulation } from '../lib/api';

interface PlayerPageProps {
  onSignOut: () => Promise<void>;
}

export function PlayerPage({ onSignOut }: PlayerPageProps) {
  const { session } = useAuth();
  const [simulations, setSimulations] = useState<StudentAssignedSimulation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSimulations();
  }, []);

  const sortedSimulations = useMemo(() => {
    return [...simulations].sort((a, b) => {
      const courseCompare = (a.course_code ?? '').localeCompare(b.course_code ?? '');
      if (courseCompare !== 0) return courseCompare;
      return a.simulation_title.localeCompare(b.simulation_title);
    });
  }, [simulations]);

  async function loadSimulations() {
    if (!session?.user) {
      setError('You must be signed in to view simulations.');
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await getStudentAssignedSimulations();

    if (fetchError) {
      setError('Unable to load simulations.');
      setLoading(false);
      return;
    }

    setSimulations(data ?? []);
    setLoading(false);
  }

  return (
    <div className="page">
      <div className="card" style={{ maxWidth: '960px', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <div>
            <h1 style={{ margin: '0 0 8px' }}>Assigned simulations</h1>
            <p style={{ margin: 0, color: '#475569' }}>Explore simulations assigned to your enrolled courses.</p>
          </div>
          <button className="form__submit" onClick={onSignOut}>
            Sign out
          </button>
        </div>

        <section style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>Simulations</h2>
            <button className="form__submit" onClick={loadSimulations} disabled={loading}>
              Refresh
            </button>
          </div>
          {loading && <p>Loading simulations…</p>}
          {error && <div className="form__error">{error}</div>}
          {!loading && !error && sortedSimulations.length === 0 && (
            <p>No simulations assigned yet. Check enrollment or ask your instructor.</p>
          )}
          {!loading && !error && sortedSimulations.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '8px 6px' }}>Course</th>
                    <th style={{ padding: '8px 6px' }}>Simulation</th>
                    <th style={{ padding: '8px 6px' }}>Version</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSimulations.map((simulation) => (
                    <tr
                      key={`${simulation.course_id}-${simulation.simulation_id}`}
                      style={{ borderBottom: '1px solid #f1f5f9' }}
                    >
                      <td style={{ padding: '10px 6px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <strong>{simulation.course_code || 'Course'}</strong>
                          <span style={{ color: '#475569', fontSize: 13 }}>
                            {simulation.course_title || 'No course title'}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 6px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <strong>{simulation.simulation_title}</strong>
                          <span style={{ color: '#475569', fontSize: 13 }}>
                            {simulation.simulation_description || 'No description provided.'}
                          </span>
                          <span style={{ color: '#94a3b8', fontSize: 12 }}>Slug: {simulation.simulation_slug}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 6px', color: '#475569' }}>v{simulation.version}</td>
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
