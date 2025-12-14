# Product Spec

## Product name
Simulation Player Platform

## Goal
Build a reusable simulation player shell (UI + logging) that can load different simulation packages and capture student responses using voice plus transcript, with a text-only fallback. Initial simulation type is an image-based crime scene activity.

## Primary users
- Students: complete a simulation attempt and submit evidence
- Instructors: review attempts and export grades and feedback for manual entry into the LMS

## Deployment target
- Front end: Vercel
- Backend: Supabase (Auth, Postgres, Storage, Row Level Security)

## LMS policy
- No LTI 1.3 (out of scope due to cost)
- No automatic grade return
- Instructors export grades and feedback for manual insertion into the LMS

## Current implementation status
This repository currently includes:
- Supabase authentication and role-based routing (student, instructor, admin)
- A player shell with a collapsible utility panel and tabs
- Image scene with pan/zoom, grid toggle, and pins UI
- Supabase-backed persistence for attempts, responses, events, and feedback
- Instructor attempt review UI and feedback saving

Not yet implemented (required for Student Capture MVP):
- Voice recording and audio storage
- Speech-to-text transcript capture
- Transcript edit event tracking
- Pins persistence and inclusion in attempt export
- Enforcement of manifest submission requirements (min transcript chars, min pins)
- Full attempt lifecycle event coverage (attempt_started, draft_saved, attempt_submitted, tab_changed, transcript_updated)

## Non-goals
- Multi-scene branching story engine (until later phases)
- AI role-play NPC chat
- Automated grading

## Core concepts
- Simulation: a reusable activity definition identified by a slug
- Simulation version: a versioned manifest that configures the player
- Attempt: a student work session tied to a simulation version
- Responses: attempt state stored as key-value records (text and JSON)
- Events: append-only log entries of what happened during an attempt
- Feedback: instructor feedback stored per attempt
- Export: a portable JSON record of an attempt, used for audit and sharing

## Simulation configuration
Source of truth:
- Manifest is stored in Supabase as `simulation_versions.manifest`
- Asset URLs are resolved using the manifest plus a version-specific asset base (for example `package_path` or a known public route)

Manifest responsibilities:
- Title and description
- Scene configuration (image path for the crime scene MVP)
- Task instructions and checklist
- Enabled tools (grid, pins)
- Response settings (voice plus transcript, text-only, max recording length)
- Submission requirements (minimum transcript length, minimum pins)
- Rubric definition (used in instructor workflow)

## Player shell UI
Layout:
- Left: scene area
- Right: utility panel with tabs

Utility panel:
- Tabs: Task, Tools, Response, Notes, Resources, Settings
- Collapsible (expand/collapse button)
- Remember collapse state in localStorage
- Keyboard shortcut toggles collapse state

## Image scene module
- Load a scene image from simulation assets
- Pan and zoom
- Optional grid overlay (toggle)
- Pins:
  - Toggle pin placement mode
  - Click to place numbered pins
  - Click a pin to remove it

Requirement:
- Pins must be persisted to the server and included in the attempt export

## Response module
Student capture goal:
- Default mode is voice plus transcript with a text-only fallback

Phase B requirements:
- Audio recording controls: start, stop, playback, re-record
- Speech-to-text transcript capture
- Editable transcript
- Track transcript edits as events
- Text-only option remains available at all times
- If speech-to-text fails, student can still submit a typed transcript

## Attempt model and logging
Each attempt collects:
- Attempt metadata: simulation_version_id, user_id, started_at, submitted_at, status
- Responses: transcript, pins, audio reference, notes (as needed)
- Event log: type plus payload JSON, ordered by timestamp

Minimum event types:
- attempt_started
- panel_toggled
- tab_changed
- grid_toggled
- pin_mode_toggled
- pin_added
- pin_removed
- recording_started
- recording_stopped
- transcript_updated
- draft_saved
- attempt_submitted

Persistence rules:
- Attempts and responses are stored in Supabase during the attempt
- Draft saves update server state and append events
- On submit:
  - Validate submission requirements from the manifest
  - Mark the attempt submitted and lock editing
  - Generate an attempt JSON export for download (built from server data)

Submission requirements enforcement:
- If `min_transcript_chars` is set, prevent submit until transcript meets the minimum
- If `min_pins` is set, prevent submit until pin count meets the minimum

Export requirement (all phases):
- Attempt JSON export must include attempt metadata, responses (including pins), and ordered events

## Phases

### Phase A: Hosted foundation
Goal:
- Provide a working hosted system with identity, persistence, and basic review plumbing

Scope:
- Supabase Auth and role routing
- Admin creation of simulations and versions (manifest stored in database)
- Player shell UI and image scene basics
- Server persistence for attempts, responses, events
- Instructor review UI and feedback storage (no exports required yet)

Exit criteria:
- A student can start an attempt and submit a basic text response
- An instructor can view the attempt and save feedback

### Phase B: Student capture MVP (voice plus transcript)
Goal:
- Deliver the core student experience for evidence capture

Scope:
- MediaRecorder audio capture, playback, and re-record
- Speech-to-text transcript capture with text-only fallback
- Transcript editing with transcript_updated event tracking
- Persist pins to server and include in export
- Enforce submission requirements from the manifest
- Complete attempt lifecycle event coverage
- Audio stored in Supabase Storage with restricted access

Exit criteria:
- Students can submit a voice-based attempt (or text-only) that includes transcript, pins, and events
- Attempt export is complete and reproducible from server records

### Phase C: Instructor exports for manual LMS entry
Goal:
- Support instructor workflows without LMS integration

Scope:
- Exports:
  - Gradebook CSV export per course and simulation
  - Feedback export (CSV or JSON)
  - Transcript export (HTML or CSV)
- Optional rubric scoring UI if rubric definition is present in the manifest

Exit criteria:
- Instructors can export grades and feedback in formats usable for manual LMS entry

### Phase D: Resubmissions and close rules
Goal:
- Allow multiple submissions until a due date or until an instructor closes the activity

Scope:
- Define an assignment instance concept (course activity with opens, due, close, resubmission rules)
- Enforce rules server-side and in RLS
- Define grading policy (latest only, best score, instructor selects)

Exit criteria:
- Resubmission policy is enforced consistently and exports reflect the chosen grading policy

## Data model expectations (Supabase)
Core tables in use:
- simulations, simulation_versions
- attempts, attempt_events, attempt_responses, attempt_feedback
- courses, course_simulations, course_enrollments, course_instructors

Response key conventions (recommended):
- transcript: response_text holds final transcript, response_json holds metadata
- pins: response_json holds array of pins
- audio: response_json holds storage path and metadata
- notes: response_text holds notes

Constraint expectations:
- `attempt_responses` must enforce uniqueness by (attempt_id, response_key) so drafts can upsert safely

## Accessibility and quality expectations
- Keyboard reachable controls for primary actions
- Clear focus states
- Text-only option always available
- Graceful microphone permission handling with clear fallback paths
