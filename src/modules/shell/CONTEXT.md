# Shell

Primary workspace chrome after onboarding: center column (main card tabs, main card stack, bottom panel) and side panels.

## Language

**Shell**:
The full workspace layout — center column, left/right side panels, and the main card area. Not the onboarding screen or workspace picker popup.
_Avoid_: Main app, IDE chrome, workspace frame (when referring to this layout)

**Main Card**:
One of the three always-mounted center views: chat, terminal, or editor. Only one is visible at a time; inactive cards stay mounted so local UI state is preserved.
_Avoid_: Tab, pane, view mode (when referring to chat/terminal/editor specifically)

**Left Panel**:
The bordered sidebar on the left of the main card area. Can be toggled independently of the right panel.
_Avoid_: Sidebar, navigator, file tree (until those features exist)

**Right Panel**:
The bordered sidebar on the right of the main card area. Can be toggled independently of the left panel.
_Avoid_: Inspector, properties pane, secondary sidebar

**Bottom Panel**:
The bordered strip at the bottom of the **center column** — reserved status area. Visibility is controlled from settings.
_Avoid_: Footer bar, status dock

**Settings**:
Full-page preferences overlay opened from the left panel header (or the tab row when the left panel is closed). Theme and panel layout controls live here.
_Avoid_: Settings sheet, settings drawer, preferences modal

**Main Card Tabs**:
The tab row in the unified top chrome with main-card switches (chat / terminal / editor). When a side panel is closed, its toggle (and settings, for the left side) appear at the leading/trailing edges of this row.
_Avoid_: Toolbar, tab bar, navigation header
