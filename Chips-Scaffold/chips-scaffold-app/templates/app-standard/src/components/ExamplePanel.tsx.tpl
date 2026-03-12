import React from "react";
import { ChipsButton } from "@chips/component-library";

interface ExamplePanelProps {
  title: string;
  description: string;
  actionLabel: string;
}

export function ExamplePanel({ title, description, actionLabel }: ExamplePanelProps) {
  return (
    <section
      data-chips-app="app-standard.example-panel"
      style={{
        padding: 16,
        borderRadius: "var(--chips-sys-radius-md, 8px)",
        border: "1px solid var(--chips-border-subtle, rgba(17,17,17,0.08))",
      }}
    >
      <h2 style={{ fontSize: 14, marginBottom: 8 }}>{title}</h2>
      <p style={{ fontSize: 12, marginBottom: 12 }}>{description}</p>
      <ChipsButton variant="secondary">{actionLabel}</ChipsButton>
    </section>
  );
}
