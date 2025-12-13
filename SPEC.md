# Product Spec (MVP)

Goal
Build a reusable simulation player shell (UI + logging) that can load different simulation packages and capture student responses using voice plus transcript (with text-only fallback). This MVP focuses on a single simulation type: an image-based crime scene activity.

Primary users
- Students: complete a simulation attempt and submit evidence
- Instructors: review attempt outputs (Phase 2)

MVP scope

1. Player shell UI
- Layout:
  - Left: Scene area
  - Right: Utility panel with tabs
- Utility panel:
  - Tabs: Task, Tools, Transcript, Notes, Resources, Settings
  - Collapsible (expand/collapse button)
  - Remember collapse state in localStorage
  - Keyboard shortcut toggles collapse state

2. Image Scene module
- Load a scene image from the simulation package assets
- Pan and zoom
- Optional grid overlay (toggle)
- Pins:
  - Toggle pin placement mode
  - Click to place numbered pins
  - Click a pin to remove it
  - Persist pins in attempt state and attempt export

3. Response module
- Default: voice plus transcript
- Audio recording:
  - Start/stop recording
  - Play back recorded audio
  - Re-record
- Transcript:
  - Show transcript text after recording
  - Allow student to edit transcript
  - Track transcript edit events
- Text-only option:
  - Student can toggle to type instead of speaking
  - Submission requirements apply the same (min length, etc.)

4. Attempt model and logging
- Each attempt collects an event log and submission payload.
- Events (minimum):
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
- Store attempt in memory while running.
- Save draft to localStorage (MVP).
- On submit:
  - Lock the attempt state
  - Generate an attempt JSON file and let the user download it

5. Simulation package loading
- Simulations live under /simulations/<simulation_id>/
- Each simulation has:
  - manifest.json
  - assets folder for images and reference files
- Player reads manifest.json and configures:
  - Title and description
  - Scene type and asset path
  - Task instructions and checklist
  - Enabled tools (grid, pins)
  - Response settings (voice/text, max recording length)
  - Submission requirements (minimum transcript length, minimum pins)

Non-goals (MVP)
- LMS integration
- Authentication, course roster, gradebook export
- Instructor review UI
- Multi-scene branching story engine
- AI role-play NPC chat
- Automated grading

Phase 2 targets (not required for MVP)
- Instructor view with rubric scoring and feedback
- More scene modules: video, dialogue, document, data
- Branching node graph engine
- Server persistence (database + object storage)
- AI tools in practice mode (coaching, summarization)
- LTI 1.3 integration

Quality and accessibility expectations (MVP)
- Keyboard reachable controls for primary actions
- Clear focus states
- Text-only option always available
- If speech-to-text fails, student can still submit typed transcript
