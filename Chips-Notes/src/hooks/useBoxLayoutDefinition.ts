import { useEffect, useMemo, useState } from 'react';
import type { BoxLayoutDescriptor } from 'chips-sdk';
import { getChipsClient } from '../services/bridge-client';
import { toDisplayErrorMessage } from '../utils/error';

interface BoxLayoutDefinitionState {
  layoutDefinition: BoxLayoutDescriptor | null;
  error: string | null;
}

export function useBoxLayoutDefinition(layoutType: string | null | undefined): BoxLayoutDefinitionState {
  const client = useMemo(() => getChipsClient(), []);
  const [layoutDefinition, setLayoutDefinition] = useState<BoxLayoutDescriptor | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!layoutType) {
      setLayoutDefinition(null);
      setError(null);
      return;
    }

    let disposed = false;
    setError(null);

    void client.box.readLayoutDescriptor(layoutType)
      .then((descriptor) => {
        if (!disposed) {
          setLayoutDefinition(descriptor);
        }
      })
      .catch((reason) => {
        if (!disposed) {
          setLayoutDefinition(null);
          setError(toDisplayErrorMessage(reason, `布局描述符读取失败: ${layoutType}`));
        }
      });

    return () => {
      disposed = true;
    };
  }, [client, layoutType]);

  return {
    layoutDefinition,
    error,
  };
}
