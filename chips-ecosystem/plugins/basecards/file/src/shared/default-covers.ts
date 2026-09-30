import coverArchiveUrl from '../../assets/covers/file-cover-archive.svg?inline';
import coverAudioUrl from '../../assets/covers/file-cover-audio.svg?inline';
import coverCodeUrl from '../../assets/covers/file-cover-code.svg?inline';
import coverDocumentUrl from '../../assets/covers/file-cover-document.svg?inline';
import coverImageUrl from '../../assets/covers/file-cover-image.svg?inline';
import coverPresentationUrl from '../../assets/covers/file-cover-presentation.svg?inline';
import coverSpreadsheetUrl from '../../assets/covers/file-cover-spreadsheet.svg?inline';
import coverTextUrl from '../../assets/covers/file-cover-text.svg?inline';
import coverVideoUrl from '../../assets/covers/file-cover-video.svg?inline';
import type { FileCategory } from './file-types';

/**
 * 类别默认封面（素材随迁：`assets/covers/`，来源登记见 `assets/covers/SOURCE.md`）。
 *
 * 旧族经 `new URL(..., import.meta.url)` 打包引用；渲染帧插件的包内相对资产寻址臂
 * 尚未落波（工单025 剩余 / #85），内联保证查看态与就近渲染容器呈现一致（music 判例：
 * 默认占位封面经 Vite `?inline` 以数据 URL 进 render.js），不依赖运行期相对地址解析。
 */
export const FILE_CATEGORY_COVER_URLS: Readonly<Record<FileCategory, string>> = {
  document: coverDocumentUrl,
  spreadsheet: coverSpreadsheetUrl,
  presentation: coverPresentationUrl,
  archive: coverArchiveUrl,
  audio: coverAudioUrl,
  video: coverVideoUrl,
  image: coverImageUrl,
  text: coverTextUrl,
  code: coverCodeUrl,
};

/** 解析类别默认封面：类别未知时返回空串（由后缀文字徽标占位兜底）。 */
export function resolveCategoryCoverUrl(fileCategory: FileCategory | undefined): string {
  if (!fileCategory) {
    return '';
  }

  return FILE_CATEGORY_COVER_URLS[fileCategory] ?? '';
}
