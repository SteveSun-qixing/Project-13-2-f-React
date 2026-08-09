import { LeftOutlined, RightOutlined } from "@ant-design/icons";

export interface NavigationArrowsProps {
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  previousLabel: string;
  nextLabel: string;
}

export function NavigationArrows(props: NavigationArrowsProps): React.ReactElement {
  const { hasPrevious, hasNext, onPrevious, onNext, previousLabel, nextLabel } = props;

  return (
    <div className="photo-viewer-navigation-arrows">
      <button
        type="button"
        className="photo-viewer-navigation-arrows__button photo-viewer-navigation-arrows__button--previous"
        disabled={!hasPrevious}
        onClick={onPrevious}
        aria-label={previousLabel}
      >
        <LeftOutlined />
      </button>
      <button
        type="button"
        className="photo-viewer-navigation-arrows__button photo-viewer-navigation-arrows__button--next"
        disabled={!hasNext}
        onClick={onNext}
        aria-label={nextLabel}
      >
        <RightOutlined />
      </button>
    </div>
  );
}
