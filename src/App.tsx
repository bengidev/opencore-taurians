import { useState } from "react";
import {
  OnboardingScreen,
  ThemeProvider,
} from "./modules/onboarding";

function App() {
  const [entered, setEntered] = useState(false);

  return (
    <ThemeProvider>
      {entered ? (
        <main className="flex min-h-dvh flex-col items-center justify-center gap-2 bg-background p-6 text-center text-foreground">
          <p className="m-0 text-lg font-semibold">OpenCore workspace</p>
          <p className="m-0 text-sm text-muted-foreground">
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
