.chips-input {
  display: inline-flex;
  align-items: center;
  padding-inline: var(--chips-base-space-3);
  padding-block: var(--chips-base-space-2);
  border-radius: var(--chips-base-radius-md);
  border: 1px solid color-mix(in srgb, var(--chips-sys-color-on-surface, #111111) 12%, transparent);
  background-color: var(--chips-sys-color-surface);
  color: var(--chips-sys-color-on-surface);
  font-size: 14px;
}

.chips-input:focus {
  outline: 2px solid var(--chips-sys-color-primary);
  outline-offset: 1px;
}
