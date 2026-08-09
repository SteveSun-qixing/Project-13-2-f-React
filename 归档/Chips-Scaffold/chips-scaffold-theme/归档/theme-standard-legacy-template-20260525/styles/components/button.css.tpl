.chips-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding-inline: var(--chips-base-space-3);
  padding-block: var(--chips-base-space-2);
  border-radius: var(--chips-base-radius-md);
  border: none;
  cursor: pointer;
  background-color: var(--chips-sys-color-primary);
  color: var(--chips-sys-color-on-primary);
  font-size: 14px;
}

.chips-button:disabled {
  opacity: 0.6;
  cursor: default;
}
