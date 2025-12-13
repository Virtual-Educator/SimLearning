import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  createSimulation,
  fetchSimulations,
  type Simulation,
} from '../lib/api';

interface AdminPageProps {
  onSignOut: () => Promise<void>;
}

const SLUG_PATTERN = /^[a-z0-9-]+$/;

export function AdminPage({ onSignOut }: AdminPageProps) {
  const [simulations, setSimulations] = useState<Simulation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadSimulations();
  }, []);

  async function loadSimulations() {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await fetchSimulations();
    if (fetchError) {
      setError('Unable to load simulations.');
    } else {
      setSimulations(data ?? []);
    }
    setLoading(false);
  }

  async function handleCreateSimulation(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (!title.trim() || !slug.trim()) {
      setFormError('Title and slug are required.');
      return;
    }

    if (!SLUG_PATTERN.test(slug)) {
      setFormError('Slug can include lowercase letters, numbers, and hyphens only.');
      return;
    }

    setIsSubmitting(true);
    const { data, error: submitError } = await createSimulation({
      title: title.trim(),
      slug: slug.trim(),
      description: description.trim() || undefined,
    });

    if (submitError) {
      setFormError(submitError.message || 'Unable to create simulation.');
    } else if (data) {
      setSimulations((prev) => [data, ...prev]);
      setTitle('');
      setSlug('');
      setDescription('');
    }

    setIsSubmitting(false);
  }

  return (
    <div className="page">
      <div className="card" style={{ maxWidth: '960px', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <div>
            <h1 style={{ margin: '0 0 8px' }}>Simulation Library</h1>
            <p style={{ margin: 0, color: '#475569' }}>Manage simulations and their versions.</p>
          </div>
          <button className="form__submit" onClick={onSignOut}>
            Sign out
          </button>
        </div>

        <section style={{ marginTop: 24 }}>
          <h2 style={{ marginBottom: 12 }}>New simulation</h2>
          <form className="form" onSubmit={handleCreateSimulation}>
            <label className="form__label">
              Title
              <input
                className="form__input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </label>
            <label className="form__label">
              Slug
              <input
                className="form__input"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                required
                pattern={SLUG_PATTERN.source}
                title="Lowercase letters, numbers, and hyphens only"
              />
            </label>
            <label className="form__label">
              Description (optional)
              <textarea
                className="form__input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </label>

            {formError && <div className="form__error">{formError}</div>}

            <button className="form__submit" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'New simulation'}
            </button>
          </form>
        </section>

        <section style={{ marginTop: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>Simulations</h2>
            <button className="form__submit" onClick={loadSimulations} disabled={loading}>
              Refresh
            </button>
          </div>
          {loading && <p>Loading simulations…</p>}
          {error && <div className="form__error">{error}</div>}
          {!loading && !error && simulations.length === 0 && <p>No simulations found.</p>}
          {!loading && !error && simulations.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '8px 6px' }}>Title</th>
                    <th style={{ padding: '8px 6px' }}>Slug</th>
                    <th style={{ padding: '8px 6px' }}>Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {simulations.map((simulation) => (
                    <tr key={simulation.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 6px' }}>
                        <Link to={`/admin/simulations/${simulation.id}`} style={{ color: '#0ea5e9', fontWeight: 600 }}>
                          {simulation.title}
                        </Link>
                      </td>
                      <td style={{ padding: '10px 6px' }}>{simulation.slug}</td>
                      <td style={{ padding: '10px 6px', color: '#475569' }}>
                        {simulation.updated_at ? new Date(simulation.updated_at).toLocaleString() : '—'}
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
