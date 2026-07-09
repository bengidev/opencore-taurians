import { ThemeProvider } from "./modules/onboarding";
import { SessionRoot } from "./modules/session";

function App() {
  return (
    <ThemeProvider>
      <SessionRoot />
    </ThemeProvider>
  );
}

export default App;
