import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

interface ActivityListItem {
  id: string;
  title: string;
  opens_at: string | null;
  due_at: string | null;
  max_submissions: number | null;
  allow_resubmissions: boolean;
  course_offerings: {
    offering_code: string;
    courses?: { course_code: string; title: string | null } | null;
    terms?: { term_code: string } | null;
  } | null;
  simulation_versions: {
    version: string;
    simulations?: { title: string; slug: string } | null;
  } | null;
}

interface AttemptSummary {
  id: string;
  activity_id: string;
  attempt_no: number;
  status: string;
  submitted_at: string | null;
}

interface PlayerPageProps {
  onSignOut: () => Promise<void>;
}

export function PlayerPage({ onSignOut }: PlayerPageProps) {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [activities, setActivities] = useState<ActivityListItem[]>([]);
  const [attemptsByActivity, setAttemptsByActivity] = useState<Record<string, AttemptSummary[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadActivities();
  }, []);

  const sortedActivities = useMemo(() => {
    return [...activities].sort((a, b) => {
      const aCode = a.course_offerings?.offering_code ?? '';
      const bCode = b.course_offerings?.offering_code ?? '';
      return aCode.localeCompare(bCode);
    });
  }, [activities]);

  async function loadActivities() {
    if (!session?.user) {
      setError('You must be signed in to view activities.');
      return;
    }

    setLoading(true);
    setError(null);

    const { data: activityRows, error: activityError } = await supabase
      .from('activities')
      .select(
        `id, title, opens_at, due_at, max_submissions, allow_resubmissions,
         course_offerings (offering_code, courses (course_code, title), terms (term_code)),
         simulation_versions (version, simulations (title, slug))`
      )
      .order('opens_at', { ascending: true });

    if (activityError) {
      setError('Unable to load activities.');
      setLoading(false);
      return;
    }

    const normalizedActivities = (activityRows ?? []).map((row) => {
      const offering = Array.isArray(row.course_offerings)
        ? row.course_offerings[0]
        : (row.course_offerings as ActivityListItem['course_offerings']);
      const simVersion = Array.isArray(row.simulation_versions)
        ? row.simulation_versions[0]
        : (row.simulation_versions as ActivityListItem['simulation_versions']);

      const course = offering?.courses;
      const term = offering?.terms;
      const simulation = simVersion?.simulations;

      return {
        id: row.id,
        title: row.title,
        opens_at: row.opens_at,
        due_at: row.due_at,
        max_submissions: row.max_submissions,
        allow_resubmissions: row.allow_resubmissions,
        course_offerings: offering
          ? {
              offering_code: offering.offering_code,
              courses: Array.isArray(course) ? course[0] : course ?? null,
              terms: Array.isArray(term) ? term[0] : term ?? null,
            }
          : null,
        simulation_versions: simVersion
          ? {
              version: simVersion.version,
              simulations: Array.isArray(simulation) ? simulation[0] : simulation ?? null,
            }
          : null,
      } satisfies ActivityListItem;
    });

    setActivities(normalizedActivities);

    const { data: attemptRows, error: attemptError } = await supabase
      .from('attempts')
      .select('id, activity_id, attempt_no, status, submitted_at')
      .eq('student_id', session.user.id);

    if (!attemptError) {
      const grouped: Record<string, AttemptSummary[]> = {};
      (attemptRows ?? []).forEach((row) => {
        const list = grouped[row.activity_id] ?? [];
        list.push(row as AttemptSummary);
        grouped[row.activity_id] = list.sort((a, b) => b.attempt_no - a.attempt_no);
      });
      setAttemptsByActivity(grouped);
    }

    setLoading(false);
  }

  function renderAttemptSummary(activityId: string) {
    const attempts = attemptsByActivity[activityId] ?? [];
    if (attempts.length === 0) return 'No attempts yet';
    const latest = attempts[0];
    if (latest.status === 'submitted') {
      return `Submitted attempt #${latest.attempt_no} ${latest.submitted_at ? `on ${new Date(latest.submitted_at).toLocaleString()}` : ''}`;
    }
    return `Draft attempt #${latest.attempt_no}`;
  }

  return (
    <div className="page">
      <div className="card" style={{ maxWidth: '960px', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <div>
            <h1 style={{ margin: '0 0 8px' }}>Assigned activities</h1>
            <p style={{ margin: 0, color: '#475569' }}>
              Open course activities for your enrolled offerings and start attempts.
            </p>
          </div>
          <button className="form__submit" onClick={onSignOut}>
            Sign out
          </button>
        </div>

        <section style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ margin: 0 }}>Activities</h2>
            <button className="form__submit" onClick={loadActivities} disabled={loading}>
              Refresh
            </button>
          </div>
          {loading && <p>Loading activities…</p>}
          {error && <div className="form__error">{error}</div>}
          {!loading && !error && sortedActivities.length === 0 && <p>No activities assigned yet.</p>}
          {!loading && !error && sortedActivities.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '8px 6px' }}>Activity</th>
                    <th style={{ padding: '8px 6px' }}>Offering</th>
                    <th style={{ padding: '8px 6px' }}>Simulation</th>
                    <th style={{ padding: '8px 6px' }}>Availability</th>
                    <th style={{ padding: '8px 6px' }}>Attempts</th>
                    <th style={{ padding: '8px 6px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedActivities.map((activity) => {
                    const availabilityParts: string[] = [];
                    if (activity.opens_at) {
                      availabilityParts.push(`Opens ${new Date(activity.opens_at).toLocaleString()}`);
                    }
                    if (activity.due_at) {
                      availabilityParts.push(`Due ${new Date(activity.due_at).toLocaleString()}`);
                    }
                    const availability = availabilityParts.join(' · ');
                    const offeringLabel = activity.course_offerings?.offering_code ?? '—';
                    const simulationTitle = activity.simulation_versions?.simulations?.title ?? 'Unknown simulation';
                    const attemptSummary = renderAttemptSummary(activity.id);

                    return (
                      <tr key={activity.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 6px', fontWeight: 600 }}>{activity.title}</td>
                        <td style={{ padding: '10px 6px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <strong>{offeringLabel}</strong>
                            <span style={{ color: '#475569', fontSize: 13 }}>
                              {activity.course_offerings?.courses?.title || activity.course_offerings?.courses?.course_code || 'Course'}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '10px 6px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <strong>{simulationTitle}</strong>
                            <span style={{ color: '#475569', fontSize: 13 }}>Version {activity.simulation_versions?.version ?? '—'}</span>
                          </div>
                        </td>
                        <td style={{ padding: '10px 6px', color: '#475569' }}>{availability || 'No due date'}</td>
                        <td style={{ padding: '10px 6px', color: '#475569' }}>{attemptSummary}</td>
                        <td style={{ padding: '10px 6px' }}>
                          <button
                            className="form__submit"
                            type="button"
                            onClick={() => navigate(`/player/activities/${activity.id}`)}
                          >
                            Open
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
