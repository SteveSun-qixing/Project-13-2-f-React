import { ChipsGrid, ChipsStack } from "@chips/component-library";
import { SceneListView } from "../views/SceneListView";
import { StateBindingView } from "../views/StateBindingView";
import { WorkspaceOverviewView } from "../views/WorkspaceOverviewView";
import type { AppSceneId } from "../app/scene-registry";

export interface MainSceneProps {
  activeSceneId: AppSceneId;
  onSelectScene(sceneId: AppSceneId): void;
}

export function MainScene({ activeSceneId, onSelectScene }: MainSceneProps) {
  return (
    <ChipsStack gap="lg">
      <WorkspaceOverviewView />
      <ChipsGrid className="app-view-grid" minItemSize="16rem" gap="md">
        <StateBindingView />
        <SceneListView activeSceneId={activeSceneId} onSelectScene={onSelectScene} />
      </ChipsGrid>
    </ChipsStack>
  );
}
