import { FileImageOutlined } from "@ant-design/icons";

export interface EmptyStateProps {
  title: string;
  description: string;
  hint: string;
  shortcutText: string;
  actionLabel: string;
  dragActive: boolean;
  onOpen: () => void;
}

export function EmptyState(props: EmptyStateProps): React.ReactElement {
  const { title, description, hint, shortcutText, actionLabel, dragActive, onOpen } = props;

  return (
    <div className={`photo-viewer-empty${dragActive ? " photo-viewer-empty--drag-active" : ""}`}>
      <div className="photo-viewer-empty__art" aria-hidden="true">
        <FileImageOutlined />
      </div>
      <h2 className="photo-viewer-empty__title">{title}</h2>
      <p className="photo-viewer-empty__description">{description}</p>
      <p className="photo-viewer-empty__hint">{hint}</p>
      <p className="photo-viewer-empty__shortcut">{shortcutText}</p>
      <button type="button" className="photo-viewer-empty__action" onClick={onOpen}>
        {actionLabel}
      </button>
    </div>
  );
}
