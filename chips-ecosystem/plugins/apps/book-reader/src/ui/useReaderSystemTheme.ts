import { useEffect, useState } from 'react';

export interface UseReaderSystemThemeReturn {
  isDark: boolean;
  isFollowingSystem: boolean;
}

function isSystemSchemeTrackingSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function';
}

function readSystemDarkScheme(): boolean {
  if (!isSystemSchemeTrackingSupported()) {
    return false;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function useReaderSystemTheme(): UseReaderSystemThemeReturn {
  const [isDark, setIsDark] = useState<boolean>(readSystemDarkScheme);
  const [isFollowingSystem, setIsFollowingSystem] = useState<boolean>(
    isSystemSchemeTrackingSupported
  );

  useEffect(() => {
    if (!isSystemSchemeTrackingSupported()) {
      setIsFollowingSystem(false);
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsFollowingSystem(true);
    setIsDark(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent): void => {
      setIsDark(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return {
    isDark,
    isFollowingSystem,
  };
}
