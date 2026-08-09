import type { ReactNode } from "react";

export interface SettingsLayoutProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  maxWidth?: number;
}

export function SettingsLayout({
  title,
  subtitle,
  children,
  maxWidth = 640,
}: SettingsLayoutProps): React.ReactElement {
  return (
    <div style={{ padding: "24px 28px 40px", maxWidth, margin: "0 auto" }}>
      {title ? <h1 className="ios-title-2" style={{ margin: "0 0 2px" }}>{title}</h1> : null}
      {subtitle ? <p className="ios-subheadline" style={{ margin: "0 0 20px" }}>{subtitle}</p> : null}
      {children}
    </div>
  );
}
