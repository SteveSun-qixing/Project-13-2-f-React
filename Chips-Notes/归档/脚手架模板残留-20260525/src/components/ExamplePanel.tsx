import React from "react";

interface ExamplePanelProps {
  title: string;
}

export function ExamplePanel({ title }: ExamplePanelProps) {
  return (
    <section
      data-chips-app="app-standard.example-panel"
      style={{
        padding: 16,
        borderRadius: 8,
        border: "1px solid var(--chips-border-subtle, rgba(17,17,17,0.08))",
      }}
    >
      <h2 style={{ fontSize: 14, marginBottom: 8 }}>{title}</h2>
      <p style={{ fontSize: 12, marginBottom: 12 }}>
        这是由脚手架生成的示例面板组件，你可以在此基础上扩展业务 UI。
      </p>
      <button type="button">了解更多</button>
    </section>
  );
}

