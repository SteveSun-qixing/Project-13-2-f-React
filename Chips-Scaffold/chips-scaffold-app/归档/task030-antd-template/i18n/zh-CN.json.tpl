{
  "app": {
    "identity": {
      "displayName": "{{ DISPLAY_NAME }}"
    },
    "shell": {
      "subtitle": "应用工作区",
      "languageSwitch": "切换到 {locale}",
      "navigationLabel": "应用场景",
      "contentLabel": "主要内容",
      "detailLabel": "运行环境",
      "ready": "运行环境已就绪",
      "loading": "正在读取运行环境"
    },
    "scenes": {
      "main": {
        "title": "工作区",
        "description": "当前应用场景与视图状态"
      },
      "settings": {
        "title": "设置",
        "description": "应用偏好与环境状态"
      }
    },
    "commands": {
      "sectionTitle": "命令",
      "openWorkspace": {
        "title": "打开工作区",
        "description": "聚焦主应用场景",
        "ariaLabel": "打开工作区"
      },
      "refreshTheme": {
        "title": "刷新主题状态",
        "description": "重新读取 Host 当前主题状态",
        "ariaLabel": "刷新主题状态",
        "disabledReason": "当前运行环境不允许读取主题状态"
      },
      "menu": {
        "app": "应用",
        "ariaLabel": "应用命令菜单"
      },
      "toolbar": {
        "ariaLabel": "主工具栏"
      },
      "palette": {
        "searchPlaceholder": "搜索命令",
        "ariaLabel": "命令面板"
      },
      "status": {
        "idle": "命令系统等待注册",
        "registering": "正在注册命令",
        "ready": "命令已注册",
        "error": "命令运行时需要检查",
        "lastInvoked": "最近触发：{commandId}（来源：{source}）",
        "errorWithCode": "命令错误：{code}"
      }
    },
    "cli": {
      "open": {
        "title": "打开 {{ DISPLAY_NAME }}",
        "description": "从命令行打开应用容器并传入启动参数",
        "subjectPlaceholder": "输入要传递给应用的文本参数"
      }
    },
    "workspace": {
      "overviewTitle": "运行概览",
      "overviewDescription": "应用通过 Host surface、SDK 和组件库运行。",
      "formTitle": "状态绑定",
      "formDescription": "输入状态由组件库状态模型维护。",
      "formLabel": "标题",
      "formPlaceholder": "输入应用内标题",
      "formAction": "更新状态",
      "listTitle": "场景列表",
      "listDescription": "场景定义由应用注册表维护。",
      "emptyTitle": "暂无诊断",
      "emptyDescription": "当前没有需要处理的运行时诊断。",
      "emptyAction": "刷新诊断",
      "environmentTitle": "Host 环境",
      "themeLabel": "当前主题",
      "localeLabel": "当前语言",
      "surfaceLabel": "当前容器",
      "permissionLabel": "命令权限",
      "diagnosticsLabel": "诊断数量",
      "permissionReady": "可调用命令",
      "permissionMissing": "缺少 command.invoke",
      "unknown": "未知",
      "error": "环境读取错误：{code}"
    },
    "runtime": {
      "sectionTitle": "运行时诊断",
      "sectionDescription": "当前 scene、surface、命令与诊断状态。",
      "iconLabel": "运行状态",
      "commandErrorDescription": "命令运行时错误：{code}",
      "errorTitle": "运行时需要检查",
      "errorDescription": "应用运行时报告了需要处理的诊断。",
      "refreshAction": "重新读取环境",
      "status": {
        "ready": "运行时已就绪",
        "error": "运行时存在诊断"
      },
      "dialog": {
        "open": "查看运行上下文",
        "title": "运行上下文",
        "description": "Host 提供的 scene 与 surface 信息。",
        "sceneId": "场景：{value}",
        "surfaceId": "容器：{value}",
        "sessionId": "会话：{value}",
        "diagnostics": "诊断数量：{count}",
        "close": "关闭"
      }
    },
    "errors": {
      "boundaryTitle": "应用运行异常",
      "boundaryDescription": "运行时边界捕获到异常。",
      "retry": "重试"
    }
  }
}
