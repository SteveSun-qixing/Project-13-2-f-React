# W5 迁移：薯片社区（community-client）起步臂开发日志

> 日期：2026-10-01
> 任务：派单行表 #8（薯片社区 `chips.official.community-client` / `plugins/apps/community-client`，可立即派·三段式第③段起步臂）；本臂不做端到端。
> 包：`chips-ecosystem/plugins/apps/community-client/`（分支「第五次重构」，全程零 git 写操作，未跑 `gates:all`）
> 底册：勘查报告行 #8 + 《旧功能覆盖矩阵-音乐富文本社区客户端》§四（96 行=迁1/重51/留7/废13/档24）+ 《旧功能覆盖矩阵-三插件仓库》CommunityUploader 行（关键裁决：CommunityUploader 不单列插件，功能由卡片传输协议 + 社区客户端承载；publisher/card-rewrite 作为实现材料）
> 权威文档：《16-社区客户端设计》§二~§九、《16-卡片传输协议》§四（改写与还原）、《11-社区平台API契约》§二/§4.5/§4.6/§七、《13-命令系统契约》、《06-资源协议规范》§二
> 母型：notes 领域层起步臂 + settings 偏好会话内存降级（工单066 同源）+ photo-viewer 假桥舞台集成测试形制

---

## 一、交付清单

