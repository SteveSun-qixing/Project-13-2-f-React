import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { useAppPreferences } from '../contexts/AppPreferencesContext';
import { Icon } from '../runtime/icons/Icon';

interface UploadDropzoneProps {
  disabled?: boolean;
  onFiles: (files: File[]) => void;
}

function hasFileTransfer(event: DragEvent<HTMLDivElement>): boolean {
  return Array.from(event.dataTransfer.types).includes('Files');
}

export function UploadDropzone({ disabled = false, onFiles }: UploadDropzoneProps) {
  const { t } = useAppPreferences();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dragDepthRef = useRef(0);
  const [isActive, setIsActive] = useState(false);

  const resetDragState = () => {
    dragDepthRef.current = 0;
    setIsActive(false);
  };

  const openPicker = () => {
    if (!disabled) {
      inputRef.current?.click();
    }
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);

    if (files.length > 0) {
      onFiles(files);
    }

    event.target.value = '';
  };

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (!hasFileTransfer(event) || disabled) {
      return;
    }

    event.preventDefault();
    dragDepthRef.current += 1;
    setIsActive(true);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!hasFileTransfer(event) || disabled) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setIsActive(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (!hasFileTransfer(event) || disabled) {
      return;
    }

    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);

    if (dragDepthRef.current === 0) {
      setIsActive(false);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!hasFileTransfer(event) || disabled) {
      return;
    }

    event.preventDefault();
    const files = Array.from(event.dataTransfer.files ?? []);
    resetDragState();

    if (files.length > 0) {
      onFiles(files);
    }
  };

  return (
    <section
      className="panel workspace-dropzone"
      data-active={isActive}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".card,.box"
        multiple
        className="sr-only"
        onChange={handleInputChange}
        tabIndex={-1}
      />

      <div className="workspace-dropzone__orb" aria-hidden="true">
        <Icon name="upload" size={26} />
      </div>

      <div className="workspace-dropzone__copy">
        <h2>{isActive ? t('workspace.dragActive') : t('workspace.dropTitle')}</h2>
        <p>{t('workspace.dropHint')}</p>
        <p className="workspace-dropzone__formats">{t('workspace.supportedFormats')}</p>
      </div>

      <button type="button" className="button button--primary" onClick={openPicker} disabled={disabled}>
        {t('workspace.pickFiles')}
      </button>
    </section>
  );
}
