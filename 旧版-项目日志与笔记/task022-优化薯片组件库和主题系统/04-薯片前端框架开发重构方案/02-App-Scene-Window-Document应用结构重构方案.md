# 重构方案：App / Scene / Window / Document 应用结构

## 1. 目标

建立薯片应用结构能力，让应用开发者可以用声明式方式定义应用结构：

- 应用入口。
- 主窗口。
- 多窗口组。
- 文档窗口。
- 设置窗口。
- 工具窗口。
- 菜单栏/托盘入口。
- 场景生命周期。
- 命令注册。

该框架必须以 Host `surface` 为中心设计。Desktop 下 `ChipsWindowGroup` 可以落为 Electron BrowserWindow，但公共语义仍应是 `surface`，不能让插件直接管理原生窗口。

## 2. 现有项目落点

| 模块 | 职责 |
|---|---|
| Host surface service | 跨平台界面容器主语义，Desktop 下映射为窗口 |
| Host window service | Desktop 兼容别名，承接 Electron BrowserWindow 生命周期、状态持久化、窗口背景 |
| Host plugin runtime | 插件会话、权限、sceneId、surfaceId |
| SDK | App/Scene/Command 的类型化封装、Bridge 调用入口、测试辅助 |
| `chips-scaffold-app` | 默认模板、manifest 示例、应用入口样板、测试基线 |

当前不需要单独创建应用框架项目。如果未来这组声明 API 发展到需要独立发布和独立版本管理，再重新开工单评估。

## 3. 核心 API 方向

建议能力：

- `createChipsApp`
- `ChipsApp`
- `ChipsScene`
- `ChipsWindowGroup`
- `ChipsDocumentScene`
- `ChipsSettingsScene`
- `ChipsToolWindowScene`
- `ChipsScenePhase`
- `useScenePhase`
- `ChipsCommands`

示意：

```tsx
createChipsApp({
  manifest,
  scenes: (
    <ChipsApp>
      <ChipsWindowGroup id="main" titleKey="app.title">
        <MainPage />
      </ChipsWindowGroup>

      <ChipsDocumentScene
        id="card-document"
        fileTypes={["card"]}
        titleKey="document.card.title"
      >
        <CardEditor />
      </ChipsDocumentScene>

      <ChipsSettingsScene>
        <SettingsPage />
      </ChipsSettingsScene>
    </ChipsApp>
  )
});
```

## 4. 关键任务

1. 定义 App/Scene/Window/Document 类型模型。
2. 将 scene 声明与 manifest 校验打通。
3. 将 scene 生命周期与 Host plugin runtime、surface service 打通。
4. 定义 document dirty state、save、save as、close protection。
5. 定义 scene-level storage。
6. 定义窗口状态持久化：尺寸、位置、最大化、分屏、最近文档。
7. 设置页接入 config 服务和 i18n。
8. 命令系统接入 app scene。

## 5. 验收标准

- 应用可以只通过 App Framework 声明主窗口、设置窗口和文档窗口。
- Host 能根据声明创建/恢复/关闭窗口。
- 文档场景支持打开、创建、保存、关闭保护。
- 主题、多语言、权限、sceneId、windowId 能从环境读取。
- 脚手架默认生成符合该结构的应用。
