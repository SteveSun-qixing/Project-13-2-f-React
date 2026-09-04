import { Button, Card, Tag, Typography } from "antd";
import { PanelHeader } from "@chips/ui";
import { useAppRuntime } from "../app/AppRuntimeProvider";
import { sceneDefinitions } from "../app/scene-registry";
import { formatMessage } from "../lib/messages";

export function SceneListView() {
  const runtime = useAppRuntime();

  return (
    <Card className="app-shell__section" variant="borderless">
      <PanelHeader
        title={formatMessage("app.workspace.listTitle")}
        description={formatMessage("app.workspace.listDescription")}
      />
      <div className="app-shell__scene-list">
        {sceneDefinitions.map((scene) => {
          const selected = scene.id === runtime.activeSceneId;
          return (
            <div className="app-shell__scene-list-item" key={scene.id}>
              <div className="app-shell__scene-list-copy">
                <span className="app-shell__scene-list-title">{scene.title}</span>
                <span className="app-shell__scene-list-description">
                  {scene.description}
                </span>
              </div>
              {selected ? (
                <Tag color="success">{formatMessage("app.shell.ready")}</Tag>
              ) : (
                <Button
                  type="text"
                  size="small"
                  onClick={() => runtime.setActiveSceneId(scene.id)}
                >
                  <Typography.Text>{scene.title}</Typography.Text>
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
