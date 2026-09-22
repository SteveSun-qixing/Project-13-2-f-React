/**
 * 契约测试的文档来源清单（唯一一处）。
 *
 * 每个条目给出「文档库相对路径 + 章节标题」，与 `薯片生态文档库/` 的真实结构一一对应；
 * 文档重构（改名、拆章）时只改本文件，检查逻辑不变。
 */

export interface SectionSelector {
  /** 文档库相对路径。 */
  readonly file: string;
  readonly level: 2 | 3 | 4;
  /** 章节标题（去 Markdown 格式后的前缀匹配文本）。 */
  readonly heading: string;
  /** 报告用的章节标注；缺省使用 `heading`。 */
  readonly section?: string;
}

export interface RoleSourceSelector {
  readonly role: RoleName;
  readonly selectors: readonly SectionSelector[];
}

export type RoleName = 'app' | 'basecard' | 'boxlayout' | 'service';

export const CAPABILITY_SOURCE = {
  file: '05-接口与契约/04.06-04-能力契约规范-六、权限映射（R19 全表）.md',
  level: 3,
  heading: '6.2 内置能力与权限总表',
  section: '六、权限映射（R19 全表）§6.2 内置能力与权限总表',
} as const satisfies SectionSelector;

export const PERMISSION_SOURCE = {
  file: '01-架构设计/01-子系统设计/08.04-08-权限系统设计-四、内置权限清单与映射.md',
  level: 3,
  heading: '4.1 内置权限清单总表',
  section: '四、内置权限清单与映射§4.1 内置权限清单总表',
} as const satisfies SectionSelector;

/** 权限审计条目权威形状（《08.08 链路四：审计》§8.2 代码块 + 字段说明表）。 */
export const PERMISSION_AUDIT_ENTRY_SOURCE = {
  file: '01-架构设计/01-子系统设计/08.08-08-权限系统设计-八、链路四：审计.md',
  level: 3,
  heading: '8.2 审计记录字段',
  section: '八、链路四：审计§8.2 审计记录字段',
} as const satisfies SectionSelector;

export const EVENT_RESERVED_DOMAIN_SOURCE = {
  file: '05-接口与契约/05.02-05-事件契约规范-二、命名契约.md',
  level: 3,
  heading: '2.2 平台保留域',
  section: '二、命名契约§2.2 平台保留域',
} as const satisfies SectionSelector;

/** 标准事件声明文件（与《05-事件契约规范》第四节各分册一一对应）。 */
export const EVENT_DECLARATION_FILES: readonly string[] = [
  '05-接口与契约/05.05-05-事件契约规范-四、标准事件-4.1 插件生命周期.md',
  '05-接口与契约/05.06-05-事件契约规范-四、标准事件-4.2 文档.md',
  '05-接口与契约/05.07-05-事件契约规范-四、标准事件-4.3 文件.md',
  '05-接口与契约/05.08-05-事件契约规范-四、标准事件-4.4 资源.md',
  '05-接口与契约/05.09-05-事件契约规范-四、标准事件-4.5 配置.md',
  '05-接口与契约/05.10-05-事件契约规范-四、标准事件-4.6 安全与审计.md',
  '05-接口与契约/05.11-05-事件契约规范-四、标准事件-4.7 窗口与应用.md',
  '05-接口与契约/05.12-05-事件契约规范-四、标准事件-4.8 同步.md',
  '05-接口与契约/05.04-05-事件契约规范-四、标准事件.md',
  '05-接口与契约/05.13-05-事件契约规范-四、标准事件-4.10 托盘、快捷键与传输.md',
];

export interface ErrorSourceSelector extends SectionSelector {
  /** 来源说明（进入报告与偏差定位）。 */
  readonly note: string;
}

