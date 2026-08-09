import type { SVGProps } from 'react';

export type IconName =
  | 'plus'
  | 'arrow-left'
  | 'arrow-up-right'
  | 'upload'
  | 'settings'
  | 'logout'
  | 'card'
  | 'box'
  | 'cover'
  | 'document'
  | 'clock'
  | 'sparkles'
  | 'check'
  | 'warning';

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

function getIconPath(name: IconName) {
  switch (name) {
    case 'plus':
      return (
        <>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </>
      );
    case 'arrow-left':
      return (
        <>
          <path d="M19 12H5" />
          <path d="m12 19-7-7 7-7" />
        </>
      );
    case 'arrow-up-right':
      return (
        <>
          <path d="M7 17 17 7" />
          <path d="M8 7h9v9" />
        </>
      );
    case 'upload':
      return (
        <>
          <path d="M12 17V6" />
          <path d="m8 10 4-4 4 4" />
          <path d="M4 18.5A2.5 2.5 0 0 0 6.5 21h11A2.5 2.5 0 0 0 20 18.5" />
        </>
      );
    case 'settings':
      return (
        <>
          <circle cx="12" cy="12" r="3.25" />
          <path d="M12 3.8v1.6" />
          <path d="M12 18.6v1.6" />
          <path d="m5.6 5.6 1.15 1.15" />
          <path d="m17.25 17.25 1.15 1.15" />
          <path d="M3.8 12h1.6" />
          <path d="M18.6 12h1.6" />
          <path d="m5.6 18.4 1.15-1.15" />
          <path d="m17.25 6.75 1.15-1.15" />
        </>
      );
    case 'logout':
      return (
        <>
          <path d="M9 21H5.8A2.8 2.8 0 0 1 3 18.2V5.8A2.8 2.8 0 0 1 5.8 3H9" />
          <path d="M16 17l5-5-5-5" />
          <path d="M21 12H9" />
        </>
      );
    case 'card':
      return (
        <>
          <rect x="4" y="5" width="16" height="14" rx="3" />
          <path d="M8 10h8" />
          <path d="M8 14h5" />
        </>
      );
    case 'box':
      return (
        <>
          <path d="M12 3 4 7.5 12 12l8-4.5L12 3Z" />
          <path d="M4 7.5V16.5L12 21l8-4.5V7.5" />
          <path d="M12 12v9" />
        </>
      );
    case 'cover':
      return (
        <>
          <rect x="5" y="4" width="14" height="16" rx="2.5" />
          <path d="m8 16 3.5-4 2.5 3 1.5-1.8L18 16" />
          <path d="M8.5 8.5h.01" />
        </>
      );
    case 'document':
      return (
        <>
          <path d="M7 3.5h7l3 3V20a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 20V3.5Z" />
          <path d="M14 3.5V7h3" />
          <path d="M9.5 11h5" />
          <path d="M9.5 15h5" />
        </>
      );
    case 'clock':
      return (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 8v4.5l2.5 1.5" />
        </>
      );
    case 'sparkles':
      return (
        <>
          <path d="m12 4 1.4 3.6L17 9l-3.6 1.4L12 14l-1.4-3.6L7 9l3.6-1.4L12 4Z" />
          <path d="m18.5 14 0.8 2.2 2.2 0.8-2.2 0.8-0.8 2.2-0.8-2.2-2.2-0.8 2.2-0.8 0.8-2.2Z" />
          <path d="m5.5 14 0.8 2.2 2.2 0.8-2.2 0.8-0.8 2.2-0.8-2.2-2.2-0.8 2.2-0.8 0.8-2.2Z" />
        </>
      );
    case 'check':
      return (
        <>
          <path d="m5.5 12.5 4 4L18.5 8" />
        </>
      );
    case 'warning':
      return (
        <>
          <path d="M12 4 3.5 19h17L12 4Z" />
          <path d="M12 9.5v4" />
          <path d="M12 16.75h.01" />
        </>
      );
  }
}

export function Icon({ name, size = 18, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {getIconPath(name)}
    </svg>
  );
}
