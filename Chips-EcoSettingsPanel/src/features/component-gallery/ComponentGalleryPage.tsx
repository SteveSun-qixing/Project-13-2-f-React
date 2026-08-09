import React from "react";
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Divider,
  Dropdown,
  Empty,
  Flex,
  Input,
  InputNumber,
  Modal,
  Popover,
  Progress,
  Radio,
  Rate,
  Segmented,
  Select,
  Skeleton,
  Slider,
  Spin,
  Switch,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  type MenuProps,
} from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  FolderOpenOutlined,
  HomeOutlined,
  InfoCircleOutlined,
  SettingOutlined,
  StarOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useI18n } from "../../app/providers/I18nProvider";
import { PageFrame } from "../../shared/ui/PageFrame";
import { SettingsSection } from "../../shared/ui/SettingsSection";

interface GalleryItemProps {
  label: string;
  children: React.ReactNode;
}

function GalleryItem({ label, children }: GalleryItemProps): React.ReactElement {
  return (
    <div className="gallery-item">
      <div className="gallery-item__demo">{children}</div>
      <span className="gallery-item__label">{label}</span>
    </div>
  );
}

function GalleryRow({ label, children }: GalleryItemProps): React.ReactElement {
  return (
    <div className="gallery-row">
      <span className="gallery-row__label">{label}</span>
      <div className="gallery-row__demo">{children}</div>
    </div>
  );
}

const dropdownItems: MenuProps["items"] = [
  { key: "1", label: "新建" },
  { key: "2", label: "打开" },
  { key: "3", label: "保存" },
];

const tableData = [
  { key: "1", name: "卡片文件", size: "2.4 MB" },
  { key: "2", name: "箱子文件", size: "18.6 MB" },
  { key: "3", name: "主题包", size: "860 KB" },
];

const tableColumns = [
  { title: "名称", dataIndex: "name", key: "name" },
  { title: "大小", dataIndex: "size", key: "size" },
];

const ICON_SET = [
  { icon: <HomeOutlined />, name: "Home" },
  { icon: <FolderOpenOutlined />, name: "Folder" },
  { icon: <SettingOutlined />, name: "Setting" },
  { icon: <UserOutlined />, name: "User" },
  { icon: <StarOutlined />, name: "Star" },
  { icon: <CheckCircleOutlined />, name: "Check" },
  { icon: <CloseCircleOutlined />, name: "Close" },
  { icon: <InfoCircleOutlined />, name: "Info" },
  { icon: <ExclamationCircleOutlined />, name: "Alert" },
];

