import React from "react";
import {
  ChipsIcon,
  resolveCommandMenuGroups,
  type ChipsCommandProviderProps,
  type ChipsCommandView,
  type ChipsResolvedCommandView,
} from "@chips/component-library";

export interface AppMenuSection {
  id: string;
  title: string;
  menuId: string;
}

interface AppMenuProps {
  open: boolean;
  buttonLabel: string;
  commands: ChipsCommandView[];
  i18n: ChipsCommandProviderProps["i18n"];
  sections: AppMenuSection[];
  onToggle: () => void;
  onCommand: (command: ChipsResolvedCommandView) => void;
}

function resolveSectionCommands(
  commands: ChipsCommandView[],
  menuId: string,
  i18n: ChipsCommandProviderProps["i18n"],
): ChipsResolvedCommandView[] {
  return resolveCommandMenuGroups(commands, {
    menuId,
    i18n,
  }).flatMap((group) => group.items);
}

export const AppMenu = React.forwardRef<HTMLDivElement, AppMenuProps>(function AppMenu(
  {
    open,
    buttonLabel,
    commands,
    i18n,
    sections,
    onToggle,
    onCommand,
  },
  ref,
): React.ReactElement {
  return (
    <div ref={ref} className="rte-app-menu">
      <button
        type="button"
        className="rte-app-menu__button"
        aria-label={buttonLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className="rte-sr-only">{buttonLabel}</span>
        <ChipsIcon descriptor={{ name: "menu", decorative: true }} size={20} />
      </button>

      {open ? (
        <div className="rte-app-menu__panel" role="menu" aria-label={buttonLabel}>
          {sections.map((section) => (
            <section key={section.id} className="rte-app-menu__section">
              <h2 className="rte-app-menu__title">{section.title}</h2>
              <div className="rte-app-menu__items">
                {resolveSectionCommands(commands, section.menuId, i18n).map((item) => (
                  <button
                    key={item.commandId}
                    type="button"
                    role="menuitem"
                    className="rte-app-menu__item"
                    disabled={item.disabled}
                    aria-label={item.ariaLabel}
                    data-command-id={item.commandId}
                    onClick={() => onCommand(item)}
                  >
                    <span className="rte-app-menu__item-icon" aria-hidden="true">
                      {item.icon ? <ChipsIcon descriptor={{ ...item.icon, decorative: true }} size={18} /> : null}
                    </span>
                    <span className="rte-app-menu__item-label">{item.label}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
});
