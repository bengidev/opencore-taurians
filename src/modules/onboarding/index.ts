/**
 * Onboarding module — public seam.
 *
 * Callers import from here only. Domain, rendering, and infrastructure
 * details stay internal to this module.
 */
export { OnboardingScreen } from "./ui/onboardingScreen";
export type { OnboardingScreenProps } from "./ui/onboardingScreen";
export { ThemeProvider } from "./ui/onboardingThemeProvider";
export { useTheme } from "./ui/onboardingThemeContext";
export type { ThemeContextValue } from "./ui/onboardingThemeContext";

import "./styles/onboarding.css";
