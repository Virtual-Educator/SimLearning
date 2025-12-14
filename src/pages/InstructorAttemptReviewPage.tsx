import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  fetchAttemptDetail,
  fetchAttemptEventsByAttempt,
  fetchAttemptFeedback,
  fetchAttemptResponsesByAttempt,
  saveAttemptFeedback,
  type AttemptDetail,
  type AttemptEventRow,
  type AttemptFeedbackRow,
  type AttemptResponseRow,
} from '../lib/api';

export function InstructorAttemptReviewPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const { session } = useAuth();

  const [attempt, setAttempt] = useState<AttemptDetail | null>(null);
  const [primaryResponse, setPrimaryResponse] = useState<string>('');
  const [events, setEvents] = useState<AttemptEventRow[]>([]);
  const [feedbackText, setFeedbackText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingFeedback, setSavingFeedback] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  useEffect(() => {
    loadAttempt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  async function loadAttempt() {
    if (!attemptId) {
      setError('Attempt id is required.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setFeedbackMessage(null);

    const [attemptResult, responsesResult, eventsResult, feedbackResult] = await Promise.all([
      fetchAttemptDetail(attemptId),
      fetchAttemptResponsesByAttempt(attemptId),
      fetchAttemptEventsByAttempt(attemptId),
      fetchAttemptFeedback(attemptId),
    ]);

    if (attemptResult.error || responsesResult.error || eventsResult.error || feedbackResult.error) {
      setError('Unable to load attempt details.');
      setLoading(false);
      return;
    }

    const attemptData = (attemptResult.data as AttemptDetail | null) ?? null;
    if (!attemptData) {
      setError('Attempt not found.');
      setLoading(false);
      return;
    }

    const activityRaw = attemptData.activities;
    const activity = Array.isArray(activityRaw) ? activityRaw[0] : activityRaw;
    const simVersionRaw = activity?.simulation_versions;
    const simVersion = Array.isArray(simVersionRaw) ? simVersionRaw[0] : simVersionRaw;
    const simulationRaw = simVersion?.simulations;
    const simulation = Array.isArray(simulationRaw) ? simulationRaw[0] : simulationRaw;

    const normalizedAttempt: AttemptDetail = {
      ...attemptData,
      activities: activity
        ? {
            ...activity,
            simulation_versions: simVersion ? { ...simVersion, simulations: simulation ?? null } : null,
          }
        : null,
    };

    setAttempt(normalizedAttempt);

    const responses = (responsesResult.data ?? []) as AttemptResponseRow[];
    const primary = responses.find((row) => row.response_key === 'primary');
    const resolvedPrimary =
      primary?.response_text ?? (primary?.response_json as { text?: string } | null)?.text ?? '';
    setPrimaryResponse(resolvedPrimary ?? '');

    setEvents((eventsResult.data ?? []) as AttemptEventRow[]);

    const existingFeedback = (feedbackResult.data as AttemptFeedbackRow | null) ?? null;
    const existingFeedbackText =
      (existingFeedback?.feedback as { comments?: string; text?: string } | null)?.comments ??
      (existingFeedback?.feedback as { text?: string } | null)?.text ??
      '';
    setFeedbackText(existingFeedbackText ?? '');

    setLoading(false);
  }

  async function handleSaveFeedback() {
    if (!attemptId) {
      setError('Attempt id is required.');
      return;
    }
    if (!session?.user) {
      setError('You must be signed in to leave feedback.');
      return;
    }

    setSavingFeedback(true);
    setFeedbackMessage(null);
    const { error: saveError } = await saveAttemptFeedback({
      attemptId,
      createdBy: session.user.id,
      feedback: { comments: feedbackText },
    });

    if (saveError) {
      setError('Unable to save feedback.');
    } else {
      setError(null);
      setFeedbackMessage('Feedback saved.');
    }
    setSavingFeedback(false);
  }

  const activity = attempt?.activities;
  const resolvedActivity = Array.isArray(activity) ? activity[0] : activity;
  const simulationTitle = resolvedActivity?.simulation_versions?.simulations?.title ?? 'Unknown simulation';
  const simulationSlug = resolvedActivity?.simulation_versions?.simulations?.slug ?? '—';
  const version = resolvedActivity?.simulation_versions?.version ?? '—';


  return (
    <div className="page">
      <div className="card" style={{ maxWidth: '960px', width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <div>
            <p style={{ margin: '0 0 4px' }}>
              <Link to="/instructor" style={{ color: '#0ea5e9' }}>
                ← Back to submissions
              </Link>
            </p>
            <h1 style={{ margin: 0 }}>Attempt review</h1>
            <p style={{ margin: 0, color: '#475569' }}>
              {simulationTitle} (v{version}) • {simulationSlug}
            </p>
          </div>
        </div>

        {loading && <p>Loading attempt…</p>}
        {error && <div className="form__error">{error}</div>}

        {!loading && !error && attempt && (
          <>
            <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: '#475569' }}>Student</div>
                <div style={{ fontWeight: 600 }}>{attempt.student_id}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#475569' }}>Status</div>
                <div style={{ fontWeight: 600 }}>{attempt.status}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#475569' }}>Attempt</div>
                <div style={{ fontWeight: 600 }}>#{attempt.attempt_no}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#475569' }}>Submitted</div>
                <div style={{ fontWeight: 600 }}>
                  {attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleString() : '—'}
                </div>
              </div>
              <div>

                <div style={{ fontSize: 12, color: '#475569' }}>Simulation slug</div>
                <div style={{ fontWeight: 600 }}>{simulationSlug}</div>

              </div>
            </section>

            <section>
              <h2 style={{ margin: '0 0 8px' }}>Primary response</h2>
              <div
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  padding: 12,
                  background: '#f8fafc',
                  minHeight: 96,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {primaryResponse || <span style={{ color: '#94a3b8' }}>No response saved.</span>}
              </div>
            </section>

            <section>
              <h2 style={{ margin: '0 0 8px' }}>Event log</h2>
              {events.length === 0 ? (
                <p style={{ margin: 0, color: '#475569' }}>No events recorded.</p>
              ) : (
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ padding: '8px 6px' }}>Time</th>
                        <th style={{ padding: '8px 6px' }}>Event</th>
                        <th style={{ padding: '8px 6px' }}>Payload</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.map((event) => (
                        <tr key={event.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 6px', color: '#475569', whiteSpace: 'nowrap' }}>
                            {event.created_at ? new Date(event.created_at).toLocaleString() : '—'}
                          </td>
                          <td style={{ padding: '8px 6px', fontWeight: 600 }}>{event.event_type}</td>
                          <td style={{ padding: '8px 6px', color: '#475569', fontSize: 14 }}>
                            <code>{JSON.stringify(event.payload)}</code>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section>
              <h2 style={{ margin: '0 0 8px' }}>Feedback</h2>
              <p style={{ margin: '0 0 8px', color: '#475569' }}>
                Save written feedback for this attempt. Entries are stored as JSON.
              </p>
              <textarea
                className="form__input"
                rows={4}
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Share strengths, areas to improve, or next steps"
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                <button className="form__submit" onClick={handleSaveFeedback} disabled={savingFeedback}>
                  {savingFeedback ? 'Saving…' : 'Save feedback'}
                </button>
                {feedbackMessage && <span style={{ color: '#16a34a', fontWeight: 600 }}>{feedbackMessage}</span>}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
