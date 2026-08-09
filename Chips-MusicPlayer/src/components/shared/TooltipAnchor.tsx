import React from "react";

export interface TooltipAnchorProps {
  label: string;
  children: React.ReactNode;
}

export function TooltipAnchor(props: TooltipAnchorProps): React.ReactElement {
  const { label, children } = props;
  return (
    <span className="music-player-tooltip-anchor" data-tooltip={label}>
      {children}
    </span>
  );
}
