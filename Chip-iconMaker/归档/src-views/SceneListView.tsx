import { useMemo } from "react";
import {
  ChipsBadge,
  ChipsButton,
  ChipsSection,
  ChipsStack,
  ChipsText,
  ChipsVirtualList,
  type VirtualItem,
} from "@chips/component-library";
import {
  sceneDefinitions,
  type AppSceneDefinition,
  type AppSceneId,
} from "../app/scene-registry";
import { useAppText } from "../i18n/useAppText";

type SceneVirtualItem = VirtualItem & {
  scene: AppSceneDefinition;
};

export interface SceneListViewProps {
  activeSceneId: AppSceneId;
  onSelectScene(sceneId: AppSceneId): void;
}

export function SceneListView({ activeSceneId, onSelectScene }: SceneListViewProps) {
  const { text } = useAppText();
  const items = useMemo<SceneVirtualItem[]>(
    () => sceneDefinitions.map((scene) => ({
      value: scene.id,
      label: text(scene.titleKey),
      scene,
    })),
    [text],
  );

  return (
    <ChipsSection
      title={text("app.workspace.listTitle")}
      description={text("app.workspace.listDescription")}
    >
      <ChipsVirtualList
        items={items}
        height={160}
        itemHeight={56}
        ariaLabel={text("app.workspace.listTitle")}
        renderItem={(item) => {
          const sceneItem = item as SceneVirtualItem;
          const selected = sceneItem.scene.id === activeSceneId;
          return (
            <div className="app-scene-list__item">
              <ChipsStack gap="sm">
                <ChipsButton
                  type="button"
                  pressed={selected}
                  onPress={() => onSelectScene(sceneItem.scene.id)}
                >
                  {text(sceneItem.scene.titleKey)}
                </ChipsButton>
                <ChipsText>{text(sceneItem.scene.descriptionKey)}</ChipsText>
              </ChipsStack>
              {selected ? <ChipsBadge tone="success" label={text("app.shell.ready")} /> : null}
            </div>
          );
        }}
      />
      <ChipsText>{text("app.workspace.listDescription")}</ChipsText>
    </ChipsSection>
  );
}