| 交付面 | 判定 | 落点 | 说明 |
|---|---|---|---|
| 卡片路径归一 | 重写（实现材料迁入领域层） | `src/domain/community/cardPaths.ts` | 16-传输协议 §4.2 纯函数化：相对路径规范化（`/` 分隔、NFC、无 `..`、无前导 `/`，越包根整体拒绝）、结构性文件判定（`.card/metadata|structure.yaml`、`.card/cover.html`、`content/*.yaml`）、系统生成物排除（`__MACOSX/`、`.DS_Store`、`Thumbs.db`、`desktop.ini`、隐藏末段；`.card/cardcover/*` 不受影响仍按资源）、资源枚举稳定排序、重复路径检出（§4.2 第 5 条）、外部引用判定（`scheme:`/`//`/`#`）、`?query`/`#fragment` 后缀分离保留、双候选解析（卡片根相对 + 引用所在文件目录相对，POSIX 语义去重保序）。旧 `Chips-CommunityUploader-Plugin/src/card-rewrite.ts` 素材逐函数对照迁移，剔除 `node:path` 依赖（渲染上下文可用） |
| YAML/cover.html 资源改写与还原 | 重写（实现材料迁入领域层） | `src/domain/community/cardRewrite.ts` | 16-传输协议 §4.3/§4.5 纯函数化：`content/*.yaml` 一般字符串值命中映射整体替换保留后缀、结构化资源字段 `source:file+file_path → source:url+url`、富文本 `base.richtext` 文件化正文 `content_source:file+content_file → inline+content_text`（旧 `RichTextCard` 别名不识别，ADR-010 零兼容，rte G-5 同口径）、cover.html `="…"` 属性值与 `url(…)` 替换保留引号与后缀、`.card/metadata|structure.yaml` 不改写；逆改写只接受映射内还原、未命中原样保留；YAML 解析失败上传侧 `CARD_TRANSFER_UPLOAD_FAILED` / 还原侧 `CARD_TRANSFER_RESTORE_FAILED`（`details.reason`），错误码取 §八 在册表不自制。旧 card-rewrite.ts + 旧 transfer 测试断言面（上传改写→下载还原往返）随迁 |
| 可逆恢复清单消费面 | 重写 | `src/domain/community/restoreManifest.ts` | 16-传输协议 §4.4 线上 schema `1.0.0` 的类型化消费面：结构校验（缺清单 `null` → 上层 `CARD_TRANSFER_MANIFEST_MISSING`；版本不受支持/必填结构非法 → `CARD_TRANSFER_MANIFEST_INVALID`）、`URL→原始相对路径` 与富文本 `configPath→contentFile` 映射构建（§4.5 第 4 步）、建议下载文件名 |
| 社区内容模型 | 重写 | `src/domain/community/contentModel.ts` | 《11-契约》§4.5/§4.6 DTO 逐字段类型面（卡片状态三值、`viewState`、可见性、10 位 Base62 文件级 ID + UUID v4 实体 ID）+ 纯投影：作品网格条目与选取键（旧 `CommunityWorkItem` 领域划分保留）、封面比例解析（旧 `lib/ui.ts` 纯 helper 作重写素材随件迁移，缺省 `3:4`）、远程封面归一 `chips-resource://external/<scheme>/<host>[:port]<path><query>`（06-资源协议 §2.6 语法表逐条：scheme/host 小写、默认端口去除、path 大小写保持、IDN punycode、IPv6 方括号编码；非 http(s) 返回 `null` 展示占位）、`ready` 传输门控（16-CC §4.2）、箱子条目缺题占位、简体中文状态/可见性标签 |
| 路由表与守卫 | 重写 | `src/domain/community/routeTable.ts` | 16-CC §3.2 路由表逐行（`/`、`/about`、`/login`、`/register`、`/@:username`、`/workspace`、`/cards/:cardId`、`/boxes/:boxId`、`/admin`、`/settings`、`*`）纯函数解析/序列化/往返稳定；守卫 §3.2 访问规则 + §3.3（未登录访问工作区 → `/login`；已登录访问登录/注册 → 个人主页）；参数合法性守卫（非空、无分隔空白、可解码），路径参数取服务器回包标识不自造 |
| 服务器配置 | 重写 | `src/domain/community/serverConfig.ts` | 16-CC §5.3：默认基址 `https://www.chipscard.space`、自身命名空间 `plugins.chips.official.community-client.server.baseUrl`、归一（仅 http/https 绝对 URL 去尾斜杠）、`network:http` 域集合命中校验（§8.2 生产清单四域为数据源，manifest 声明随网络臂落波）、拒绝归在册码 `COMMUNITY_CLIENT_SERVER_UNSUPPORTED`、支持范围中文说明（§9.3）；旧 `lib/server-config.ts` 校验素材重写，旧词表（`community.server.baseUrl`/`community.refreshToken`）不迁移 |
| 候前置件登记表 | 全新 | `src/domain/community/pendingCapabilities.ts` | 本臂诚实降级登记唯一事实源（六项：网络臂/会话臂/传输臂/配置持久化/对话框与浏览器入口/服务端联调），每项声明缺失域、降级口径与落波去向；界面按此渲染，不铺替代数据 |
| 窗口会话运行时 | 重写 | `src/ui/runtime/communityRuntime.ts` | 服务器基址会话内存态（校验通过即时生效，生效层如实标记「会话内存（未持久化）」，`config:*` 落波后换接 `config:get/set` + `config:changed` 消费面零改动，判例同 settings 偏好存储/工单066）；会话状态可辨识联合（本臂恒未登录并如实呈现原因，登录态分支预留 `username` 字段不自造） |
| Hash 路由接线 | 重写 | `src/ui/useCommunityRoute.ts` | `window.location.hash` + `hashchange` 订阅（16-CC §3.2 开篇：应用窗口不能依赖服务器路径路由）；不引入 react-router（工作区零先例，避免新增第三方依赖），路由表事实源在领域层 |
| UI 壳层 | 重写 | `src/ui/AppView.tsx` + `src/ui/pages/`（5 件） | §3.3 壳层组织：顶栏（站点名 + 首页/工作区/社区简介/设置导航 + 登录/注册入口）、内容区按路由表落位、页脚（简介 + 刷新当前视图 + 命令注册状态）；欢迎页（§4.2 主按钮随会话态）、社区简介（静态文案）、设置页（服务器地址表单：域集合校验 + 会话内存生效 + 未持久化如实标记 + 账号「未登录」+ 六项候前置件登记卡）、候前置件登记页（登录/注册/工作区/个人主页/卡片详情/箱子详情/管理员入口共用，如实呈现依赖域与落波去向，不设不可用控件）、404 页（返回首页走路由器历史）；样式全 token 内联、文案简体中文直写、`message` 走 `App.useApp()` 许可通道、包根零独立 `.css` |
| 命令族 | 重写 | `src/commands/` | `community-client:open-card` / `community-client:refresh-view` 与 manifest `cli.commands` 逐字对应（锁测）；处理器路由真实动作：open-card 载荷收窄（`{path}` 非空字符串，manifest `mapsTo: path`）→ 登记本地查看请求并如实标记候传输链路，载荷非法如实上报失败不静默；refresh-view → 重读会话运行时刷新当前视图；命令通道缺位收敛「命令通道异常」状态行（骨架既有口径） |
| 主进程入口 | 保持骨架 | `src/index.ts` | `launch` 设窗口标题 + 日志；自身配置读取候 `config:*` 域处理器（工单066）随网络臂一并接线（§3.4 启动流程的诚实降级），不假接线 |

