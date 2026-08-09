import React from "react";
import { Segmented, Slider } from "antd";
import type { BookReaderCommandId } from "../commands/book-reader-commands";
import { BOOK_READER_COMMAND_IDS } from "../commands/book-reader-commands";
import {
  DEFAULT_LETTER_SPACING,
  DEFAULT_LINE_HEIGHT,
  MAX_LETTER_SPACING,
  MAX_LINE_HEIGHT,
  MIN_LINE_HEIGHT,
  READER_FONT_FAMILY_STACKS,
  type ReaderFontFamily,
  type ReaderPreferences,
  type ReaderTextAlign,
  type ReaderWritingMode,
} from "../utils/book-reader";
import { BRIGHTNESS_DEFAULT, BRIGHTNESS_MAX, BRIGHTNESS_MIN } from "../utils/reader-palette";
import { PanelShell } from "./PanelShell";
import "./preferences-extras.css";

function resolveFontSizePx(fontScale: number): number {
  return Math.round(Math.min(28, Math.max(12, fontScale * 17)));
}

function formatLineHeight(value: number): string {
  return String(Number(value.toFixed(2)));
}

function formatLetterSpacing(value: number): string {
  return `${Number(value.toFixed(3))}em`;
}

export interface PreferencesPanelProps {
  preferences: ReaderPreferences;
  restoreFocusElement?: HTMLElement | null;
  onUpdatePreferences: (prefs: ReaderPreferences) => void;
  onInvokeCommand?: (commandId: BookReaderCommandId) => void | Promise<void>;
  onClose: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function PreferencesPanel(props: PreferencesPanelProps): React.ReactElement {
  const { preferences, restoreFocusElement, onUpdatePreferences, onInvokeCommand, onClose, t } = props;

  const lineHeight = preferences.lineHeight ?? DEFAULT_LINE_HEIGHT;
  const letterSpacing = preferences.letterSpacing ?? DEFAULT_LETTER_SPACING;
  const writingMode = preferences.writingMode ?? "horizontal";
  const brightness = preferences.brightness ?? BRIGHTNESS_DEFAULT;

  const fontFamilyOptions = [
    { value: "serif" as ReaderFontFamily, label: t("book-reader.labels.serif"), stack: READER_FONT_FAMILY_STACKS.serif },
    { value: "sans" as ReaderFontFamily, label: t("book-reader.labels.sans"), stack: READER_FONT_FAMILY_STACKS.sans },
    { value: "round" as ReaderFontFamily, label: "圆体", stack: READER_FONT_FAMILY_STACKS.round },
    { value: "system" as ReaderFontFamily, label: "系统", stack: READER_FONT_FAMILY_STACKS.system },
  ];

  function updateReadingMode(mode: ReaderPreferences["readingMode"]): void {
    if (onInvokeCommand) {
      void onInvokeCommand(
        mode === "paginated"
          ? BOOK_READER_COMMAND_IDS.readingModePaginated
          : BOOK_READER_COMMAND_IDS.readingModeScroll,
      );
      return;
    }

    onUpdatePreferences({ ...preferences, readingMode: mode });
  }

  return (
    <PanelShell
      title={t("book-reader.labels.preferences")}
      eyebrow={t("book-reader.labels.appName")}
      onClose={onClose}
      className="book-reader-panel--preferences"
      restoreFocusElement={restoreFocusElement}
      t={t}
    >
      <div className="book-reader-preferences">
        <section className="book-reader-preferences__section">
          <h3>{t("book-reader.labels.readingMode")}</h3>
          <Segmented
            block
            value={preferences.readingMode}
            options={[
              { label: t("book-reader.labels.paginated"), value: "paginated" },
              { label: t("book-reader.labels.scroll"), value: "scroll" },
            ]}
            onChange={(value) => updateReadingMode(value as ReaderPreferences["readingMode"])}
          />
        </section>

        <section className="book-reader-preferences__section">
          <h3>{t("book-reader.labels.backgroundTone")}</h3>
          <Segmented
            block
            value={preferences.backgroundTone}
            options={[
              { label: "跟随系统", value: "system" },
              { label: t("book-reader.labels.backgroundTheme"), value: "theme" },
              { label: t("book-reader.labels.backgroundWarm"), value: "warm" },
              { label: t("book-reader.labels.backgroundMist"), value: "mist" },
              { label: t("book-reader.labels.backgroundNight"), value: "night" },
            ]}
            onChange={(value) =>
              onUpdatePreferences({
                ...preferences,
                backgroundTone: value as ReaderPreferences["backgroundTone"],
              })
            }
          />
        </section>

        <section className="book-reader-preferences__section">
          <div className="book-reader-sliderLabel">
            <span>亮度</span>
            <strong>{Math.round(brightness * 100)}%</strong>
          </div>
          <Slider
            min={BRIGHTNESS_MIN}
            max={BRIGHTNESS_MAX}
            step={0.05}
            value={brightness}
            onChange={(value) => onUpdatePreferences({ ...preferences, brightness: value })}
          />
        </section>

        <section className="book-reader-preferences__section">
          <h3>排版</h3>

          <div className="book-reader-sliderLabel">
            <span>{t("book-reader.labels.fontScale")}</span>
            <strong>{resolveFontSizePx(preferences.fontScale)}px</strong>
          </div>
          <Slider
            min={0.85}
            max={1.4}
            step={0.05}
            value={preferences.fontScale}
            onChange={(value) => onUpdatePreferences({ ...preferences, fontScale: value })}
          />

          <div className="book-reader-sliderLabel">
            <span>行高</span>
            <strong>{formatLineHeight(lineHeight)}</strong>
          </div>
          <Slider
            min={MIN_LINE_HEIGHT}
            max={MAX_LINE_HEIGHT}
            step={0.1}
            value={lineHeight}
            onChange={(value) => onUpdatePreferences({ ...preferences, lineHeight: value })}
          />

          <div className="book-reader-sliderLabel">
            <span>字距</span>
            <strong>{formatLetterSpacing(letterSpacing)}</strong>
          </div>
          <Slider
            min={0}
            max={MAX_LETTER_SPACING}
            step={0.005}
            value={letterSpacing}
            onChange={(value) => onUpdatePreferences({ ...preferences, letterSpacing: value })}
          />

          <span className="book-reader-preferences__controlLabel">对齐</span>
          <Segmented
            block
            value={preferences.textAlign ?? "justify"}
            options={[
              { label: "两端", value: "justify" },
              { label: "左对齐", value: "left" },
            ]}
            onChange={(value) =>
              onUpdatePreferences({
                ...preferences,
                textAlign: value as ReaderTextAlign,
              })
            }
          />

          <span className="book-reader-preferences__controlLabel">{t("book-reader.labels.fontFamily")}</span>
          <Segmented
            block
            value={preferences.fontFamily}
            options={fontFamilyOptions.map((option) => ({
              value: option.value,
              label: (
                <span className="book-reader-fontOption" style={{ fontFamily: option.stack }}>
                  {option.label}
                </span>
              ),
            }))}
            onChange={(value) =>
              onUpdatePreferences({
                ...preferences,
                fontFamily: value as ReaderFontFamily,
              })
            }
          />

          <span className="book-reader-preferences__controlLabel">排版方向</span>
          <Segmented
            block
            value={writingMode}
            options={[
              { label: "横排", value: "horizontal" },
              { label: "竖排", value: "vertical" },
            ]}
            onChange={(value) =>
              onUpdatePreferences({
                ...preferences,
                writingMode: value as ReaderWritingMode,
              })
            }
          />
          {writingMode === "vertical" ? <p className="book-reader-preferences__hint">竖排模式适合中文书籍</p> : null}
        </section>

        <section className="book-reader-preferences__section">
          <div className="book-reader-sliderLabel">
            <span>{t("book-reader.labels.contentWidth")}</span>
            <strong>{preferences.contentWidth}px</strong>
          </div>
          <Slider
            min={560}
            max={980}
            step={20}
            value={preferences.contentWidth}
            onChange={(value) => onUpdatePreferences({ ...preferences, contentWidth: value })}
          />
        </section>
      </div>
    </PanelShell>
  );
}
