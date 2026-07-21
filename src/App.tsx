import { ThemeProvider } from "./modules/onboarding";
import { SessionRoot } from "./modules/session";
import { useDisableBrowserContextMenu } from "./lib/disableBrowserContextMenu";

function App() {
  useDisableBrowserContextMenu();

  return (
    <ThemeProvider>
      <SessionRoot />
    </ThemeProvider>
  );
}

export default App;
