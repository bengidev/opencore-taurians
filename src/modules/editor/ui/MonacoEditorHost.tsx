import Editor from "@monaco-editor/react";
import { useThemeStore } from "../../onboarding/state/onboardingThemeStore";
import { editorLanguageFromPath } from "../domain/editorLanguage";
import { useEditorStore } from "../state/editorStore";
import "./monacoSetup";

export function MonacoEditorHost() {
  const path = useEditorStore((s) => s.path);
  const content = useEditorStore((s) => s.content);
  const setContentFromEditor = useEditorStore((s) => s.setContentFromEditor);
  const mode = useThemeStore((s) => s.mode);
  const theme = mode === "dark" ? "vs-dark" : "vs";

  if (!path) {
    return null;
  }

  const language = editorLanguageFromPath(path);

  return (
    <Editor
      key={path}
      path={path}
      className="min-h-0 flex-1"
      height="100%"
      language={language}
      theme={theme}
      value={content}
      onChange={(value) => setContentFromEditor(value ?? "")}
      options={{
        minimap: { enabled: false },
        automaticLayout: true,
        fontSize: 13,
      }}
    />
  );
}
