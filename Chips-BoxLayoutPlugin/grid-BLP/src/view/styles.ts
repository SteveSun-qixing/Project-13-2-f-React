export const GRID_LAYOUT_STYLE = `
[data-scope="chips-box-grid-layout"] {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  min-height: 100%;
  overflow: visible;
  color: #1d1d1f;
  background: #ffffff;
  box-sizing: border-box;
}

[data-scope="chips-box-grid-layout"] * {
  box-sizing: border-box;
}

[data-scope="chips-box-grid-layout"] [data-layout-background] {
  position: sticky;
  top: 0;
  left: 0;
  right: 0;
  width: 100%;
  height: 100vh;
  margin-bottom: -100vh;
  z-index: 0;
  pointer-events: none;
  opacity: 1;
}

[data-scope="chips-box-grid-layout"] [data-layout-background] .chips-embedded-document-frame,
[data-scope="chips-box-grid-layout"] [data-layout-background] iframe {
  width: 100%;
  height: 100%;
}

[data-scope="chips-box-grid-layout"] [data-layout-shell] {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  min-width: 0;
  min-height: 100%;
}

[data-scope="chips-box-grid-layout"] [data-layout-top-region] {
  width: 100%;
  min-width: 0;
  min-height: clamp(132px, 24vw, 288px);
  border-radius: 12px;
  overflow: hidden;
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

[data-scope="chips-box-grid-layout"] [data-layout-top-region] .chips-embedded-document-frame,
[data-scope="chips-box-grid-layout"] [data-layout-top-region] iframe {
  width: 100%;
  height: 100%;
}

[data-scope="chips-box-grid-layout"] [data-layout-grid] {
  display: grid;
  flex: 1;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 160px), 1fr));
  grid-auto-rows: max-content;
  gap: 12px;
  align-items: start;
  min-width: 0;
  min-height: 0;
  align-content: start;
}

[data-scope="chips-box-grid-layout"] [data-layout-grid][data-empty="true"] {
  grid-template-columns: minmax(0, 1fr);
  min-height: 100%;
}

[data-scope="chips-box-grid-layout"] [data-grid-entry] {
  display: grid;
  gap: 8px;
  min-width: 0;
  align-content: start;
}

[data-scope="chips-box-grid-layout"] [data-grid-cover-shell] {
  width: 100%;
  overflow: hidden;
  border-radius: 12px;
  background: #ffffff;
}

[data-scope="chips-box-grid-layout"] [data-grid-cover-shell] .chips-embedded-document-frame,
[data-scope="chips-box-grid-layout"] [data-grid-cover-shell] iframe {
  width: 100%;
  height: 100%;
}

[data-scope="chips-box-grid-layout"] [data-grid-cover-shell] iframe {
  display: block;
  border: none;
  background: transparent;
  pointer-events: none;
}

[data-scope="chips-box-grid-layout"] [data-grid-cover-placeholder] {
  width: 100%;
  height: 100%;
  min-height: 180px;
  display: grid;
  place-items: center;
  gap: 8px;
  padding: 16px;
  border: none;
  background: transparent;
  color: #1d1d1f;
  text-align: center;
  cursor: pointer;
}

[data-scope="chips-box-grid-layout"] [data-grid-cover-placeholder-title] {
  font-size: 15px;
  line-height: 1.5;
}

[data-scope="chips-box-grid-layout"] [data-grid-cover-placeholder-text] {
  font-size: 12px;
  color: #6e6e73;
}

[data-scope="chips-box-grid-layout"] [data-grid-entry-body] {
  display: grid;
  justify-items: center;
}

[data-scope="chips-box-grid-layout"] [data-grid-entry-title] {
  border: none;
  padding: 0;
  margin: 0;
  background: none;
  color: #1d1d1f;
  font: inherit;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.5;
  text-align: center;
  cursor: pointer;
  width: 100%;
  min-width: 0;
}

[data-scope="chips-box-grid-layout"] [data-grid-entry-title]:focus-visible,
[data-scope="chips-box-grid-layout"] [data-grid-cover-placeholder]:focus-visible,
[data-scope="chips-box-grid-layout"] [data-layout-load-more]:focus-visible,
[data-scope="chips-box-grid-layout"] [data-layout-retry]:focus-visible {
  outline: 2px solid #0a84ff;
  outline-offset: 2px;
}

[data-scope="chips-box-grid-layout"] [data-layout-empty] {
  position: relative;
  display: grid;
  place-items: center;
  gap: 12px;
  min-height: 100%;
  padding: 36px 20px;
  background: #ffffff;
  color: #6e6e73;
  font-size: 14px;
  text-align: center;
}

[data-scope="chips-box-grid-layout"] [data-layout-empty-ghosts] {
  position: absolute;
  inset: 28px 24px;
  pointer-events: none;
  display: grid;
  grid-template-columns: repeat(3, minmax(92px, 148px));
  justify-content: center;
  align-content: center;
  gap: 16px;
}

[data-scope="chips-box-grid-layout"] [data-layout-empty-ghost] {
  display: block;
  width: 100%;
  border-radius: 12px;
  background: #f2f2f7;
  border: 1px solid rgba(0, 0, 0, 0.08);
  aspect-ratio: 3 / 4;
}

[data-scope="chips-box-grid-layout"] [data-layout-empty-ghost][data-size="lg"] {
  transform: translateY(-10px);
}

[data-scope="chips-box-grid-layout"] [data-layout-empty-ghost][data-size="md"] {
  transform: translateY(10px);
}

[data-scope="chips-box-grid-layout"] [data-layout-empty-ghost][data-size="sm"] {
  transform: translateY(-4px);
}

[data-scope="chips-box-grid-layout"] [data-layout-empty-title] {
  position: relative;
  z-index: 1;
  font-size: 18px;
  color: #1d1d1f;
}

[data-scope="chips-box-grid-layout"] [data-layout-empty-text] {
  position: relative;
  z-index: 1;
  max-width: 320px;
  color: #6e6e73;
  line-height: 1.7;
}

[data-scope="chips-box-grid-layout"] [data-layout-footer] {
  display: grid;
  justify-items: center;
  padding: 12px 0;
}

[data-scope="chips-box-grid-layout"] [data-layout-load-more],
[data-scope="chips-box-grid-layout"] [data-layout-retry] {
  min-height: 40px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 10px;
  background: #ffffff;
  color: #1d1d1f;
  padding: 0 16px;
  font: inherit;
  cursor: pointer;
}

[data-scope="chips-box-grid-layout"] [data-layout-load-more]:disabled {
  cursor: default;
  opacity: 0.64;
}

[data-scope="chips-box-grid-layout"] [data-layout-page-error] {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #ff3b30;
}

@media (max-width: 767px) {
  [data-scope="chips-box-grid-layout"] [data-layout-shell] {
    padding: 12px;
    gap: 12px;
  }

  [data-scope="chips-box-grid-layout"] [data-layout-grid] {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  [data-scope="chips-box-grid-layout"] [data-layout-empty] {
    min-height: 100%;
  }

  [data-scope="chips-box-grid-layout"] [data-layout-empty-ghosts] {
    inset: 20px 16px;
    grid-template-columns: repeat(2, minmax(92px, 132px));
    gap: 8px;
  }
}
`;
