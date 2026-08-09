:root {
  color-scheme: light;

  background-color: var(--chips-sys-color-surface, #ffffff);
  color: var(--chips-sys-color-on-surface, #111111);

  --chips-base-radius-sm: var(--chips-ref-radius-sm, 6px);
  --chips-base-radius-md: var(--chips-ref-radius-md, 10px);
  --chips-base-space-2: var(--chips-ref-space-2, 8px);
  --chips-base-space-3: var(--chips-ref-space-3, 12px);
  --chips-base-space-4: var(--chips-ref-space-4, 16px);
  --chips-base-icon-color: var(--chips-sys-icon-color, var(--chips-sys-color-on-surface, currentColor));
  --chips-base-icon-size: var(--chips-sys-icon-size, 1em);
  --chips-base-icon-fill: var(--chips-sys-icon-fill, 0);
  --chips-base-icon-wght: var(--chips-sys-icon-wght, 400);
  --chips-base-icon-grad: var(--chips-sys-icon-grad, 0);
  --chips-base-icon-opsz: var(--chips-sys-icon-opsz, 24);
}

body {
  margin: 0;
  padding: 0;
  min-height: 100vh;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background-color: inherit;
  color: inherit;
}

[data-scope] {
  box-sizing: border-box;
  font-family: inherit;
}

[data-scope="icon"][data-part="root"] {
  color: var(--chips-icon-color, var(--chips-base-icon-color));
  font-size: var(--chips-icon-size, var(--chips-base-icon-size));
  font-family: "Material Symbols Outlined";
  font-style: normal;
  font-weight: normal;
  letter-spacing: normal;
  text-transform: none;
  white-space: nowrap;
  word-wrap: normal;
  direction: ltr;
  user-select: none;
  -webkit-font-smoothing: antialiased;
}

[data-scope="icon"][data-part="root"][data-icon-style="rounded"] {
  font-family: "Material Symbols Rounded";
}

[data-scope="icon"][data-part="root"][data-icon-style="sharp"] {
  font-family: "Material Symbols Sharp";
}
