/**
 * 社区简介页（16-CC §3.2 `/about`：数据来源为静态文案；§4.2 展示要点：社区定位与使用说明）。
 */

import { Card, Typography } from '@chips/ui';
import type { FC } from 'react';

/** 社区简介页路由 `/about`（静态文案，无请求）。 */
export const AboutPage: FC = () => (
  <Card data-role="about-card" style={{ width: '100%' }}>
    <Typography.Title level={3} style={{ marginTop: 0 }}>
      社区简介
    </Typography.Title>
    <Typography.Paragraph>
      薯片社区是薯片生态的官方内容社区：围绕「卡片」与「箱子」两类作品组织内容。
      卡片是可分享的结构化文档，箱子是卡片与箱子的有序集合。
    </Typography.Paragraph>
    <Typography.Paragraph>
      发布：在工作区选择本机 `.card` / `.box` 文件，经卡片传输链路上传为网络资源卡片；
      下载：把社区卡片完整下载为离线卡片，路径、字段与资源与上传前完全一致，可继续编辑。
    </Typography.Paragraph>
    <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
      本地查看社区下载的卡片由本地卡片查看器应用承载；社区客户端负责把受管引用交给默认处理器路由，
      不直接打开卡片内容。
    </Typography.Paragraph>
  </Card>
);