/** 错误码权威表清单：与文档库现有错误码章节一一对应。 */
export const ERROR_SOURCES: readonly ErrorSourceSelector[] = [
  {
    file: '01-架构设计/01-子系统设计/02.09-02-Bridge三层设计-九、错误归一.md',
    level: 3,
    heading: '9.2 Bridge 错误码表',
    note: 'Bridge 通道级错误码',
  },
  {
    file: '05-接口与契约/04.26-04-能力契约规范-十一、错误码.md',
    level: 3,
    heading: '11.2 注册与契约错误码',
    note: '能力注册与契约错误码',
  },
  {
    file: '05-接口与契约/04.26-04-能力契约规范-十一、错误码.md',
    level: 3,
    heading: '11.3 调用错误码',
    note: '能力调用相关错误码',
  },
  {
    file: '05-接口与契约/04.26-04-能力契约规范-十一、错误码.md',
    level: 3,
    heading: '11.4 各域业务错误码',
    note: '内置能力各域业务错误码',
  },
  {
    file: '05-接口与契约/05.18-05-事件契约规范-八、错误码.md',
    level: 2,
    heading: '八、错误码',
    note: '事件契约错误码',
  },
  {
    file: '01-架构设计/01-子系统设计/08.09-08-权限系统设计-九、拒绝错误码与提示.md',
    level: 3,
    heading: '9.1 错误码总表',
    note: '权限拒绝错误码',
  },
  {
    file: '01-架构设计/01-子系统设计/01.09-01-薯片内核设计-九、错误传播.md',
    level: 2,
    heading: '九、错误传播',
    note: '内核错误码',
  },
  {
    file: '05-接口与契约/06.07-06-资源协议规范-七、错误码.md',
    level: 2,
    heading: '七、错误码',
    note: '资源协议错误码',
  },
  {
    file: '01-架构设计/01-子系统设计/06.08-06-文档解析器设计-八、错误与修复策略.md',
    level: 3,
    heading: '8.2 致命错误码',
    note: '文档解析致命错误码',
  },
  {
    file: '01-架构设计/01-子系统设计/10.04-10-配置系统设计-四、Schema 与校验.md',
    level: 3,
    heading: '4.4 错误码',
    note: '配置系统错误码',
  },
  {
    file: '01-架构设计/01-子系统设计/11.10-11-文档服务设计-十、错误码.md',
    level: 2,
    heading: '十、错误码',
    note: '文档服务错误码',
  },
  {
    file: '01-架构设计/01-子系统设计/12.09-12-编辑引擎设计-九、错误与降级.md',
    level: 2,
    heading: '九、错误与降级',
    note: '编辑引擎错误码',
  },
  {
    file: '01-架构设计/01-子系统设计/05.11-05-渲染引擎设计-十一、错误模型.md',
    level: 2,
    heading: '十一、错误模型',
    note: '渲染引擎错误码',
  },
  {
    file: '05-接口与契约/13.07-13-命令系统契约-七、冲突与错误.md',
    level: 2,
    heading: '七、冲突与错误',
    note: '命令系统错误码',
  },
  {
    file: '05-接口与契约/14.10-14-资源打开与默认处理器契约-十、错误码.md',
    level: 2,
    heading: '十、错误码',
    note: '资源打开链路错误码',
  },
  {
    file: '05-接口与契约/15.06-15-文件处理契约-六、错误码.md',
    level: 2,
    heading: '六、错误码',
    note: '文件处理契约错误码',
  },
  {
    file: '05-接口与契约/07.08-07-应用插件接口-八、错误处理.md',
    level: 2,
    heading: '八、错误处理',
    note: '应用插件错误码',
  },
  {
    file: '05-接口与契约/08.16-08-基础卡片插件接口-十、错误与约束.md',
    level: 3,
    heading: '10.1 错误码',
    note: '基础卡片插件错误码',
  },
  {
    file: '05-接口与契约/16.18-16-卡片传输协议-八、错误码.md',
    level: 3,
    heading: '8.2 客户端错误码',
    note: '卡片传输客户端错误码',
  },
  {
    file: '05-接口与契约/04.23-04-能力契约规范-八、内容处理服务能力.md',
    level: 3,
    heading: '8.6 错误码',
    note: '内容处理服务代表性错误码',
  },
  {
    file: '04-文件格式规范/03.08-03-插件包格式-八、错误码.md',
    level: 2,
    heading: '八、错误码',
    note: '插件包校验错误码',
  },
];

/** 错误码表的关键来源（用于按域精确比对实现侧登记表）。 */
export const BRIDGE_ERROR_SOURCE = ERROR_SOURCES[0] as ErrorSourceSelector;
export const EVENT_ERROR_SOURCE = ERROR_SOURCES[4] as ErrorSourceSelector;
export const PERMISSION_ERROR_SOURCE = ERROR_SOURCES[5] as ErrorSourceSelector;
export const KERNEL_ERROR_SOURCE = ERROR_SOURCES[6] as ErrorSourceSelector;
export const RESOURCE_ERROR_SOURCE = ERROR_SOURCES[7] as ErrorSourceSelector;
export const CAPABILITY_REGISTRATION_ERROR_SOURCE = ERROR_SOURCES[1] as ErrorSourceSelector;

