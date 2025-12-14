import { supabase } from './supabaseClient';

export type Simulation = {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type SimulationVersionStatus = 'draft' | 'published' | 'archived';

export type SimulationVersion = {
  id: string;
  simulation_id: string;
  version: string;
  status: SimulationVersionStatus;
  manifest: unknown;
  created_at?: string;
  published_at?: string | null;
};

export type StudentAssignedSimulation = {
  course_id: string;
  course_code: string;
  course_title: string | null;
  simulation_id: string;
  simulation_slug: string;
  simulation_title: string;
  simulation_description: string | null;
  version_id: string;
  version: string;
  manifest: unknown;
};

export type SimulationWithVersions = Simulation & {
  simulation_versions: SimulationVersion[];
};

export type PublishedSimulationVersion = SimulationVersion & {
  simulations: Simulation;
};

export type Course = {
  id: string;
  course_code: string;
  subject: string;
  number: string;
  title?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type Term = {
  id: string;
  term_code: string;
  year?: number | null;
  starts_at?: string | null;
  ends_at?: string | null;
};

export type CourseOffering = {
  id: string;
  course_id: string;
  term_id: string;
  section: string;
  offering_code: string;
  created_at?: string;
  updated_at?: string;
  courses?: Course | null;
  terms?: Term | null;
};

export type Activity = {
  id: string;
  offering_id: string;
  simulation_version_id: string;
  title: string;
  opens_at: string | null;
  due_at: string | null;
  closed_at: string | null;
  max_submissions: number | null;
  allow_resubmissions: boolean;
  course_offerings?: CourseOffering | null;
  simulation_versions?: (SimulationVersion & { simulations?: Simulation | null }) | null;
};

export type AttemptWithActivity = {
  id: string;
  attempt_no: number;
  submitted_at: string | null;
  student_id: string;
  activities: Pick<Activity, 'id' | 'title'> & {
    course_offerings: (Pick<CourseOffering, 'offering_code'> & {
      courses?: Pick<Course, 'course_code' | 'title'> | null;
      terms?: Pick<Term, 'term_code'> | null;
    }) | null;
    simulation_versions: (Pick<SimulationVersion, 'version'> & {
      simulations?: Pick<Simulation, 'id' | 'title' | 'slug'> | null;
    }) | null;
  } | null;
};

export type AttemptDetail = {
  id: string;
  student_id: string;
  status: string;
  attempt_no: number;
  submitted_at: string | null;
  activities: Pick<Activity, 'id' | 'title'> & {
    course_offerings: (Pick<CourseOffering, 'offering_code'> & {
      courses?: Pick<Course, 'course_code' | 'title'> | null;
    }) | null;
    simulation_versions: (Pick<SimulationVersion, 'version'> & {
      simulations?: Pick<Simulation, 'id' | 'title'> | null;
    }) | null;
  } | null;
};

export type AttemptResponseRow = {
  response_key: string;
  response_text: string | null;
  response_json: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
};

export type AttemptEventRow = {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string | null;
};

export type AttemptFeedbackRow = {
  id: string;
  attempt_id: string;
  created_by: string;
  feedback: Record<string, unknown>;
  created_at: string | null;
};

export async function fetchSimulations() {
  return supabase
    .from('simulations')
    .select('id, title, slug, description, created_at, updated_at')
    .order('updated_at', { ascending: false });
}

export async function createSimulation(input: {
  title: string;
  slug: string;
  description?: string;
}) {
  return supabase
    .from('simulations')
    .insert({ ...input })
    .select('id, title, slug, description, created_at, updated_at')
    .single();
}

export async function fetchCourses() {
  return supabase
    .from('courses')
    .select('id, course_code, subject, number, title, created_at, updated_at')
    .order('course_code', { ascending: true });
}

export async function createCourse(input: { course_code: string; subject: string; number: string; title?: string | null }) {
  return supabase
    .from('courses')
    .insert({ ...input })
    .select('id, course_code, subject, number, title, created_at, updated_at')
    .single();
}

export async function fetchTerms() {
  return supabase
    .from('terms')
    .select('id, term_code, year, starts_at, ends_at, created_at, updated_at')
    .order('term_code', { ascending: true });
}

export async function createTerm(input: { term_code: string; year?: number | null; starts_at?: string | null; ends_at?: string | null }) {
  return supabase
    .from('terms')
    .insert({ ...input })
    .select('id, term_code, year, starts_at, ends_at, created_at, updated_at')
    .single();
}

export async function fetchCourseOfferings() {
  return supabase
    .from('course_offerings')
    .select(
      `id, course_id, term_id, section, offering_code, created_at, updated_at,
       courses (id, course_code, subject, number, title),
       terms (id, term_code, year)`
    )
    .order('offering_code', { ascending: true });
}

export async function createCourseOffering(input: { course_id: string; term_id: string; section: string; offering_code: string }) {
  return supabase
    .from('course_offerings')
    .insert({ ...input })
    .select('id, course_id, term_id, section, offering_code, created_at, updated_at')
    .single();
}

export async function createActivity(input: {
  offering_id: string;
  simulation_version_id: string;
  title: string;
  opens_at?: string | null;
  due_at?: string | null;
  max_submissions?: number | null;
  allow_resubmissions?: boolean;
}) {
  return supabase
    .from('activities')
    .insert({ ...input })
    .select('id, offering_id, simulation_version_id, title, opens_at, due_at, max_submissions, allow_resubmissions')
    .single();
}

export async function fetchSimulationWithVersions(simulationId: string) {
  return supabase
    .from('simulations')
    .select(
      `id, title, slug, description, created_at, updated_at,
       simulation_versions(id, simulation_id, version, status, manifest, created_at, published_at)`
    )
    .eq('id', simulationId)
    .single();
}

export async function createSimulationVersion(
  simulationId: string,
  input: { version: string; manifest: unknown }
) {
  return supabase
    .from('simulation_versions')
    .insert({ ...input, simulation_id: simulationId, status: 'draft' })
    .select('id, simulation_id, version, status, manifest, created_at, published_at')
    .single();
}

export async function publishSimulationVersion(simulationId: string, versionId: string) {
  const now = new Date().toISOString();

  const archiveResult = await supabase
    .from('simulation_versions')
    .update({ status: 'archived' })
    .eq('simulation_id', simulationId)
    .eq('status', 'published');

  if (archiveResult.error) {
    return archiveResult;
  }

  return supabase
    .from('simulation_versions')
    .update({ status: 'published', published_at: now })
    .eq('id', versionId)
    .select('id, simulation_id, version, status, manifest, created_at, published_at')
    .single();
}

export async function fetchPublishedSimulationVersions() {
  return supabase
    .from('simulation_versions')
    .select('id, simulation_id, version, status, manifest, created_at, published_at, simulations (id, title, slug, description)')
    .eq('status', 'published')
    .order('created_at', { ascending: false });
}

export async function fetchPublishedSimulationVersionBySimulationId(simulationId: string) {
  return supabase
    .from('simulation_versions')
    .select(
      'id, simulation_id, version, status, manifest, created_at, published_at, simulations (id, title, slug, description)'
    )
    .eq('simulation_id', simulationId)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle();
}

export async function getStudentAssignedSimulations() {
  const { data: userData } = await supabase.auth.getUser();
  const studentId = userData?.user?.id;

  if (!studentId) {
    return { data: [], error: null };
  }

  const { data: enrollmentRows, error: enrollmentError } = await supabase
    .from('course_enrollments')
    .select(
      `course_id,
       courses (
         id,
         course_code,
         title,
         course_simulations (
           simulation_id,
           pinned_version_id,
           simulations (id, slug, title, description),
           pinned_version:simulation_versions!course_simulations_pinned_version_id_fkey (id, version, manifest, published_at, created_at)
         )
       )`
    )
    .eq('student_id', studentId);

  if (enrollmentError) {
    return { data: null, error: enrollmentError };
  }

  const courseSimulationRows: {
    courseId: string;
    courseCode: string;
    courseTitle: string | null;
    courseSimulation: any;
  }[] = [];
  const simulationsNeedingLatest = new Set<string>();

  (enrollmentRows ?? []).forEach((row) => {
    const course = Array.isArray(row.courses) ? row.courses[0] : row.courses;
    const courseId = course?.id ?? row.course_id;
    const courseCode = course?.course_code ?? '';
    const courseTitle = course?.title ?? null;
    const courseSimulations = course?.course_simulations ?? [];
    const normalizedCourseSimulations = Array.isArray(courseSimulations)
      ? courseSimulations
      : [courseSimulations];

    normalizedCourseSimulations.forEach((courseSimulation) => {
      if (!courseSimulation) return;

      courseSimulationRows.push({
        courseId,
        courseCode,
        courseTitle,
        courseSimulation,
      });

      if (!courseSimulation.pinned_version_id) {
        simulationsNeedingLatest.add(courseSimulation.simulation_id);
      }
    });
  });

  const latestPublishedVersions: Record<string, { id: string; version: string; manifest: unknown }> = {};

  if (simulationsNeedingLatest.size > 0) {
    const { data: versionRows, error: versionError } = await supabase
      .from('simulation_versions')
      .select('id, simulation_id, version, manifest, published_at, created_at')
      .eq('status', 'published')
      .in('simulation_id', Array.from(simulationsNeedingLatest))
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (versionError) {
      return { data: null, error: versionError };
    }

    (versionRows ?? []).forEach((version) => {
      if (!latestPublishedVersions[version.simulation_id]) {
        latestPublishedVersions[version.simulation_id] = {
          id: version.id,
          version: version.version,
          manifest: version.manifest,
        };
      }
    });
  }

  const assignments: StudentAssignedSimulation[] = courseSimulationRows
    .map(({ courseId, courseCode, courseTitle, courseSimulation }) => {
      const simulationRaw = courseSimulation.simulations;
      const simulation = Array.isArray(simulationRaw) ? simulationRaw[0] : simulationRaw;
      const pinnedVersionRaw = courseSimulation.pinned_version;
      const pinnedVersion = Array.isArray(pinnedVersionRaw) ? pinnedVersionRaw[0] : pinnedVersionRaw;
      const resolvedVersion = pinnedVersion ?? latestPublishedVersions[courseSimulation.simulation_id];

      if (!simulation || !resolvedVersion) return null;

      return {
        course_id: courseId,
        course_code: courseCode,
        course_title: courseTitle,
        simulation_id: simulation.id,
        simulation_slug: simulation.slug,
        simulation_title: simulation.title,
        simulation_description: simulation.description ?? null,
        version_id: resolvedVersion.id,
        version: resolvedVersion.version,
        manifest: resolvedVersion.manifest,
      } satisfies StudentAssignedSimulation;
    })
    .filter(Boolean) as StudentAssignedSimulation[];

  return { data: assignments, error: null };
}

export async function fetchSubmittedAttempts() {
  return supabase
    .from('attempts')
    .select(
      `id, attempt_no, submitted_at, student_id,
       activities (
         id, title,
         course_offerings (offering_code, courses (id, course_code, title)),
         simulation_versions (version, simulations (id, title, slug))
       )`
    )
    .eq('status', 'submitted')
    .order('submitted_at', { ascending: false });
}

export async function fetchAttemptDetail(attemptId: string) {
  return supabase
    .from('attempts')
    .select(
      `id, student_id, status, attempt_no, submitted_at,
       activities (
         id, title,
         course_offerings (offering_code, courses (id, course_code, title)),
         simulation_versions (version, simulations (id, title))
       )`
    )
    .eq('id', attemptId)
    .maybeSingle();
}

export async function fetchAttemptResponsesByAttempt(attemptId: string) {
  return supabase
    .from('attempt_responses')
    .select('response_key, response_text, response_json, created_at, updated_at')
    .eq('attempt_id', attemptId);
}

export async function fetchAttemptEventsByAttempt(attemptId: string) {
  return supabase
    .from('attempt_events')
    .select('id, event_type, payload, created_at')
    .eq('attempt_id', attemptId)
    .order('created_at', { ascending: true });
}

export async function fetchAttemptFeedback(attemptId: string) {
  return supabase
    .from('attempt_feedback')
    .select('id, attempt_id, created_by, feedback, created_at')
    .eq('attempt_id', attemptId)
    .maybeSingle();
}

export async function saveAttemptFeedback(input: {
  attemptId: string;
  createdBy: string;
  feedback: Record<string, unknown>;
}) {
  return supabase
    .from('attempt_feedback')
    .upsert(
      { attempt_id: input.attemptId, created_by: input.createdBy, feedback: input.feedback },
      { onConflict: 'attempt_id' }
    )
    .select('id, attempt_id, created_by, feedback, created_at')
    .single();
}
