import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchPublishedSimulationVersions, type PublishedSimulationVersion } from '../lib/api';

interface PlayerPageProps {
  onSignOut: () => Promise<void>;
}

export function PlayerPage({ onSignOut }: PlayerPageProps) {
  const navigate = useNavigate();
  const [publishedSimulations, setPublishedSimulations] = useState<PublishedSimulationVersion[]>([]);
  const [publishedError, setPublishedError] = useState<string | null>(null);
  const [loadingPublished, setLoadingPublished] = useState(false);

  const loadPublishedSimulations = async () => {
    setLoadingPublished(true);
    setPublishedError(null);
    const { data, error } = await fetchPublishedSimulationVersions();
    if (error) {
      setPublishedError('Unable to load published simulations.');
    } else {
      const normalized = (data ?? []).map((row) => {
        const simulation = Array.isArray(row.simulations) ? row.simulations[0] : row.simulations;
        return { ...row, simulations: simulation } as PublishedSimulationVersion;
      });
      setPublishedSimulations(normalized);
    }
    setLoadingPublished(false);
  };

  useEffect(() => {
    loadPublishedSimulations();
  }, []);

  return (
    <div className="page">
      <div className="card" style={{ maxWidth: '960px', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <div>
            <h1 style={{ margin: '0 0 8px' }}>Published simulations</h1>
            <p style={{ margin: 0, color: '#475569' }}>Browse available simulations and open the latest published version.</p>
          </div>
          <button className="form__submit" onClick={onSignOut}>
            Sign out
          </button>
        </div>

        <section style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>Available simulations</h2>
            <button className="form__submit" onClick={loadPublishedSimulations} disabled={loadingPublished}>
              Refresh
            </button>
          </div>
          {loadingPublished && <p>Loading published simulations…</p>}
          {publishedError && <div className="form__error">{publishedError}</div>}
          {!loadingPublished && !publishedError && publishedSimulations.length === 0 && <p>No published simulations yet.</p>}
          {!loadingPublished && !publishedError && publishedSimulations.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '8px 6px' }}>Title</th>
                    <th style={{ padding: '8px 6px' }}>Slug</th>
                    <th style={{ padding: '8px 6px' }}>Description</th>
                    <th style={{ padding: '8px 6px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {publishedSimulations.map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 6px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <strong>{item.simulations.title}</strong>
                          <span style={{ color: '#475569', fontSize: 14 }}>Version {item.version}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 6px' }}>{item.simulations.slug}</td>
                      <td style={{ padding: '10px 6px', color: '#475569' }}>
                        {item.simulations.description || 'No description provided.'}
                      </td>
                      <td style={{ padding: '10px 6px' }}>
                        <button
                          className="form__submit"
                          type="button"
                          onClick={() => navigate(`/player/simulations/${item.simulation_id}`)}
                        >
                          Open
                        </button>
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
