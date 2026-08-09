import type { ReactNode } from "react";

export interface SettingsGroupProps {
  title?: string;
  children: ReactNode;
}

export function SettingsGroup({ title, children }: SettingsGroupProps): React.ReactElement {
  return (
    <>
      {title ? <div className="ios-grouped-list__group-title">{title}</div> : null}
      <div className="ios-grouped-list">{children}</div>
    </>
  );
}
