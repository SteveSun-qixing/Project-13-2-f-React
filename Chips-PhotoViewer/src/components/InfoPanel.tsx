import { useEffect } from "react";

export interface InfoPanelField {
  label: string;
  value: string;
}

export interface InfoPanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  fields: InfoPanelField[];
}

export function InfoPanel(props: InfoPanelProps): React.ReactElement | null {
  const { open, onClose, title, closeLabel, fields } = props;

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <aside className="photo-viewer-info-panel" role="dialog" aria-label={title}>
      <header className="photo-viewer-info-panel__header">
        <h2 className="photo-viewer-info-panel__title">{title}</h2>
        <button type="button" className="photo-viewer-info-panel__close" onClick={onClose} aria-label={closeLabel}>
          ×
        </button>
      </header>
      <dl className="photo-viewer-info-panel__fields">
        {fields.map((field) => (
          <div key={field.label} className="photo-viewer-info-panel__field">
            <dt className="photo-viewer-info-panel__label">{field.label}</dt>
            <dd className="photo-viewer-info-panel__value">{field.value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
