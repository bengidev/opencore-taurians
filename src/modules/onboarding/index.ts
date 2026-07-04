/**
 * Onboarding module — public seam.
 *
 * Callers import from here only. Domain, rendering, and infrastructure
 * details stay internal to this module.
 */
export { OnboardingScreen } from "./ui/OnboardingScreen";
export type { OnboardingScreenProps } from "./ui/OnboardingScreen";
export { ThemeProvider, useTheme } from "./ui/ThemeProvider";

import "./styles/onboarding.css";
