/**
 * 编辑场景：工具栏 + 幻灯片舞台。文档就绪后由 AppShell 挂载。
 */
import React from "react";
import { SlideToolbar } from "./SlideToolbar";
import { SlideStage } from "./SlideStage";

export function EditorScene(): React.ReactElement {
  return (
    <div className="editor-scene">
      <SlideToolbar />
      <SlideStage />
    </div>
  );
}
