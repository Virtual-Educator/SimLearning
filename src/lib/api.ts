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
  code: string;
  term?: string | null;
  title?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type Activity = {
  id: string;
  simulation_version_id: string;
  title: string;
  opens_at: string | null;
  due_at: string | null;
  closed_at: string | null;
  max_submissions: number | null;
  allow_resubmissions: boolean;
  simulation_versions?: (SimulationVersion & { simulations?: Simulation | null }) | null;
};

export type AttemptWithSimulation = {
  id: string;
  attempt_no: number;
  status: string;
  submitted_at: string | null;
  student_id: string;
  simulation_version_id: string;
  simulation_versions: (Pick<SimulationVersion, 'id' | 'simulation_id' | 'version' | 'manifest'> & {
    simulations?: Pick<Simulation, 'id' | 'title' | 'slug'> | null;
  }) | null;
};

export type AttemptDetail = {
  id: string;
  student_id: string;
  status: string;
  attempt_no: number;
  submitted_at: string | null;
  simulation_version_id: string;
  simulation_versions: (Pick<SimulationVersion, 'id' | 'simulation_id' | 'version' | 'manifest'> & {
    simulations?: Pick<Simulation, 'id' | 'title' | 'slug'> | null;
  }) | null;
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
    .select('id, code, term, title, created_at, updated_at')
    .order('code', { ascending: true });
}

export async function createCourse(input: { code: string; title?: string | null; term?: string | null }) {
  return supabase
    .from('courses')
    .insert({ ...input })
    .select('id, code, term, title, created_at, updated_at')
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
         code,
         term,
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
    const courseCode = course?.code ?? '';
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

export async function fetchSubmittedAttempts(instructorId: string) {
  const { data: instructorCourses, error: coursesError } = await supabase
    .from('course_instructors')
    .select('course_id')
    .eq('instructor_id', instructorId);

  if (coursesError) {
    return { data: null, error: coursesError };
  }

  const courseIds = (instructorCourses ?? [])
    .map((row) => row.course_id as string | null)
    .filter((id): id is string => Boolean(id));

  if (courseIds.length === 0) {
    return { data: [], error: null };
  }


  const { data: courseSimulationRows, error: courseSimulationsError } = await supabase
    .from('course_simulations')
    .select(
      `course_id, simulation_id, pinned_version_id,
       pinned_version:simulation_versions!course_simulations_pinned_version_id_fkey (id, simulation_id, version, manifest)`
    )
    .in('course_id', courseIds);

  if (courseSimulationsError) {
    return { data: null, error: courseSimulationsError };
  }

  const simulationIdsNeedingLatest = new Set<string>();
  const allowedVersions: { id: string; version?: string; manifest?: unknown }[] = [];

  (courseSimulationRows ?? []).forEach((row) => {
    if (row.pinned_version_id && row.pinned_version) {
      const pinnedVersion = Array.isArray(row.pinned_version) ? row.pinned_version[0] : row.pinned_version;
      if (pinnedVersion?.id) {
        allowedVersions.push(pinnedVersion as { id: string; version?: string; manifest?: unknown });
      }
    } else if (row.simulation_id) {
      simulationIdsNeedingLatest.add(row.simulation_id as string);
    }
  });

  if (simulationIdsNeedingLatest.size > 0) {
    const { data: latestVersions, error: latestError } = await supabase
      .from('simulation_versions')
      .select('id, simulation_id, version, manifest, published_at, created_at')
      .eq('status', 'published')
      .in('simulation_id', Array.from(simulationIdsNeedingLatest))
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (latestError) {
      return { data: null, error: latestError };
    }

    const latestBySimulation: Record<string, { id: string; version?: string; manifest?: unknown }> = {};
    (latestVersions ?? []).forEach((version) => {
      if (!latestBySimulation[version.simulation_id]) {
        latestBySimulation[version.simulation_id] = {
          id: version.id,
          version: version.version,
          manifest: version.manifest,
        };
      }
    });

    allowedVersions.push(...Object.values(latestBySimulation));
  }

  const allowedVersionIds = Array.from(new Set(allowedVersions.map((v) => v.id)));

  if (allowedVersionIds.length === 0) {
    return { data: [], error: null };
  }

  return supabase
    .from('attempts')
    .select(
      `id, attempt_no, status, submitted_at, student_id, simulation_version_id,
       simulation_versions (
         id, simulation_id, version, manifest,
         simulations (id, title, slug)
       )`
    )
    .eq('status', 'submitted')
    .in('simulation_version_id', allowedVersionIds)
    .order('submitted_at', { ascending: false });
}

export async function fetchAttemptDetail(attemptId: string) {
  return supabase
    .from('attempts')
    .select(
      `id, student_id, status, attempt_no, submitted_at, simulation_version_id,
       simulation_versions (
         id, simulation_id, version, manifest,
         simulations (id, title, slug)
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
