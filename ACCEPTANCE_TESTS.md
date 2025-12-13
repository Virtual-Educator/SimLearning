# Acceptance Tests (MVP foundation)

1. **Install and start**
   - Run `npm install` to install dependencies.
   - Run `npm run dev` and open the served URL. The console should not show runtime errors.

2. **Manifest loading**
   - The app requests `/simulations/csi-001/manifest.json` from the public folder at runtime.
   - If the manifest loads, the top bar shows the manifest title and description, the scene image renders in the left pane, and the Task tab shows the prompt plus checklist items.
   - If the manifest is missing or invalid, a user-friendly error message appears in both the scene area and Task tab instead of breaking the app.

3. **Layout and controls**
   - The UI displays a two-pane layout: Scene on the left and Utility panel on the right.
   - The Utility panel can be collapsed or expanded using the button in the header or the `Ctrl+Shift+U` keyboard shortcut. The chosen state persists after a refresh (localStorage).

4. **Task tab**
   - The Utility panel shows tabs. Only the Task tab is active in this build.
   - The Task tab displays the manifest task prompt and checklist.
