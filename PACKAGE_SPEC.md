# Simulation Package Spec (MVP)

Folder layout
/simulations/<simulation_id>/
  manifest.json
  /assets/
    scene.jpg
    (optional) reference-1.pdf
    (optional) reference-2.png

manifest.json schema (MVP)
{
  "id": "csi-001",
  "version": "1.0.0",
  "title": "Crime Scene Observation",
  "description": "Identify unmarked items and propose next actions.",
  "scene": {
    "type": "image",
    "src": "assets/scene.jpg",
    "alt": "Crime scene image"
  },
  "task": {
    "prompt": "Identify three unmarked items. For each: what you saw, where it is, why it matters, and what you would do next.",
    "checklist": [
      "3 items minimum",
      "Location references (pins or grid)",
      "Relevance and next action"
    ]
  },
  "tools": {
    "pins": true,
    "grid": true
  },
  "response": {
    "mode": "voice_plus_transcript",
    "allow_text_only": true,
    "max_record_seconds": 180,
    "min_transcript_chars": 40,
    "min_pins": 0
  },
  "resources": [
    { "title": "Evidence Handling Quick Guide", "type": "pdf", "src": "assets/reference-1.pdf" }
  ]
}

Behavior rules
- The player must not hardcode simulation content.
- The player must render prompt and checklist from manifest.
- The player must load the scene asset based on manifest.scene.src.
- The player must enable pins and grid only if tools.pins or tools.grid are true.
- The player must enforce response.min_transcript_chars on submission.
- If response.min_pins > 0, the player must enforce it on submission.
