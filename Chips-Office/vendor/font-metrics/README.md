# @genoffice/font-metrics（浏览器适配说明）

GenOffice 原包提供"系统字体定位 + sfnt 垂直度量读取"，全部实现依赖 Node `fs/os/path`，无法进入浏览器构建。

本移植的分层：

- `src/types.ts`：纯类型（`FaceVerticalMetrics` 等），随浏览器构建导出，供应用桥/渲染层引用；
- `src/node/`：原 Node 实现**完整保留**（`metrics.ts` / `sfnt.ts` / `font-locate.ts` / `advance.ts`），
  供未来 Host 侧字体度量服务直接复用；不参与本插件编译；
- `tests/`：GenOffice 原有测试，针对 `src/node/` 实现，不在本插件测试链路内运行。
