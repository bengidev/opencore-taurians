import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TerminalCard } from "./TerminalCard";

describe("TerminalCard", () => {
  it("shows placeholder when no trunk is active", () => {
    render(<TerminalCard />);
    expect(
      screen.getByText(/Select a project to open a terminal/i),
    ).toBeInTheDocument();
  });
});
