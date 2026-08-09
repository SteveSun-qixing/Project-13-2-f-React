import { useEffect, useState } from "react";

export interface UseDebouncedValueOptions {
  delay?: number;
}

export function useDebouncedValue<T>(value: T, options?: UseDebouncedValueOptions): T {
  const delay = options?.delay ?? 300;
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [delay, value]);

  return debouncedValue;
}