## 二、诚实降级与登记（不假接线）

- **网络请求臂缺位**（`http:*` 域宿主处理器未注册，G6 后续批）：不私建 fetch、不铺替代数据；浏览/认证/详情数据面与登录/注册页统一由候前置件登记页承载（页面身份 + 依赖域 + 落波去向）。
- **会话面缺位**（`http:request` + `credential:manage`）：会话恢复链（§5.2）不执行，全界面如实呈现「未登录」；`refreshToken` 凭证名 `refresh-token` 旧词表不作兼容映射（ADR-010）。
- **传输面缺位**（`transfer:*` 16-卡片传输协议编排）：上传/完整下载/本地查看不实现、不伪造入口；卡片归一改写还原逻辑以纯函数形态作为传输引擎同源实现材料迁入领域层（16-CC §2.3「客户端不实现传输协议、不改写 YAML/HTML」的运行时边界不变——本臂无任何 UI/主进程链路调用改写函数，仅承载材料与测试），编排入口候 `transfer:*` 落波。
- **配置持久化缺位**（`config:*` 工单066 在册，同源消费不重复开单）：服务器基址会话内存生效并如实标记；`config.schema.json` 候 10-配置系统 §四 平台键 schema 落定后随包补齐。
- **对话框/浏览器入口缺位**（`dialog:*` / `shell:openExternal`）：上传选择、下载保存与 `/admin` 后台入口不设不可用控件；manifest 权限面（`dialogs:use`、`resources:read:external`、`network:http:*`、`shell:external`）随端到端臂按 §8.1 逐项落波，不预声明未消费权限。
- **服务端联调缺位**（服务端 W6 未迁移）：联调面全部登记候前置件。
- **骨架清单修正**：manifest `permissions` 删除 `resources:read`（本臂零消费；远程封面所需为 §8.1 的 `resources:read:external`，随网络臂落波声明），命令面保持 `command:write`/`command:execute` 与两条 CLI 命令不动。
- **命令通道缺位**：骨架既有口径保持——注册失败收敛「命令通道异常」与错误码，界面照常工作（假桥舞台测试锁定该降级形态）。

## 三、测试（先测后码；82 用例，10 文件全绿）

- `tests/fixtures/card-archive.ts`：真实卡片夹具（01-卡片文件格式权威重建：metadata §4 / structure §5 / content §6.3 base.image + §6.6 base.richtext 文件化正文 / cover.html §7 相对引用；标识取 05-ID生成规范 §二在册示例 `a1B2c3D4e5`/`f6G7h8I9j0`/`k1L2m3N4o5`，恢复清单 cardId/versionId 取 16-传输协议 §4.4 在册示例 UUID；不携带旧 `RichTextCard` 形态）。
- `card-paths.test.ts`（13 用例）：规范化/结构文件/系统生成物/资源枚举（真实卡片目录 18 条目）/重复检出/外部引用/后缀分离/双候选。
- `card-rewrite.test.ts`（11 用例）：图片卡片改写与还原往返（字段语义不变）、一般字符串值替换保后缀、未命中不变、富文本内联与还原（含旧别名不识别）、cover.html 改写还原往返（还原为清单规范化路径）、未命中不猜测、YAML 解析失败整体失败双码。
- `restore-manifest.test.ts`（5 用例）：装载/缺清单/双错误码/双映射构建/建议文件名。
- `content-model.test.ts`（6 用例）：选取键/网格投影与受管 URI/传输门控/条目占位/标签表/比例解析/external 归一（默认端口、非默认端口、query、大小写、非法值）。
- `route-table.test.ts`（5 用例）：逐行解析/查询串与尾斜杠/参数非法 404/序列化往返（含需转义用户名）/守卫三臂。
- `server-config.test.ts`（3 文件 12 用例）：归一/域段提取/四域通过/未声明域拒绝/范围说明/运行时默认值与会话内存生效/未登录如实呈现/命名空间全键。
- `pending-capabilities.test.ts`（6 用例）：登记项稳定性（六项逐 id 锁序）/字段完备/网络臂 G6/传输臂 §2.3/服务端 W6/未知标识 `null`。
- `commands.test.ts`（7 用例）：元数据 JSON 往返锁测/manifest 逐字对应/载荷收窄五臂/派发消费配对/非法载荷如实失败。
- `app-view.test.tsx`（8 用例，photo-viewer 假桥舞台形制）：欢迎页空态/命令通道异常诚实降级/命令就绪/设置页非法地址行内拒绝 + 合法地址会话内存生效/六项登记呈现/工作区守卫重定向登录/404 返回首页/open-card 合法载荷登记与非法载荷拒绝（经 `command:invoked` 真实派发链路）。

