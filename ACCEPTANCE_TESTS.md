# Acceptance Tests (MVP foundation)

1. **Install and start**
   - Run `npm install` to install dependencies.
   - Run `npm run dev` and open the served URL. The console should not show runtime errors.

2. **Published manifest loading**
   - Navigating to `/player/simulations/:simulationId` loads the latest published `simulation_versions` row for that simulation.
   - The page reads the `manifest` JSON from that published version and passes it into the player UI. When present, the top bar shows the manifest title and description, the scene image renders in the left pane, and the Task tab shows the prompt plus checklist items.
   - If no published version exists or the manifest JSON is invalid/missing required fields, a user-friendly error message appears in the scene area and Utility panel instead of breaking the app.

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
   - Submitting valid Supabase email/password credentials on `/login` signs the user in and navigates to the appropriate landing page for their role while preserving the existing simulation UI behavior.
   - Admin users land on `/admin` after login.
   - Instructor users land on `/instructor` after login.
   - Student users land on `/player` after login.
   - The TopBar shows a "Sign out" control when authenticated; clicking it ends the Supabase session and returns the user to the login screen.

8. **Role-based routing**
   - After login, the app loads (or creates) a `profiles` row for the authenticated user. Missing rows are inserted with the `student` role.
   - Login succeeds when the profile role is read from `profiles.user_id`.
   - `/player` is accessible to any authenticated user.
   - `/instructor` is only accessible to users with role `instructor` or `admin`; other authenticated users are redirected back to `/player`.
   - `/admin` is only accessible to users with role `admin`; other authenticated users are redirected back to `/player`.
   - An authenticated admin can reach `/admin`, and an authenticated instructor can reach `/instructor`.
   - Once the role is set in `profiles` for a user, an admin can access `/admin`.
   - An authenticated student is blocked from `/admin`.
   - Navigating directly to `/admin` while authentication or profile data is still loading shows a loading state instead of redirecting.

9. **Admin simulation library**
   - `/admin` loads a list of simulations showing title, slug, and last update time along with a refresh control.
   - The "New simulation" form on `/admin` validates slugs to lowercase letters, numbers, and hyphens, and inserts a new row into `public.simulations` with the provided title/slug/description.
   - Clicking a simulation navigates to `/admin/simulations/:simulationId`, showing the simulation metadata and its versions.
   - The detail page allows creating a new draft version with a required version string and required JSON manifest saved to `public.simulation_versions`. Invalid JSON surfaces an inline validation error.
   - Publishing a version marks it `published` with `published_at` set to now and archives any previously published version for the same simulation. Version tables show loading/error/empty states.

10. **Player published simulations**
    - `/player` lists published `simulation_versions` joined with their `simulations` metadata, showing each simulation's title, slug, description, and version alongside refresh/error/empty states.
    - Clicking "Open" on a published simulation navigates to `/player/simulations/:simulationId`, which loads and displays that simulation's published manifest.
