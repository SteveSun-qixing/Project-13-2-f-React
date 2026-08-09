import {
  ChipsButton,
  ChipsForm,
  ChipsSection,
  ChipsText,
  ChipsTextField,
  useChipsState,
} from "@chips/component-library";
import { createRuntimeDiagnostic, useAppRuntime } from "../app/AppRuntimeProvider";
import { useAppText } from "../i18n/useAppText";

export function StateBindingView() {
  const { text } = useAppText();
  const runtime = useAppRuntime();
  const titleState = useChipsState(text("app.identity.displayName"), {
    name: "app.workspace.title",
  });
  const titleProps = titleState.binding.valueProps<string>();

  function handleSubmit() {
    runtime.pushDiagnostic(createRuntimeDiagnostic(
      "APP_STATE_BINDING_UPDATED",
      "App state binding updated.",
      "app",
      {
        title: titleState.value,
      },
    ));
  }

  return (
    <ChipsSection
      title={text("app.workspace.formTitle")}
      description={text("app.workspace.formDescription")}
    >
      <ChipsForm onSubmit={(event) => event.preventDefault()}>
        <ChipsForm.Field name="title">
          <ChipsForm.Label>{text("app.workspace.formLabel")}</ChipsForm.Label>
          <ChipsForm.Control>
            <ChipsTextField
              name="title"
              placeholder={text("app.workspace.formPlaceholder")}
              value={titleProps.value}
              onValueChange={(value) => titleProps.onValueChange(value)}
            />
          </ChipsForm.Control>
          <ChipsForm.Hint>
            <ChipsText>{titleState.value}</ChipsText>
          </ChipsForm.Hint>
        </ChipsForm.Field>
        <ChipsButton type="button" onPress={handleSubmit}>
          {text("app.workspace.formAction")}
        </ChipsButton>
      </ChipsForm>
    </ChipsSection>
  );
}
