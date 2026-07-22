import { ThemeProvider } from "./modules/onboarding";
import { SessionRoot } from "./modules/session";
import { useDisableBrowserContextMenu } from "./lib/disableBrowserContextMenu";
import { useEditorFileMenu } from "./modules/editor/ui/useEditorFileMenu";

function App() {
  useDisableBrowserContextMenu();
  useEditorFileMenu();

  return (
    <ThemeProvider>
      <SessionRoot />
    </ThemeProvider>
  );
}

export default App;
