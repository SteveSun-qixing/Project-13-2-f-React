import defaultCoverUrl from '../../assets/placeholders/music-cover-placeholder.jpg?inline';

/**
 * 默认占位封面：随包素材（`assets/placeholders/`），构建期内联为数据 URL。
 *
 * 渲染帧插件的包内相对资产寻址臂尚未落波（工单025 剩余 / #85），内联保证查看态与
 * 就近渲染容器在「封面未配置」时呈现一致，不依赖运行期相对地址解析。
 */
export const DEFAULT_MUSIC_COVER_URL: string = defaultCoverUrl;
