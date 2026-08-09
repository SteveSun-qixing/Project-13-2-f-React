import * as React from "react";
import type { StandardError } from "./index.d.ts";

export interface EmbeddedDocumentFrameProps {
  surfaceId?: string;
  title?: string;
  src?: string;
  srcDoc?: string;
  ratio?: string;
  loading?: boolean;
  disabled?: boolean;
  sandbox?: string;
  scope?: string;
  onActivate?: (surfaceId?: string) => void;
  onFrameReady?: (surfaceId?: string) => void;
  onFrameError?: (error: StandardError) => void;
}

export function EmbeddedDocumentFrame(props: EmbeddedDocumentFrameProps): React.ReactElement;
