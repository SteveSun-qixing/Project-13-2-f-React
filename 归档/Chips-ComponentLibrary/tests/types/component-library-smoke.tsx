import {
  ChipsButton,
  ChipsEnvironmentProvider,
  ChipsStack,
  ChipsThemeProvider,
  ChipsView,
  CompositeWindowMode,
  createBinding,
  type CardDisplayAdapter,
  type ChipsBinding,
  type ChipsClientLike,
  type ChipsEnvironmentValue,
  loadCompositeWindowData,
  toCardRuntimeStandardError,
  toComponentStandardError,
  useBinding,
  useChipsAsyncState,
  useChipsBinding,
  useChipsI18nText,
  useChipsClient,
  useChipsDiagnostics,
  useChipsEnvironment,
  useChipsFormState,
  useChipsI18n,
  useChipsPermission,
  useChipsState,
  useChipsSurface,
  useChipsTheme,
  useFieldBinding
} from "@chips/component-library";
import {
  createFocusScope,
  createKeyboardMap,
  createRovingTabIndex,
  getKeyboardAction,
  trapFocus,
  type KeyboardMap,
  type RovingTabIndexModel
} from "@chips/a11y";
import {
  assertActiveDescendant,
  assertRovingTabIndex,
  createFocusTrapFixture,
  createKeyboardEventFixture,
  runKeyboardSequence
} from "@chips/testing";

const adapter: CardDisplayAdapter = {
  async resolveCoverFrame(input) {
    return {
      cardId: input.cardId ?? "demo-card",
      title: "Demo Card",
      ratio: "3:4",
      coverUrl: "https://example.com/cover.html"
    };
  },
  async resolveCompositeWindow(input) {
    return {
      cardId: input.cardFile,
      frameUrl: "https://example.com/frame.html",
      nodeCount: input.mode === CompositeWindowMode.VIEW ? 1 : 2
    };
  }
};

void loadCompositeWindowData(adapter, {
  cardFile: "/cards/demo.card",
  mode: CompositeWindowMode.VIEW
});

void loadCompositeWindowData(adapter, {
  cardFile: "/cards/demo.card",
  // @ts-expect-error composite window mode must remain within the formal contract
  mode: "edit"
});

const componentError = toComponentStandardError(new Error("component"));
const runtimeError = toCardRuntimeStandardError(new Error("runtime"), "CARD_RUNTIME_SMOKE");
const titleBinding: ChipsBinding<string> = createBinding({
  defaultValue: "Draft",
  name: "title"
});
const titleProps = titleBinding.valueProps();
titleProps.onValueChange("Published");
const inputProps = titleBinding.inputProps();
inputProps.onChange({ target: { value: "Typed" } });
const checkedBinding = createBinding({ defaultValue: false });
checkedBinding.checkedProps().onCheckedChange(true);
createBinding({ defaultValue: false }).openProps().onOpenChange(true);

const keyboardMap: KeyboardMap = createKeyboardMap({
  submit: ["Enter", " "],
  cancel: "Escape"
});
const keyboardAction: string | null = getKeyboardAction({ key: "Enter" }, keyboardMap);
void keyboardAction;

const focusTrap = createFocusTrapFixture(["first", "last"]);
const focusScope = createFocusScope(focusTrap.root, {
  restorePoint: {
    element: focusTrap.first,
    restore() {
      focusTrap.first?.focus();
      return focusTrap.first;
    }
  }
});
focusScope.focusFirst();
trapFocus(createKeyboardEventFixture("Tab"), focusTrap.root, {
  current: focusTrap.last
});

const roving: RovingTabIndexModel<{ id: string; disabled?: boolean }> = createRovingTabIndex(
  [
    { id: "first" },
    { id: "disabled", disabled: true },
    { id: "last" }
  ],
  { activeId: "first" }
);
assertRovingTabIndex(
  roving.items.map((item) => ({
    id: item.id,
    disabled: item.disabled,
    tabIndex: item.tabIndex
  })),
  "first"
);
assertActiveDescendant({ "aria-activedescendant": "first" }, "first");

runKeyboardSequence(
  {
    onKeyDown(event: unknown) {
      void event;
    }
  },
  ["ArrowDown", "Enter"]
);

const mockClient: ChipsClientLike = {
  events: {
    on() {
      return () => undefined;
    }
  },
  theme: {
    async getCurrent() {
      return { themeId: "chips-official.default-theme", displayName: "Default", version: "1.0.0" };
    },
    async apply() {
      return undefined;
    }
  },
  i18n: {
    async getCurrent() {
      return "zh-CN";
    },
    async setCurrent() {
      return undefined;
    },
    async translate(key) {
      return key;
    }
  }
};

function EnvironmentSmoke(): null {
  const environment: ChipsEnvironmentValue = useChipsEnvironment();
  const client = useChipsClient();
  const theme = useChipsTheme();
  const i18n = useChipsI18n();
  const text = useChipsI18nText({
    bundles: {
      "zh-CN": {
        demo: {
          title: "演示"
        }
      }
    },
    fallbackLocale: "en-US"
  });
  const surface = useChipsSurface();
  const permission = useChipsPermission();
  const diagnostics = useChipsDiagnostics();

  void environment.refresh();
  void client;
  void theme.refresh();
  void i18n.t("demo.title");
  void text("demo.title");
  void surface.refresh();
  void permission.hasPermission("theme.read");
  void diagnostics.clear();
  return null;
}

function BindingSmoke(): null {
  const localState = useChipsState(0, {
    name: "counter",
    onChange(value, event) {
      const previous: number = event.previousValue;
      void previous;
      void value;
    }
  });
  const directBinding = useBinding({ defaultValue: "draft" });
  const chipsBinding = useChipsBinding(directBinding);
  const asyncState = useChipsAsyncState(async (id: unknown) => `item:${String(id)}`);
  const form = useChipsFormState({
    title: "Draft",
    enabled: false
  });
  const fieldBinding = useFieldBinding<string>(form, "title");

  localState.setValue((value) => value + 1);
  localState.binding.valueProps().onValueChange(2);
  directBinding.valueProps().onValueChange("value");
  chipsBinding.inputProps().onChange({ target: { value: "typed" } });
  form.getFieldBinding<string>("title").valueProps().onValueChange("Published");
  form.getFieldBinding<boolean>("enabled").checkedProps().onCheckedChange(true);
  fieldBinding.valueProps().onValueChange("Final");
  void asyncState.run("42");
  return null;
}

export const smokeTree = (
  <ChipsEnvironmentProvider client={mockClient}>
    <ChipsThemeProvider themeId="chips-official.default-theme" version="1.0.0">
      <ChipsView title="Demo" aria-label="Demo view">
        <ChipsStack gap="8px">
          <EnvironmentSmoke />
          <BindingSmoke />
          <ChipsButton
            variant="primary"
            onPress={() => {
              console.log(componentError.code, runtimeError.code);
            }}
          >
            Save
          </ChipsButton>
        </ChipsStack>
      </ChipsView>
    </ChipsThemeProvider>
  </ChipsEnvironmentProvider>
);
