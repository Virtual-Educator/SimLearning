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
   - A bottom action bar spans the width of the app, showing a Draft status pill and disabled buttons for Save draft, Download attempt, and Submit.
   - The Utility panel includes Task, Tools, and Response tabs (with other placeholder tabs) and can be collapsed or expanded using the button in the header or the `Ctrl+Shift+U` keyboard shortcut. The chosen state persists after a refresh (localStorage).
   - When the Utility panel is collapsed, a visible handle remains to reopen it.

4. **Scene interactions (image-based)**
   - The Scene area uses the ImageScene component to display the manifest image.
   - Zoom controls are available: buttons for "+" and "-", mouse wheel zooming, and a "Reset view" button that restores the default pan/zoom.
   - The scene pans when the user click-drags inside the image area.

5. **Tools tab and overlays**
   - The Utility panel shows a Tools tab alongside Task. When the manifest enables a tool, the corresponding toggle appears:
     - Grid overlay toggle (when `manifest.tools.grid` is true) shows a grid with column labels A–E and row labels 1–4 over the image.
     - Pin mode toggle (when `manifest.tools.pins` is true) allows placing numbered pins by clicking the scene; clicking a pin removes it. Pins stay aligned at any zoom level because they are stored with normalized coordinates.

6. **Attempt event log**
   - The attempt log utility exposes `logEvent(type, payload?)` and stores events in memory.
   - Scene and tools actions append events for: `grid_toggled`, `pin_mode_toggled`, `pin_added`, `pin_removed`, `view_reset`, `zoom_changed`, and `pan_changed`.

7. **Authentication flow**
   - Visiting `/player`, `/instructor`, or `/admin` when not signed in redirects to the `/login` page.
   - Submitting valid Supabase email/password credentials on `/login` signs the user in and navigates to `/player` while preserving the existing simulation UI behavior.
   - The TopBar shows a "Sign out" control when authenticated; clicking it ends the Supabase session and returns the user to the login screen.

8. **Role-based routing**
   - After login, the app loads (or creates) a `profiles` row for the authenticated user. Missing rows are inserted with the `student` role.
   - `/player` is accessible to any authenticated user.
   - `/instructor` is only accessible to users with role `instructor` or `admin`; other authenticated users are redirected back to `/player`.
   - `/admin` is only accessible to users with role `admin`; other authenticated users are redirected back to `/player`.
   - An authenticated admin can reach `/admin`, and an authenticated instructor can reach `/instructor`.
   - An authenticated student is blocked from `/admin`.
   - Navigating directly to `/admin` while authentication or profile data is still loading shows a loading state instead of redirecting.
