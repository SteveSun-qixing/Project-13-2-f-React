import { Flex, Button, Space, Typography, Card } from "antd";
import {
  FileWordOutlined,
  FilePptOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
} from "@ant-design/icons";
import { SceneListView } from "../views/SceneListView";
import { StateBindingView } from "../views/StateBindingView";
import { WorkspaceOverviewView } from "../views/WorkspaceOverviewView";
import { useAppRuntime } from "../app/AppRuntimeProvider";

const { Title, Text } = Typography;

export function MainScene() {
  const runtime = useAppRuntime();

  const handleOpenWord = () => {
    runtime.setActiveSceneId("word-editor");
  };

  const handleOpenSlide = () => {
    runtime.setActiveSceneId("slide");
  };

  const handleOpenSheet = () => {
    runtime.setActiveSceneId("sheet");
  };

  return (
    <Flex vertical gap={16}>
      <WorkspaceOverviewView />
      <div className="app-shell__view-grid">
        <StateBindingView />
        <SceneListView />
      </div>
      <Card title="文档编辑器" variant="borderless">
        <Space size="middle" wrap>
          <Button
            icon={<FileWordOutlined />}
            onClick={handleOpenWord}
            size="large"
          >
            Word 文档
          </Button>
          <Button
            icon={<FilePptOutlined />}
            onClick={handleOpenSlide}
            size="large"
          >
            PowerPoint 演示
          </Button>
          <Button
            icon={<FileExcelOutlined />}
            onClick={handleOpenSheet}
            size="large"
          >
            Excel 表格
          </Button>
          <Button
            icon={<FilePdfOutlined />}
            onClick={() => runtime.setActiveSceneId("document")}
            size="large"
          >
            PDF 查看器
          </Button>
        </Space>
      </Card>
    </Flex>
  );
}