## 四、FORBIDDEN_ANTD_EXPORTS 机检（词界双验法）

- A 面（antd/`@chips/antd`/`@ant-design/*` 直连导入）：**零命中**。
- B 面（28 名词界扫描 src+tests）：命中 10 处逐条溯源全部落入豁免类——`message`×6 均为 `App.useApp()` 许可通道（`export-surface.test.ts:241` 锁测项）与 Alert `message` 属性（载荷字段）；`version`×4 均为测试夹具查询后缀字段 `?version=2#view`。零静态实例通道、零禁面组件触达。
- 图标面：本臂未使用图标（壳层导航为文字按钮），无 `@ant-design/icons` 触达。

## 五、依赖与构建产物

- `package.json`：新增运行时依赖 `yaml@2.8.2`（卡片归一 YAML 解析/序列化；rte 应用同版本判例，MIT，维护活跃）；新增 devDep `jsdom@28.1.0`（壳层舞台测试环境，photo-viewer 同版本判例）。安装持 `/tmp/w4-lockguard` 目录锁（`pnpm install --filter @chips/plugin-community-client`，装后释放）。
- vitest 配置 node→jsdom + `tests/setup.ts`（matchMedia/ResizeObserver 平台面 + `IS_REACT_ACT_ENVIRONMENT`，零业务 mock；icon-maker 判例）。
- 构建产物：`dist/index.js` 0.21 kB（主进程自包含 ESM）+ `render.js` 31.03 kB（vendor 外部化：react/react-dom/@chips/ui）；构建期红线守卫（`rejectForbiddenImports`）通过。

## 六、验证（亲跑，2026-10-01）

| 闸 | 结果 |
|---|---|
| test | 10 文件 82 用例全绿 |
| typecheck | EXIT=0 |
| lint | 0 错 0 警 |
| build | dist/index.js 0.21 kB + render.js 31.03 kB |

未跑 `gates:all`（按派单约束）；未执行任何 git 写操作；未改动旧仓（Chips-CommunityClient / Chips-ModulePlugin 只读）。

## 七、边界与后续（候裁/候波次，不代裁）

1. **网络数据臂**（候 `http:*` 域宿主处理器注册，G6 后续批）：`ui/api/` 社区 HTTP 客户端（URL 组装、信封编解码、错误归一、401 单飞刷新队列）+ 浏览/详情页数据装载；落波后 manifest 补 `dialogs:use`、`network:http:<四域>`、`resources:read:external`，`assets/schemas/config.schema.json` 同批补齐。
2. **会话臂**（候 `credential:*` + 网络臂）：登录/注册/启动恢复/401 刷新/登出（§5.2），`accessToken` 仅内存、`refreshToken` 经凭证能力。
3. **传输编排臂**（候 `transfer:*` 链路）：上传/完整下载/本地查看（§6/§7）；领域层卡片归一改写还原纯函数为传输引擎同源实现材料（本轮已迁入并有夹具锁定），编排入口按 16-CC §2.3 只经传输链路。
4. **配置持久化翻正**（工单066 在册）：服务器基址换接 `config:get/set` + `config:changed`，消费面零改动。
5. **《09-官方插件与应用目录》community-client 行状态翻正**：候端到端臂收口随批办理（工单060 判例，本臂不代改）。
6. 触禁件第十二项裁定不影响本臂（零 `InputNumber`/`Tree`/`Popconfirm` 消费面）。
