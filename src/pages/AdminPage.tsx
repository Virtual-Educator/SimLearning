import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createCourse, createSimulation, fetchCourses, fetchSimulations, type Course, type Simulation } from '../lib/api';

interface AdminPageProps {
  onSignOut: () => Promise<void>;
}

const SLUG_PATTERN = /^[a-z0-9-]+$/;

export function AdminPage({ onSignOut }: AdminPageProps) {
  const [simulations, setSimulations] = useState<Simulation[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [courseCode, setCourseCode] = useState('');
  const [courseTitle, setCourseTitle] = useState('');
  const [courseTerm, setCourseTerm] = useState('');
  const [courseFormError, setCourseFormError] = useState<string | null>(null);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    setError(null);

    const [simResult, courseResult] = await Promise.all([fetchSimulations(), fetchCourses()]);

    if (simResult.error || courseResult.error) {
      setError('Unable to load admin data.');
    }

    setSimulations(simResult.data ?? []);
    setCourses(courseResult.data ?? []);

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

  async function handleCreateCourse(event: FormEvent) {
    event.preventDefault();
    setCourseFormError(null);

    if (!courseCode.trim()) {
      setCourseFormError('Course code is required.');
      return;
    }

    const { data, error: submitError } = await createCourse({
      code: courseCode.trim(),
      title: courseTitle.trim() || null,
      term: courseTerm.trim() || null,
    });

    if (submitError) {
      setCourseFormError(submitError.message || 'Unable to create course.');
    } else if (data) {
      setCourses((prev) => [...prev, data]);
      setCourseCode('');
      setCourseTitle('');
      setCourseTerm('');
    }
  }

  return (
    <div className="page">
      <div className="card" style={{ maxWidth: '960px', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <div>
            <h1 style={{ margin: '0 0 8px' }}>Simulation Library</h1>
            <p style={{ margin: 0, color: '#475569' }}>Manage courses and simulations.</p>
          </div>
          <button className="form__submit" onClick={onSignOut}>
            Sign out
          </button>
        </div>

        {error && <div className="form__error" style={{ marginTop: 12 }}>{error}</div>}

        <section style={{ marginTop: 24 }}>
          <h2 style={{ marginBottom: 12 }}>New course</h2>
          <form className="form" onSubmit={handleCreateCourse}>
            <label className="form__label">
              Course code
              <input className="form__input" value={courseCode} onChange={(e) => setCourseCode(e.target.value)} required />
            </label>
            <label className="form__label">
              Term (optional)
              <input className="form__input" value={courseTerm} onChange={(e) => setCourseTerm(e.target.value)} />
            </label>
            <label className="form__label">
              Title (optional)
              <input className="form__input" value={courseTitle} onChange={(e) => setCourseTitle(e.target.value)} />
            </label>
            {courseFormError && <div className="form__error">{courseFormError}</div>}
            <button className="form__submit" type="submit">Save course</button>
          </form>
        </section>

        <section style={{ marginTop: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>Courses</h2>
            <button className="form__submit" onClick={loadAll} disabled={loading}>
              Refresh
            </button>
          </div>
          {loading && <p>Loading courses…</p>}
          {!loading && !error && courses.length === 0 && <p>No courses found.</p>}
          {!loading && !error && courses.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '8px 6px' }}>Code</th>
                    <th style={{ padding: '8px 6px' }}>Title</th>
                    <th style={{ padding: '8px 6px' }}>Term</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map((course) => (
                    <tr key={course.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 6px' }}>{course.code}</td>
                      <td style={{ padding: '10px 6px' }}>{course.title ?? '—'}</td>
                      <td style={{ padding: '10px 6px' }}>{course.term ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section style={{ marginTop: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ marginBottom: 12 }}>New simulation</h2>
          </div>
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
            <button className="form__submit" onClick={loadAll} disabled={loading}>
              Refresh
            </button>
          </div>
          {loading && <p>Loading simulations…</p>}
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
