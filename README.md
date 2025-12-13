# SimLearning Player (MVP)

This repo contains a web-based simulation player that runs drop-in simulation packages.

MVP capabilities
- Two-pane layout: scene on the left, utility panel on the right
- Right utility panel can collapse and expand
- Image scene: pan, zoom, grid overlay, pins
- Voice response: record audio, generate transcript, allow transcript edit
- Text-only response option
- Submit creates an attempt record (JSON) that can be downloaded
- Load simulation configuration from a package manifest.json

Local development
1. Install Node.js (LTS)
2. Install dependencies
   - npm install
3. Run the dev server
   - npm run dev

Notes
- Microphone access requires running on https or localhost.
- Speech-to-text support varies by browser. Chrome and Edge are the MVP target.
