import { useEffect, useRef } from "react";
import type { ReactElement } from "react";
import { pdfRectToCss } from "../pdf/geometry";
import type { PageGeom } from "../pdf/geometry";
import type { FormValueInput, FormWidget } from "../pdf/form-catalog";
import { applyElementBox } from "./geometry-style";

/** 控件定位包装：几何经 CSS 变量写入，控件填满包装盒 */
function WidgetBox({
  widget,
  geom,
  scale,
  children,
  className,
}: {
  widget: FormWidget;
  geom: PageGeom;
  scale: number;
  children: ReactElement;
  className: string;
}): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    applyElementBox(el, pdfRectToCss(geom, widget.rect, scale));
  }, [geom, scale, widget.rect]);
  return (
    <div ref={ref} className={`pdf-form-widget ${className}`}>
      {children}
    </div>
  );
}

/** AcroForm 覆盖层：文本框/复选框/单选/下拉按页面绝对定位；值由 App 汇总后随保存写回 */
export function FormLayer({
  widgets,
  geom,
  scale,
  readOnly = false,
  edits,
  onEdit,
}: {
  widgets: FormWidget[];
  geom: PageGeom;
  scale: number;
  readOnly?: boolean;
  edits: ReadonlyMap<string, FormValueInput>;
  onEdit: (value: FormValueInput) => void;
}): ReactElement | null {
  if (widgets.length === 0) return null;

  return (
    <div className="pdf-form-layer">
      {widgets.map((w) => {
        const edit = edits.get(w.fieldName);
        const disabled = readOnly || w.readOnly;
        if (w.kind === "checkbox") {
          const checked = edit ? Boolean(edit.checked) : w.checked;
          return (
            <WidgetBox key={w.id} widget={w} geom={geom} scale={scale} className="pdf-form-widget-checkbox">
              <input
                type="checkbox"
                className="pdf-form-checkbox"
                disabled={disabled}
                checked={checked}
                required={w.required}
                aria-required={w.required}
                aria-invalid={w.required && !checked}
                title={w.fieldName}
                onChange={(e) =>
                  onEdit({ name: w.fieldName, kind: "checkbox", checked: e.target.checked })
                }
              />
            </WidgetBox>
          );
        }
        const value = edit ? (edit.value ?? "") : w.value;
        if (w.kind === "radio") {
          return (
            <WidgetBox key={w.id} widget={w} geom={geom} scale={scale} className="pdf-form-widget-radio">
              <input
                type="radio"
                className="pdf-form-radio"
                disabled={disabled}
                checked={value === w.buttonValue}
                name={w.fieldName}
                required={w.required}
                aria-required={w.required}
                aria-invalid={w.required && !value}
                title={w.fieldName}
                onChange={() => onEdit({ name: w.fieldName, kind: "radio", value: w.buttonValue })}
              />
            </WidgetBox>
          );
        }
        if (w.kind === "choice") {
          const known = w.options.some((o) => o.exportValue === value);
          const options: { value: string; label: string; disabled?: boolean }[] = [
            ...(known || !value ? [] : [{ value, label: value, disabled: true }]),
            ...w.options.map((o) => ({ value: o.exportValue, label: o.displayValue })),
          ];
          return (
            <WidgetBox key={w.id} widget={w} geom={geom} scale={scale} className="pdf-form-widget-select">
              <select
                className="pdf-form-select"
                disabled={disabled}
                required={w.required}
                aria-required={w.required}
                aria-invalid={w.required && !value}
                title={w.fieldName}
                value={value}
                onChange={(e) => onEdit({ name: w.fieldName, kind: "choice", value: e.target.value })}
              >
                {!value ? <option value="" hidden></option> : null}
                {options.map((o) => (
                  <option key={o.value} value={o.value} disabled={o.disabled}>
                    {o.label}
                  </option>
                ))}
              </select>
            </WidgetBox>
          );
        }
        const className = `pdf-form-input${w.comb ? " pdf-form-input-comb" : ""}`;
        if (w.multiLine) {
          return (
            <WidgetBox key={w.id} widget={w} geom={geom} scale={scale} className="pdf-form-widget-text">
              <textarea
                className={className}
                data-align={w.textAlignment}
                disabled={disabled}
                value={value}
                maxLength={w.maxLen ?? undefined}
                required={w.required}
                aria-required={w.required}
                aria-invalid={w.required && !value}
                title={w.fieldName}
                onChange={(e) => onEdit({ name: w.fieldName, kind: "text", value: e.target.value })}
              />
            </WidgetBox>
          );
        }
        return (
          <WidgetBox key={w.id} widget={w} geom={geom} scale={scale} className="pdf-form-widget-text">
            <input
              type={w.password ? "password" : "text"}
              className={className}
              data-align={w.textAlignment}
              disabled={disabled}
              value={value}
              maxLength={w.maxLen ?? undefined}
              required={w.required}
              aria-required={w.required}
              aria-invalid={w.required && !value}
              title={w.fieldName}
              onChange={(e) => onEdit({ name: w.fieldName, kind: "text", value: e.target.value })}
            />
          </WidgetBox>
        );
      })}
    </div>
  );
}
