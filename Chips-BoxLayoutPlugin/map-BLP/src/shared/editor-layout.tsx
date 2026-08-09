import React from "react";

export function EditorSection({
  title,
  description,
  className,
  children,
  ...rest
}: {
  title: string;
  description?: string;
  className?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={["chips-map-layout-editor__section", className].filter(Boolean).join(" ")}
      {...rest}
    >
      <header className="chips-map-layout-editor__section-head">
        <h2 className="chips-map-layout-editor__section-title">{title}</h2>
        {description ? (
          <p className="chips-map-layout-editor__section-desc">{description}</p>
        ) : null}
      </header>
      <div className="chips-map-layout-editor__section-body">{children}</div>
    </section>
  );
}

export function EditorField({
  label,
  hint,
  error,
  className,
  children,
}: {
  label?: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={["chips-map-layout-editor__field", className].filter(Boolean).join(" ")}>
      {label ? <label className="chips-map-layout-editor__label">{label}</label> : null}
      {children}
      {hint ? <p className="chips-map-layout-editor__hint">{hint}</p> : null}
      {error ? (
        <p className="chips-map-layout-editor__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
