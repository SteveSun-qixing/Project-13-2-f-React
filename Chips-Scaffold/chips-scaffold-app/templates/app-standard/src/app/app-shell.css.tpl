.app-shell__workspace {
  display: grid;
  gap: 16px;
  min-inline-size: 0;
  padding: 24px;
}

.app-shell__scene-switch {
  display: flex;
  justify-content: center;
}

.app-shell__view-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
  min-inline-size: 0;
}

.app-shell__section {
  min-inline-size: 0;
}

.app-shell__status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  min-inline-size: 0;
}

.app-shell__status-item {
  display: grid;
  gap: 4px;
  min-inline-size: 0;
  padding: 12px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 10px;
  background: #f5f5f7;
}

.app-shell__status-item-label {
  color: #6e6e73;
  font-size: 12px;
}

.app-shell__status-item-value {
  overflow-wrap: anywhere;
  color: #1d1d1f;
  font-weight: 600;
}

.app-shell__scene-list {
  display: grid;
  gap: 8px;
  min-inline-size: 0;
}

.app-shell__scene-list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-inline-size: 0;
  padding: 10px 12px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 10px;
}

.app-shell__scene-list-copy {
  display: grid;
  gap: 2px;
  min-inline-size: 0;
}

.app-shell__scene-list-title {
  color: #1d1d1f;
  font-weight: 600;
}

.app-shell__scene-list-description {
  color: #6e6e73;
  font-size: 12px;
}

.app-shell__runtime-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-inline-size: 0;
}

.app-shell__icon-line {
  display: flex;
  align-items: center;
  gap: 8px;
  min-inline-size: 0;
}

@media (max-width: 720px) {
  .app-shell__workspace {
    padding: 16px;
  }

  .app-shell__view-grid {
    grid-template-columns: 1fr;
  }
}
