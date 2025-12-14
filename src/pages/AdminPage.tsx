import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  createActivity,
  createCourse,
  createCourseOffering,
  createSimulation,
  createTerm,
  fetchCourseOfferings,
  fetchCourses,
  fetchPublishedSimulationVersions,
  fetchSimulations,
  fetchTerms,
  type Course,
  type CourseOffering,
  type PublishedSimulationVersion,
  type Simulation,
  type Term,
} from '../lib/api';

interface AdminPageProps {
  onSignOut: () => Promise<void>;
}

const SLUG_PATTERN = /^[a-z0-9-]+$/;

export function AdminPage({ onSignOut }: AdminPageProps) {
  const [simulations, setSimulations] = useState<Simulation[]>([]);
  const [publishedVersions, setPublishedVersions] = useState<PublishedSimulationVersion[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [offerings, setOfferings] = useState<CourseOffering[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [courseCode, setCourseCode] = useState('');
  const [courseSubject, setCourseSubject] = useState('');
  const [courseNumber, setCourseNumber] = useState('');
  const [courseTitle, setCourseTitle] = useState('');
  const [courseFormError, setCourseFormError] = useState<string | null>(null);

  const [termCode, setTermCode] = useState('');
  const [termYear, setTermYear] = useState<number | ''>('');
  const [termFormError, setTermFormError] = useState<string | null>(null);

  const [offeringCourseId, setOfferingCourseId] = useState('');
  const [offeringTermId, setOfferingTermId] = useState('');
  const [offeringSection, setOfferingSection] = useState('');
  const [offeringCode, setOfferingCode] = useState('');
  const [offeringFormError, setOfferingFormError] = useState<string | null>(null);

  const [activityTitle, setActivityTitle] = useState('');
  const [activityOfferingId, setActivityOfferingId] = useState('');
  const [activitySimulationVersionId, setActivitySimulationVersionId] = useState('');
  const [activityOpensAt, setActivityOpensAt] = useState('');
  const [activityDueAt, setActivityDueAt] = useState('');
  const [activityMaxSubmissions, setActivityMaxSubmissions] = useState<number | ''>('');
  const [activityAllowResubmissions, setActivityAllowResubmissions] = useState(true);
  const [activityFormError, setActivityFormError] = useState<string | null>(null);

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    const selectedCourse = courses.find((c) => c.id === offeringCourseId);
    const selectedTerm = terms.find((t) => t.id === offeringTermId);
    if (selectedCourse && selectedTerm && offeringSection) {
      setOfferingCode(`${selectedCourse.course_code}_${selectedTerm.term_code}_${offeringSection}`);
    }
  }, [courses, terms, offeringCourseId, offeringTermId, offeringSection]);

  const sortedPublishedVersions = useMemo(() => {
    return [...publishedVersions].sort((a, b) => {
      const dateA = a.published_at ? new Date(a.published_at).getTime() : 0;
      const dateB = b.published_at ? new Date(b.published_at).getTime() : 0;
      return dateB - dateA;
    });
  }, [publishedVersions]);

  async function loadAll() {
    setLoading(true);
    setError(null);

    const [simResult, publishedResult, courseResult, termResult, offeringResult] = await Promise.all([
      fetchSimulations(),
      fetchPublishedSimulationVersions(),
      fetchCourses(),
      fetchTerms(),
      fetchCourseOfferings(),
    ]);

    if (simResult.error || publishedResult.error || courseResult.error || termResult.error || offeringResult.error) {
      setError('Unable to load admin data.');
    }

    setSimulations(simResult.data ?? []);
    const normalizedPublished = (publishedResult.data ?? []).map((row) => {
      const simulation = Array.isArray(row.simulations) ? row.simulations[0] : row.simulations;
      return { ...row, simulations: simulation } as PublishedSimulationVersion;
    });
    setPublishedVersions(normalizedPublished);
    setCourses(courseResult.data ?? []);
    setTerms(termResult.data ?? []);
    const normalizedOfferings = (offeringResult.data ?? []).map((row) => {
      const course = Array.isArray(row.courses) ? row.courses[0] : row.courses;
      const term = Array.isArray(row.terms) ? row.terms[0] : row.terms;
      return { ...row, courses: course, terms: term } as CourseOffering;
    });
    setOfferings(normalizedOfferings);

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

    if (!courseCode.trim() || !courseSubject.trim() || !courseNumber.trim()) {
      setCourseFormError('Course code, subject, and number are required.');
      return;
    }

    const { data, error: submitError } = await createCourse({
      course_code: courseCode.trim(),
      subject: courseSubject.trim(),
      number: courseNumber.trim(),
      title: courseTitle.trim() || null,
    });

    if (submitError) {
      setCourseFormError(submitError.message || 'Unable to create course.');
    } else if (data) {
      setCourses((prev) => [...prev, data]);
      setCourseCode('');
      setCourseSubject('');
      setCourseNumber('');
      setCourseTitle('');
    }
  }

  async function handleCreateTerm(event: FormEvent) {
    event.preventDefault();
    setTermFormError(null);

    if (!termCode.trim()) {
      setTermFormError('Term code is required.');
      return;
    }

    const { data, error: submitError } = await createTerm({
      term_code: termCode.trim(),
      year: termYear === '' ? null : Number(termYear),
      starts_at: null,
      ends_at: null,
    });

    if (submitError) {
      setTermFormError(submitError.message || 'Unable to create term.');
    } else if (data) {
      setTerms((prev) => [...prev, data]);
      setTermCode('');
      setTermYear('');
    }
  }

  async function handleCreateOffering(event: FormEvent) {
    event.preventDefault();
    setOfferingFormError(null);

    if (!offeringCourseId || !offeringTermId || !offeringSection.trim() || !offeringCode.trim()) {
      setOfferingFormError('Course, term, section, and offering code are required.');
      return;
    }

    const { data, error: submitError } = await createCourseOffering({
      course_id: offeringCourseId,
      term_id: offeringTermId,
      section: offeringSection.trim(),
      offering_code: offeringCode.trim(),
    });

    if (submitError) {
      setOfferingFormError(submitError.message || 'Unable to create offering.');
    } else if (data) {
      const course = courses.find((c) => c.id === offeringCourseId) ?? null;
      const term = terms.find((t) => t.id === offeringTermId) ?? null;
      setOfferings((prev) => [...prev, { ...data, courses: course, terms: term }]);
      setOfferingCourseId('');
      setOfferingTermId('');
      setOfferingSection('');
      setOfferingCode('');
    }
  }

  async function handleCreateActivity(event: FormEvent) {
    event.preventDefault();
    setActivityFormError(null);

    if (!activityTitle.trim() || !activityOfferingId || !activitySimulationVersionId) {
      setActivityFormError('Title, offering, and simulation version are required.');
      return;
    }

    const { error: submitError } = await createActivity({
      title: activityTitle.trim(),
      offering_id: activityOfferingId,
      simulation_version_id: activitySimulationVersionId,
      opens_at: activityOpensAt || null,
      due_at: activityDueAt || null,
      max_submissions: activityMaxSubmissions === '' ? null : Number(activityMaxSubmissions),
      allow_resubmissions: activityAllowResubmissions,
    });

    if (submitError) {
      setActivityFormError(submitError.message || 'Unable to create activity.');
    } else {
      setActivityTitle('');
      setActivityOfferingId('');
      setActivitySimulationVersionId('');
      setActivityOpensAt('');
      setActivityDueAt('');
      setActivityMaxSubmissions('');
      setActivityAllowResubmissions(true);
      await loadAll();
    }
  }

  return (
    <div className="page">
      <div className="card" style={{ maxWidth: '960px', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <div>
            <h1 style={{ margin: '0 0 8px' }}>Simulation Library</h1>
            <p style={{ margin: 0, color: '#475569' }}>Manage courses, terms, offerings, activities, and simulations.</p>
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
              Subject
              <input className="form__input" value={courseSubject} onChange={(e) => setCourseSubject(e.target.value)} required />
            </label>
            <label className="form__label">
              Number
              <input className="form__input" value={courseNumber} onChange={(e) => setCourseNumber(e.target.value)} required />
            </label>
            <label className="form__label">
              Title (optional)
              <input className="form__input" value={courseTitle} onChange={(e) => setCourseTitle(e.target.value)} />
            </label>
            {courseFormError && <div className="form__error">{courseFormError}</div>}
            <button className="form__submit" type="submit">Save course</button>
          </form>
        </section>

        <section style={{ marginTop: 24 }}>
          <h2 style={{ marginBottom: 12 }}>New term</h2>
          <form className="form" onSubmit={handleCreateTerm}>
            <label className="form__label">
              Term code
              <input className="form__input" value={termCode} onChange={(e) => setTermCode(e.target.value)} required />
            </label>
            <label className="form__label">
              Year (optional)
              <input
                className="form__input"
                type="number"
                value={termYear}
                onChange={(e) => setTermYear(e.target.value === '' ? '' : Number(e.target.value))}
                min={0}
              />
            </label>
            {termFormError && <div className="form__error">{termFormError}</div>}
            <button className="form__submit" type="submit">Save term</button>
          </form>
        </section>

        <section style={{ marginTop: 24 }}>
          <h2 style={{ marginBottom: 12 }}>New course offering</h2>
          <form className="form" onSubmit={handleCreateOffering}>
            <label className="form__label">
              Course
              <select
                className="form__input"
                value={offeringCourseId}
                onChange={(e) => setOfferingCourseId(e.target.value)}
                required
              >
                <option value="">Select course</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.course_code} {course.title ? `— ${course.title}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="form__label">
              Term
              <select
                className="form__input"
                value={offeringTermId}
                onChange={(e) => setOfferingTermId(e.target.value)}
                required
              >
                <option value="">Select term</option>
                {terms.map((term) => (
                  <option key={term.id} value={term.id}>
                    {term.term_code} {term.year ? `(${term.year})` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="form__label">
              Section
              <input className="form__input" value={offeringSection} onChange={(e) => setOfferingSection(e.target.value)} required />
            </label>
            <label className="form__label">
              Offering code
              <input className="form__input" value={offeringCode} onChange={(e) => setOfferingCode(e.target.value)} required />
            </label>
            {offeringFormError && <div className="form__error">{offeringFormError}</div>}
            <button className="form__submit" type="submit">Save offering</button>
          </form>
        </section>

        <section style={{ marginTop: 24 }}>
          <h2 style={{ marginBottom: 12 }}>New activity</h2>
          <form className="form" onSubmit={handleCreateActivity}>
            <label className="form__label">
              Title
              <input className="form__input" value={activityTitle} onChange={(e) => setActivityTitle(e.target.value)} required />
            </label>
            <label className="form__label">
              Offering
              <select
                className="form__input"
                value={activityOfferingId}
                onChange={(e) => setActivityOfferingId(e.target.value)}
                required
              >
                <option value="">Select offering</option>
                {offerings.map((offering) => (
                  <option key={offering.id} value={offering.id}>
                    {offering.offering_code}
                  </option>
                ))}
              </select>
            </label>
            <label className="form__label">
              Simulation version
              <select
                className="form__input"
                value={activitySimulationVersionId}
                onChange={(e) => setActivitySimulationVersionId(e.target.value)}
                required
              >
                <option value="">Select published version</option>
                {sortedPublishedVersions.map((version) => (
                  <option key={version.id} value={version.id}>
                    {version.simulations.title} — v{version.version}
                  </option>
                ))}
              </select>
            </label>
            <label className="form__label">
              Opens at (optional)
              <input
                className="form__input"
                type="datetime-local"
                value={activityOpensAt}
                onChange={(e) => setActivityOpensAt(e.target.value)}
              />
            </label>
            <label className="form__label">
              Due at (optional)
              <input
                className="form__input"
                type="datetime-local"
                value={activityDueAt}
                onChange={(e) => setActivityDueAt(e.target.value)}
              />
            </label>
            <label className="form__label">
              Max submissions (optional)
              <input
                className="form__input"
                type="number"
                min={1}
                value={activityMaxSubmissions}
                onChange={(e) => setActivityMaxSubmissions(e.target.value === '' ? '' : Number(e.target.value))}
              />
            </label>
            <label className="form__label" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={activityAllowResubmissions}
                onChange={(e) => setActivityAllowResubmissions(e.target.checked)}
              />
              Allow resubmissions
            </label>
            {activityFormError && <div className="form__error">{activityFormError}</div>}
            <button className="form__submit" type="submit">Save activity</button>
          </form>
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