export function ComponentGalleryPage(): React.ReactElement {
  const { t } = useI18n();
  const [modalOpen, setModalOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState("tab-1");

  return (
    <PageFrame title={t("settingsPanel.componentGallery.title")}>
      <SettingsSection title={t("settingsPanel.componentGallery.group.button")}>
        <div className="gallery-grid">
          <GalleryItem label="Primary">
            <Button type="primary">主要按钮</Button>
          </GalleryItem>
          <GalleryItem label="Default">
            <Button>默认按钮</Button>
          </GalleryItem>
          <GalleryItem label="Danger">
            <Button danger>危险按钮</Button>
          </GalleryItem>
          <GalleryItem label="Text">
            <Button type="text">文字按钮</Button>
          </GalleryItem>
          <GalleryItem label="Disabled">
            <Button disabled>禁用按钮</Button>
          </GalleryItem>
          <GalleryItem label="Loading">
            <Button type="primary" loading>加载中</Button>
          </GalleryItem>
        </div>
      </SettingsSection>

      <SettingsSection title={t("settingsPanel.componentGallery.group.input")}>
        <div className="gallery-grid">
          <GalleryItem label="Input">
            <Input placeholder="请输入…" style={{ width: 200 }} />
          </GalleryItem>
          <GalleryItem label="Search">
            <Input.Search placeholder="搜索…" style={{ width: 200 }} />
          </GalleryItem>
          <GalleryItem label="TextArea">
            <Input.TextArea placeholder="多行文本…" style={{ width: 200 }} rows={2} />
          </GalleryItem>
          <GalleryItem label="Number">
            <InputNumber placeholder="数值" style={{ width: 200 }} />
          </GalleryItem>
        </div>
      </SettingsSection>

      <SettingsSection title={t("settingsPanel.componentGallery.group.select")}>
        <div className="gallery-grid">
          <GalleryItem label="Select">
            <Select
              style={{ width: 200 }}
              placeholder="请选择…"
              options={[
                { value: "card", label: "卡片" },
                { value: "box", label: "箱子" },
                { value: "plugin", label: "插件" },
              ]}
            />
          </GalleryItem>
          <GalleryItem label="Segmented">
            <Segmented options={["列表", "网格", "时间线"]} />
          </GalleryItem>
          <GalleryItem label="Radio">
            <Radio.Group options={["自动", "手动"]} defaultValue="自动" />
          </GalleryItem>
          <GalleryItem label="Checkbox">
            <Checkbox checked>已选中</Checkbox>
          </GalleryItem>
          <GalleryItem label="Switch">
            <Switch defaultChecked />
          </GalleryItem>
          <GalleryItem label="Slider">
            <Slider defaultValue={40} style={{ width: 200 }} />
          </GalleryItem>
        </div>
      </SettingsSection>

      <SettingsSection title={t("settingsPanel.componentGallery.group.feedback")}>
        <div className="gallery-grid">
          <GalleryItem label="Tag">
            <Tag color="blue">标签</Tag>
            <Tag>默认</Tag>
          </GalleryItem>
          <GalleryItem label="Badge">
            <Badge count={5}><span className="gallery-badge-anchor" /></Badge>
          </GalleryItem>
          <GalleryItem label="Alert">
            <Alert type="info" message="提示信息" showIcon style={{ width: 220 }} />
          </GalleryItem>
          <GalleryItem label="Progress">
            <Progress percent={64} style={{ width: 200 }} />
          </GalleryItem>
          <GalleryItem label="Rate">
            <Rate defaultValue={4} />
          </GalleryItem>
          <GalleryItem label="Spin">
            <Spin />
          </GalleryItem>
          <GalleryItem label="Skeleton">
            <Skeleton active paragraph={{ rows: 1 }} style={{ width: 220 }} />
          </GalleryItem>
          <GalleryItem label="Empty">
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无内容" />
          </GalleryItem>
        </div>
      </SettingsSection>

      <SettingsSection title={t("settingsPanel.componentGallery.group.overlay")}>
        <div className="gallery-grid">
          <GalleryItem label="Tooltip">
            <Tooltip title="工具提示"><Button>悬停提示</Button></Tooltip>
          </GalleryItem>
          <GalleryItem label="Popover">
            <Popover content="气泡内容" title="标题"><Button>点击气泡</Button></Popover>
          </GalleryItem>
          <GalleryItem label="Dropdown">
            <Dropdown menu={{ items: dropdownItems }}><Button>下拉菜单</Button></Dropdown>
          </GalleryItem>
          <GalleryItem label="Modal">
            <Button onClick={() => setModalOpen(true)}>打开弹窗</Button>
            <Modal open={modalOpen} title="弹窗标题" onOk={() => setModalOpen(false)} onCancel={() => setModalOpen(false)}>
              <p>弹窗内容区域。</p>
            </Modal>
          </GalleryItem>
        </div>
      </SettingsSection>

      <SettingsSection title={t("settingsPanel.componentGallery.group.data")}>
        <div className="gallery-grid">
          <GalleryItem label="Table">
            <Table
              size="small"
              columns={tableColumns}
              dataSource={tableData}
              pagination={false}
              style={{ width: 280 }}
            />
          </GalleryItem>
          <GalleryItem label="Tabs">
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              style={{ width: 280 }}
              items={[
                { key: "tab-1", label: "标签一", children: <p style={{ margin: 0 }}>标签一内容</p> },
                { key: "tab-2", label: "标签二", children: <p style={{ margin: 0 }}>标签二内容</p> },
              ]}
            />
          </GalleryItem>
        </div>
      </SettingsSection>

      <SettingsSection title={t("settingsPanel.componentGallery.group.icon")}>
        <div className="gallery-grid">
          {ICON_SET.map((entry) => (
            <GalleryItem key={entry.name} label={entry.name}>
              <span className="gallery-icon">{entry.icon}</span>
            </GalleryItem>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title={t("settingsPanel.componentGallery.group.typography")}>
        <div className="gallery-grid">
          <GalleryItem label="Title">
            <Typography.Title level={5} style={{ margin: 0 }}>标题文字</Typography.Title>
          </GalleryItem>
          <GalleryItem label="Text">
            <Typography.Text>正文文字</Typography.Text>
          </GalleryItem>
          <GalleryItem label="Secondary">
            <Typography.Text type="secondary">次要文字</Typography.Text>
          </GalleryItem>
          <GalleryItem label="Link">
            <Typography.Link>链接文字</Typography.Link>
          </GalleryItem>
        </div>
      </SettingsSection>

      <SettingsSection title="Divider / Flex">
        <GalleryRow label="Flex">
          <Flex gap={8}>
            <Button size="small">小</Button>
            <Button>中</Button>
            <Button size="large">大</Button>
          </Flex>
        </GalleryRow>
        <GalleryRow label="Divider">
          <div style={{ width: 320 }}>
            左侧内容<Divider type="vertical" />右侧内容
          </div>
        </GalleryRow>
      </SettingsSection>
    </PageFrame>
  );
}
