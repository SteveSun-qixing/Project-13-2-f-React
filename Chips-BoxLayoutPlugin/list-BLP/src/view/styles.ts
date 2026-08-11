export const LIST_LAYOUT_STYLE = `
[data-scope="chips-box-list-layout"] {
  --chips-list-row-height: 132px;
  --chips-list-cover-width: 84px;
  --chips-list-cover-height: 112px;
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: 100%;
  overflow: visible;
  background: #ffffff;
  color: #1d1d1f;
  box-sizing: border-box;
}

[data-scope="chips-box-list-layout"][data-density="compact"] {
  --chips-list-row-height: 104px;
}

[data-scope="chips-box-list-layout"][data-density="spacious"] {
  --chips-list-row-height: 164px;
}

[data-scope="chips-box-list-layout"][data-cover-size="compact"] {
  --chips-list-cover-width: 64px;
  --chips-list-cover-height: 84px;
}

[data-scope="chips-box-list-layout"][data-cover-size="large"] {
  --chips-list-cover-width: 112px;
  --chips-list-cover-height: 148px;
}

[data-scope="chips-box-list-layout"] [data-layout-background] {
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

[data-scope="chips-box-list-layout"] [data-layout-background] .chips-embedded-document-frame,
[data-scope="chips-box-list-layout"] [data-layout-background] iframe {
  width: 100%;
  height: 100%;
}

[data-scope="chips-box-list-layout"] [data-layout-shell] {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  min-height: 100%;
  min-width: 0;
  box-sizing: border-box;
}

[data-scope="chips-box-list-layout"] [data-layout-top-region] {
  width: 100%;
  min-height: clamp(132px, 24vw, 288px);
  border-radius: 8px;
  overflow: hidden;
  background: #f2f2f7;
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 14px 32px rgba(0, 0, 0, 0.08);
  backdrop-filter: blur(12px);
}

[data-scope="chips-box-list-layout"] [data-layout-top-region] .chips-embedded-document-frame,
[data-scope="chips-box-list-layout"] [data-layout-top-region] iframe {
  width: 100%;
  height: 100%;
}

[data-scope="chips-box-list-layout"] [data-list-data-grid] {
  display: block;
  min-width: 0;
}

[data-scope="chips-box-list-layout"] [data-layout-toolbar] {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  min-width: 0;
  padding: 8px 0;
}

[data-scope="chips-box-list-layout"] [data-layout-selection-count] {
  margin-right: auto;
  color: #6e6e73;
  font-size: 13px;
  line-height: 1.45;
}

[data-scope="chips-box-list-layout"] [data-layout-list] {
  display: grid;
  flex: 1;
  gap: 12px;
  align-content: start;
  min-height: 0;
  min-width: 0;
  outline: none;
}

[data-scope="chips-box-list-layout"] [data-layout-list][data-empty="true"] {
  min-height: 100%;
}

[data-scope="chips-box-list-layout"] [data-list-entry] {
  display: grid;
  grid-template-columns: 36px var(--chips-list-cover-width) minmax(0, 1fr);
  align-items: center;
  gap: 16px;
  width: 100%;
  height: var(--chips-list-row-height);
  min-height: var(--chips-list-row-height);
  min-width: 0;
  padding: 10px 14px;
  box-sizing: border-box;
  border-radius: 8px;
  background: #f2f2f7;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

[data-scope="chips-box-list-layout"] [data-list-entry][data-active="true"] {
  border-color: #0a84ff;
  box-shadow: 0 0 0 1px #0a84ff;
}

[data-scope="chips-box-list-layout"] [data-list-entry][data-selected="true"] {
  background: rgba(10, 132, 255, 0.08);
}

[data-scope="chips-box-list-layout"] [data-list-selection] {
  display: grid;
  place-items: center;
  min-width: 0;
}

[data-scope="chips-box-list-layout"] [data-list-selection] .ant-checkbox-wrapper {
  display: inline-flex;
  align-items: center;
  min-width: 0;
}

[data-scope="chips-box-list-layout"] [data-list-cover-shell] {
  width: var(--chips-list-cover-width);
  height: var(--chips-list-cover-height);
  overflow: hidden;
  border-radius: 6px;
  background: #ffffff;
}

[data-scope="chips-box-list-layout"] [data-list-cover-shell] .chips-embedded-document-frame,
[data-scope="chips-box-list-layout"] [data-list-cover-shell] iframe {
  width: 100%;
  height: 100%;
}

[data-scope="chips-box-list-layout"] [data-list-cover-shell] iframe {
  display: block;
  border: none;
  background: transparent;
  pointer-events: none;
}

[data-scope="chips-box-list-layout"] [data-list-cover-placeholder] {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  gap: 6px;
  padding: 10px;
  border: none;
  background: #f2f2f7;
  color: #1d1d1f;
  text-align: center;
  cursor: pointer;
}

[data-scope="chips-box-list-layout"] [data-list-cover-placeholder-title] {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  line-height: 1.4;
}

[data-scope="chips-box-list-layout"] [data-list-cover-placeholder-text] {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  line-height: 1.4;
  color: #6e6e73;
}

[data-scope="chips-box-list-layout"] [data-list-entry-body] {
  display: grid;
  gap: 6px;
  min-width: 0;
  align-content: center;
}

[data-scope="chips-box-list-layout"] [data-list-entry-title] {
  display: block;
  width: 100%;
  min-width: 0;
  border: none;
  padding: 0;
  margin: 0;
  background: none;
  color: #1d1d1f;
  font: inherit;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.45;
  text-align: left;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

[data-scope="chips-box-list-layout"] [data-list-entry-meta],
[data-scope="chips-box-list-layout"] [data-list-entry-tags] {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  gap: 6px 8px;
  align-items: center;
}

[data-scope="chips-box-list-layout"] [data-list-entry-date] {
  display: block;
  max-width: 100%;
  color: #6e6e73;
  font-size: 13px;
  line-height: 1.45;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

[data-scope="chips-box-list-layout"] [data-list-entry-chip],
[data-scope="chips-box-list-layout"] [data-list-entry-tag] {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  border-radius: 999px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: #f2f2f7;
  color: #6e6e73;
  font-size: 12px;
  line-height: 1.2;
  padding: 3px 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

[data-scope="chips-box-list-layout"] [data-list-entry-summary] {
  max-width: 100%;
  margin: 0;
  color: #6e6e73;
  font-size: 13px;
  line-height: 1.45;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

[data-scope="chips-box-list-layout"] [data-list-group-heading] {
  position: sticky;
  top: 0;
  z-index: 2;
  padding: 8px 4px 2px;
  color: #6e6e73;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0;
  background: #ffffff;
}

[data-scope="chips-box-list-layout"] [data-list-entry-title]:focus-visible,
[data-scope="chips-box-list-layout"] [data-list-cover-placeholder]:focus-visible,
[data-scope="chips-box-list-layout"] [data-layout-list]:focus-visible {
  outline: 2px solid #0a84ff;
  outline-offset: 2px;
}

[data-scope="chips-box-list-layout"] [data-layout-pagination] {
  display: flex;
  justify-content: center;
  padding: 8px 0 18px;
}

[data-scope="chips-box-list-layout"] [data-layout-error] {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 10px;
  background: #ffffff;
}

[data-scope="chips-box-list-layout"] [data-layout-error-text] {
  display: grid;
  gap: 2px;
  min-width: 0;
}

[data-scope="chips-box-list-layout"] [data-layout-error-title] {
  color: #1d1d1f;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.5;
}

[data-scope="chips-box-list-layout"] [data-layout-error-detail] {
  color: #ff3b30;
  font-size: 13px;
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 767px) {
  [data-scope="chips-box-list-layout"] {
    --chips-list-row-height: 112px;
    --chips-list-cover-width: 66px;
    --chips-list-cover-height: 88px;
  }

  [data-scope="chips-box-list-layout"][data-density="compact"] {
    --chips-list-row-height: 96px;
  }

  [data-scope="chips-box-list-layout"][data-density="spacious"] {
    --chips-list-row-height: 140px;
  }

  [data-scope="chips-box-list-layout"] [data-layout-shell] {
    padding: 16px;
    gap: 14px;
  }

  [data-scope="chips-box-list-layout"] [data-layout-toolbar] {
    align-items: stretch;
    flex-direction: column;
  }

  [data-scope="chips-box-list-layout"] [data-list-entry] {
    grid-template-columns: 30px var(--chips-list-cover-width) minmax(0, 1fr);
    gap: 12px;
    padding: 8px 10px;
  }

  [data-scope="chips-box-list-layout"] [data-list-entry-title] {
    font-size: 14px;
  }

  [data-scope="chips-box-list-layout"] [data-list-entry-date],
  [data-scope="chips-box-list-layout"] [data-list-entry-summary] {
    font-size: 12px;
  }
}
`;
