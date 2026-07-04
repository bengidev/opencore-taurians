import { useState } from "react";
import {
  OnboardingScreen,
  ThemeProvider,
} from "./modules/onboarding";
import "./App.css";

function App() {
  const [entered, setEntered] = useState(false);

  return (
    <ThemeProvider>
      {entered ? (
        <main className="workspace-placeholder">
          <p className="workspace-placeholder__label">OpenCore workspace</p>
          <p className="workspace-placeholder__hint">
            Main workspace shell will connect here.
          </p>
        </main>
      ) : (
        <OnboardingScreen onEnter={() => setEntered(true)} />
      )}
    </ThemeProvider>
  );
}

export default App;
