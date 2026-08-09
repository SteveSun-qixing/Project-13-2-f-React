import { appConfig } from "../../config/app-config";

export type VideoPlayerSceneId = "main";

export interface VideoPlayerSceneDefinition {
  id: VideoPlayerSceneId;
  hostSceneId: string;
  title: string;
  description: string;
}

export const videoPlayerSceneDefinition: VideoPlayerSceneDefinition = {
  id: "main",
  hostSceneId: appConfig.defaultSceneId,
  title: "视频播放器",
  description: "打开并播放 Host 资源路由传入的视频内容。",
};

export function getSceneDefinition(hostSceneId?: string): VideoPlayerSceneDefinition {
  if (hostSceneId === videoPlayerSceneDefinition.hostSceneId) {
    return videoPlayerSceneDefinition;
  }

  return videoPlayerSceneDefinition;
}