/** 四角色接口快照来源。 */
export const ROLE_SOURCES: readonly RoleSourceSelector[] = [
  {
    role: 'app',
    selectors: [
      {
        file: '05-接口与契约/07.02-07-应用插件接口-二、接口总览.md',
        level: 2,
        heading: '二、接口总览',
        section: '二、接口总览',
      },
    ],
  },
  {
    role: 'basecard',
    selectors: [
      {
        file: '05-接口与契约/08.02-08-基础卡片插件接口-二、接口定义.md',
        level: 3,
        heading: '2.1 完整签名',
        section: '二、接口定义§2.1 完整签名',
      },
      {
        file: '05-接口与契约/08.03-08-基础卡片插件接口-三、BaseCardView 节点渲染视图模型.md',
        level: 2,
        heading: '三、BaseCardView 节点渲染视图模型',
        section: '三、BaseCardView 节点渲染视图模型',
      },
      {
        file: '05-接口与契约/08.04-08-基础卡片插件接口-四、IBaseCardEditor 编辑契约.md',
        level: 3,
        heading: '4.1 类型定义',
        section: '四、IBaseCardEditor 编辑契约§4.1 类型定义',
      },
    ],
  },
  {
    role: 'boxlayout',
    selectors: [
      {
        file: '05-接口与契约/09.03-09-箱子布局插件接口-三、IBoxLayoutPlugin 接口.md',
        level: 3,
        heading: '3.1 接口定义',
        section: '三、IBoxLayoutPlugin 接口§3.1 接口定义',
      },
      {
        file: '05-接口与契约/09.04-09-箱子布局插件接口-四、数据模型.md',
        level: 3,
        heading: '4.1 BoxRenderView',
        section: '四、数据模型§4.1 BoxRenderView',
      },
      {
        file: '05-接口与契约/09.04-09-箱子布局插件接口-四、数据模型.md',
        level: 3,
        heading: '4.2 EntryView',
        section: '四、数据模型§4.2 EntryView',
      },
      {
        file: '05-接口与契约/09.06-09-箱子布局插件接口-六、条目渲染与资源访问.md',
        level: 3,
        heading: '6.1 帧运行时契约',
        section: '六、条目渲染与资源访问§6.1 帧运行时契约',
      },
      {
        file: '05-接口与契约/09.07-09-箱子布局插件接口-七、布局编辑面板.md',
        level: 3,
        heading: '7.1 ILayoutEditor',
        section: '七、布局编辑面板§7.1 ILayoutEditor',
      },
    ],
  },
  {
    role: 'service',
    selectors: [
      {
        file: '05-接口与契约/10.02-10-服务插件接口-二、角色契约：IServicePlugin.md',
        level: 3,
        heading: '2.1 接口定义',
        section: '二、角色契约：IServicePlugin§2.1 接口定义',
      },
      {
        file: '05-接口与契约/10.03-10-服务插件接口-三、服务上下文：IServiceContext.md',
        level: 3,
        heading: '3.1 接口定义',
        section: '三、服务上下文：IServiceContext§3.1 接口定义',
      },
    ],
  },
];

/** 四角色的入口接口名（SDK 必须导出）。 */
export const ROLE_ENTRY_INTERFACES: Readonly<Record<RoleName, string>> = {
  app: 'IAppPlugin',
  basecard: 'IBaseCardPlugin',
  boxlayout: 'IBoxLayoutPlugin',
  service: 'IServicePlugin',
};

export const SDK_EXPORT_SOURCE = {
  file: '05-接口与契约/02.02-02-SDK-API规范-二、导出入口.md',
  level: 3,
  heading: '2.2 主入口导出清单',
  section: '二、导出入口§2.2 主入口导出清单',
} as const satisfies SectionSelector;

export const SDK_PACKAGE_ENTRY_SOURCE = {
  file: '05-接口与契约/02.02-02-SDK-API规范-二、导出入口.md',
  level: 3,
  heading: '2.1 包入口',
  section: '二、导出入口§2.1 包入口',
} as const satisfies SectionSelector;

export const FRAME_PROTOCOL_SOURCE = {
  file: '01-架构设计/01-子系统设计/05.09-05-渲染引擎设计-九、高度自适应与宿主-内容通信协议.md',
  level: 2,
  heading: '九、高度自适应与宿主-内容通信协议',
  section: '九、高度自适应与宿主-内容通信协议',
} as const satisfies SectionSelector;

export const FRAME_ENVELOPE_SECTION = '9.2 消息封套';
export const FRAME_MESSAGE_TABLE_SECTION = '9.3 消息清单与约束';

/** 帧协议声明的方向标记（与文档正文逐字一致）。 */
export const FRAME_DIRECTION_MARKERS = {
  childToParent: '--- 子帧 → 父帧 ---',
  parentToChild: '--- 父帧 → 子帧 ---',
} as const;
