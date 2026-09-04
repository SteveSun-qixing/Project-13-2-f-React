/**
 * Slide 场景组件
 * 幻灯片编辑器的场景入口
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { message } from "antd";
import { SlideEditor, SlideViewer } from "../apps/slide";
import { useAppRuntime } from "./AppRuntimeProvider";
import type { Client } from "chips-sdk";

export interface SlideSceneProps {
  /** 是否查看模式 */
  viewOnly?: boolean;
}

/** Slide 场景组件 */
export function SlideScene({ viewOnly = false }: SlideSceneProps) {
  const runtime = useAppRuntime();
  const { client } = runtime;
  const [isViewMode, setIsViewMode] = useState(viewOnly);
  const [isLoading, setIsLoading] = useState(false);
  const initialDataRef = useRef<ArrayBuffer | null>(null);
  const fileNameRef = useRef<string | null>(null);

  // 从启动上下文获取资源数据
  useEffect(() => {
    const loadResource = async () => {
      const launchParams = runtime.environment.launchParams;
      const resourcePath = launchParams?.resourceOpen as string | undefined;

      if (!resourcePath || !client) {
        return;
      }

      setIsLoading(true);
      try {
        // 通过 SDK 读取资源
        const session = await client.file.session.open({
          filePath: resourcePath,
          format: "pptx",
        });
        const result = await client.file.session.read({ sessionId: session.sessionId });
        const arrayBuffer = result.bytes.buffer as ArrayBuffer;
        initialDataRef.current = arrayBuffer;
        fileNameRef.current = resourcePath.split("/").pop() ?? "演示文稿.pptx";
      } catch (error) {
        console.error("加载资源失败:", error);
        message.error("加载演示文稿失败");
      } finally {
        setIsLoading(false);
      }
    };

    if (runtime.ready && client) {
      loadResource();
    }
  }, [runtime.ready, client, runtime.environment.launchParams]);

  const handleSave = useCallback(async (data: Blob) => {
    if (!client) return;

    const launchParams = runtime.environment.launchParams;
    const resourcePath = launchParams?.resourceOpen as string | undefined;

    if (resourcePath) {
      try {
        const bytes = new Uint8Array(await data.arrayBuffer());
        const session = await client.file.session.open({
          filePath: resourcePath,
          format: "pptx",
        });
        await client.file.session.write({
          sessionId: session.sessionId,
          bytes,
        });
        await client.file.session.persist({ sessionId: session.sessionId });
        await client.file.session.close({ sessionId: session.sessionId });
        message.success("保存成功");
      } catch (error) {
        console.error("保存失败:", error);
        message.error("保存失败");
      }
    }
  }, [client, runtime.environment.launchParams]);

  const handleExitViewMode = useCallback(() => {
    setIsViewMode(false);
  }, []);

  // 如果是查看模式，渲染查看器
  if (isViewMode) {
    return (
      <SlideViewer
        slides={[]}
        onExit={handleExitViewMode}
      />
    );
  }

  // 渲染编辑器
  return (
    <SlideEditor
      client={client ?? undefined}
      initialData={initialDataRef.current ?? undefined}
      fileName={fileNameRef.current ?? undefined}
      readOnly={false}
      onSave={handleSave}
    />
  );
}
