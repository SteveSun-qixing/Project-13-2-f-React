export interface ZoomBadgeProps {
  percent: string;
  title: string;
  onClick: () => void;
}

export function ZoomBadge(props: ZoomBadgeProps): React.ReactElement {
  const { percent, title, onClick } = props;

  return (
    <button
      type="button"
      className="photo-viewer-zoom-badge"
      title={title}
      aria-label={`${percent}，${title}`}
      aria-live="polite"
      onClick={onClick}
    >
      {percent}
    </button>
  );
}
