import { Flex } from "antd";
import { SceneListView } from "../views/SceneListView";
import { StateBindingView } from "../views/StateBindingView";
import { WorkspaceOverviewView } from "../views/WorkspaceOverviewView";

export function MainScene() {
  return (
    <Flex vertical gap={16}>
      <WorkspaceOverviewView />
      <div className="app-shell__view-grid">
        <StateBindingView />
        <SceneListView />
      </div>
    </Flex>
  );
}
