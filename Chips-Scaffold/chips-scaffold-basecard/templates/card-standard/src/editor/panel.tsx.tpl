import type { BasecardConfig } from "../schema/card-config";
import { defaultBasecardConfig } from "../schema/card-config";
import { isNonEmptyString } from "../shared/utils";
import type { BasecardResourceImportRequest } from "../index";

export interface BasecardEditorProps {
  initialConfig: BasecardConfig;
  onChange: (next: BasecardConfig) => void;
  resolveResourceUrl?: (resourcePath: string) => Promise<string>;
  releaseResourceUrl?: (resourcePath: string) => Promise<void> | void;
  importResource?: (input: BasecardResourceImportRequest) => Promise<{ path: string } | { path: string; url?: string; name?: string; size?: number; mimeType?: string }>;
  deleteResource?: (resourcePath: string) => Promise<void>;
}

export function createBasecardEditorRoot(
  props: BasecardEditorProps
): HTMLElement {
  const root = document.createElement("div");
  root.className = "chips-basecard-editor chips-basecard-editor--standard";

  const form = document.createElement("form");
  form.className = "chips-basecard-editor__form";

  const titleLabel = document.createElement("label");
  titleLabel.textContent = "标题";
  titleLabel.className = "chips-basecard-editor__label";

  const titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.className = "chips-basecard-editor__input";
  titleInput.value = props.initialConfig.title ?? "";
  titleLabel.appendChild(titleInput);
  form.appendChild(titleLabel);

  const bodyLabel = document.createElement("label");
  bodyLabel.textContent = "内容";
  bodyLabel.className = "chips-basecard-editor__label";

  const bodyTextarea = document.createElement("textarea");
  bodyTextarea.className = "chips-basecard-editor__textarea";
  bodyTextarea.value = props.initialConfig.body ?? "";
  bodyLabel.appendChild(bodyTextarea);
  form.appendChild(bodyLabel);

  const errorBox = document.createElement("div");
  errorBox.className = "chips-basecard-editor__errors";
  form.appendChild(errorBox);

  function validateAndEmit() {
    const next: BasecardConfig = {
      ...defaultBasecardConfig,
      ...props.initialConfig,
      title: titleInput.value,
      body: bodyTextarea.value,
    };

    const errors: string[] = [];
    if (!isNonEmptyString(next.title)) {
      errors.push("标题不能为空。");
    }
    if (!isNonEmptyString(next.body)) {
      errors.push("内容不能为空。");
    }

    errorBox.textContent = "";
    if (errors.length > 0) {
      const list = document.createElement("ul");
      list.className = "chips-basecard-editor__errors-list";
      for (const msg of errors) {
        const li = document.createElement("li");
        li.textContent = msg;
        list.appendChild(li);
      }
      errorBox.appendChild(list);
      return;
    }

    props.onChange(next);
  }

  titleInput.addEventListener("input", () => {
    validateAndEmit();
  });

  bodyTextarea.addEventListener("input", () => {
    validateAndEmit();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    validateAndEmit();
  });

  root.appendChild(form);
  return root;
}
