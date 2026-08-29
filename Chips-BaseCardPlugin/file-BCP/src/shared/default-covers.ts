import type { FileCategory } from "./file-types";

export const FILE_CATEGORY_COVER_URLS: Readonly<Record<FileCategory, string>> = {
  document: new URL("../../assets/covers/file-cover-document.svg", import.meta.url).toString(),
  spreadsheet: new URL("../../assets/covers/file-cover-spreadsheet.svg", import.meta.url).toString(),
  presentation: new URL("../../assets/covers/file-cover-presentation.svg", import.meta.url).toString(),
  archive: new URL("../../assets/covers/file-cover-archive.svg", import.meta.url).toString(),
  audio: new URL("../../assets/covers/file-cover-audio.svg", import.meta.url).toString(),
  video: new URL("../../assets/covers/file-cover-video.svg", import.meta.url).toString(),
  image: new URL("../../assets/covers/file-cover-image.svg", import.meta.url).toString(),
  text: new URL("../../assets/covers/file-cover-text.svg", import.meta.url).toString(),
  code: new URL("../../assets/covers/file-cover-code.svg", import.meta.url).toString(),
};

export function resolveCategoryCoverUrl(fileCategory: FileCategory | undefined): string {
  if (!fileCategory) {
    return "";
  }

  return FILE_CATEGORY_COVER_URLS[fileCategory] ?? "";
}
