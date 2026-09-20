//! 目录态数据源（《06-文档解析器设计》§4.2）。
//!
//! 面向开发态与编辑态：成员即文件系统文件。路径安全以 `PackagePath`
//! 校验后拼接，并验证真实路径仍位于包根内；内部符号链接不跟随、不纳入
//! 索引并记录 `DOCUMENT_SYMLINK_IGNORED`（错误级诊断）。

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

use crate::error::{
    Diagnostic, DocumentError, Fatal, Severity, DOCUMENT_GENERATED_FILE_IGNORED,
    DOCUMENT_SYMLINK_IGNORED,
};
use crate::source::{
    ByteStream, DocumentSource, MemberFingerprint, MemberMeta, MemberMethod, PackagePath,
    SourceFingerprint, SourceKind,
};

/// 目录态有界递归扫描深度上限（设计稿 §3.3：深度 ≤ 16）。
pub(crate) const DIRECTORY_SCAN_MAX_DEPTH: usize = 16;

/// 操作系统生成物名单（索引时忽略并记录信息诊断，设计稿 §3.3）。
pub(crate) const IGNORED_GENERATED_NAMES: &[&str] =
    &["__MACOSX", ".DS_Store", "Thumbs.db", "desktop.ini"];

/// 目录态数据源。
#[derive(Debug)]
pub struct DirectorySource {
    root: PathBuf,
    index: BTreeMap<PackagePath, MemberMeta>,
}

impl DirectorySource {
    /// 有界递归扫描目录建立索引；`diagnostics` 收集忽略项与符号链接诊断。
    pub(crate) fn open(root: &Path, diagnostics: &mut Vec<Diagnostic>) -> Fatal<Self> {
        let canonical_root = root.canonicalize().map_err(|io_error| DocumentError::Io {
            message: format!("无法解析包根目录：{io_error}"),
        })?;
        let mut source = Self {
            root: canonical_root.clone(),
            index: BTreeMap::new(),
        };
        source.walk(&canonical_root, "", 0, diagnostics)?;
        Ok(source)
    }

    fn walk(
        &mut self,
        dir: &Path,
        prefix: &str,
        depth: usize,
        diagnostics: &mut Vec<Diagnostic>,
    ) -> Fatal<()> {
        if depth > DIRECTORY_SCAN_MAX_DEPTH {
            return Err(DocumentError::LimitExceeded {
                limit: "directory_scan_depth",
                actual: format!("超过 {DIRECTORY_SCAN_MAX_DEPTH} 层：{}", dir.display()),
                file: None,
            });
        }
        let entries = std::fs::read_dir(dir).map_err(|io_error| DocumentError::Io {
            message: format!("无法枚举目录 {}：{io_error}", dir.display()),
        })?;
        for entry in entries {
            let entry = entry.map_err(|io_error| DocumentError::Io {
                message: format!("无法读取目录项 {}：{io_error}", dir.display()),
            })?;
            let file_type = entry.file_type().map_err(|io_error| DocumentError::Io {
                message: format!("无法判定文件类型 {}：{io_error}", entry.path().display()),
            })?;
            let name = entry.file_name().to_string_lossy().into_owned();
            let normalized = if prefix.is_empty() {
                name.clone()
            } else {
                format!("{prefix}/{name}")
            };
            if is_ignored_generated(&normalized) {
                let file = PackagePath::new(&normalized)?;
                diagnostics.push(
                    Diagnostic::new(
                        Severity::Info,
                        DOCUMENT_GENERATED_FILE_IGNORED,
                        format!("已忽略系统生成物 {normalized}"),
                    )
                    .in_file(&file),
                );
                if file_type.is_dir() {
                    // 生成物目录（如 `__MACOSX/`）整棵子树都不入索引，但子树内的
                    // 每个文件各自记一条信息诊断（设计稿 §3.3「忽略并记录」）；
                    // 中间目录不重复记录，避免同一条目计入两次。
                    Self::record_generated_files(&entry.path(), &normalized, depth, diagnostics)?;
                }
                continue;
            }
            if file_type.is_symlink() {
                let package_path = PackagePath::new(&normalized)?;
                diagnostics.push(
                    Diagnostic::new(
                        Severity::Error,
                        DOCUMENT_SYMLINK_IGNORED,
                        format!("符号链接不跟随、不纳入索引：{normalized}"),
                    )
                    .in_file(&package_path)
                    .with_hint("删除符号链接后重新打包，或改为复制真实文件"),
                );
                continue;
            }
            if file_type.is_dir() {
                self.walk(&entry.path(), &normalized, depth + 1, diagnostics)?;
                continue;
            }
            let package_path = PackagePath::new(&normalized)?;
            let metadata =
                std::fs::metadata(entry.path()).map_err(|io_error| DocumentError::Io {
                    message: format!("无法读取文件元数据 {}：{io_error}", entry.path().display()),
                })?;
            self.index.insert(
                package_path.clone(),
                MemberMeta {
                    path: package_path,
                    size: metadata.len(),
                    modified: metadata.modified().ok(),
                    crc32: None,
                    method: MemberMethod::Store,
                },
            );
        }
        Ok(())
    }

    /// 生成物子树内的文件逐条记录 `DOCUMENT_GENERATED_FILE_IGNORED`（不入索引）：
    /// 目录层只由调用方记一条，本函数只为文件与符号链接等非目录条目记账。
    fn record_generated_files(
        dir: &Path,
        prefix: &str,
        depth: usize,
        diagnostics: &mut Vec<Diagnostic>,
    ) -> Fatal<()> {
        if depth >= DIRECTORY_SCAN_MAX_DEPTH {
            // 生成物子树同样受有界递归约束（设计稿 §3.3 深度 ≤ 16）。
            return Ok(());
        }
        let entries = std::fs::read_dir(dir).map_err(|io_error| DocumentError::Io {
            message: format!("无法枚举生成物目录 {}：{io_error}", dir.display()),
        })?;
        for entry in entries {
            let entry = entry.map_err(|io_error| DocumentError::Io {
                message: format!("无法读取目录项 {}：{io_error}", dir.display()),
            })?;
            let file_type = entry.file_type().map_err(|io_error| DocumentError::Io {
                message: format!("无法判定文件类型 {}：{io_error}", entry.path().display()),
            })?;
            let name = entry.file_name().to_string_lossy().into_owned();
            let normalized = format!("{prefix}/{name}");
            if file_type.is_dir() {
                Self::record_generated_files(&entry.path(), &normalized, depth + 1, diagnostics)?;
                continue;
            }
            let file = PackagePath::new(&normalized)?;
            diagnostics.push(
                Diagnostic::new(
                    Severity::Info,
                    DOCUMENT_GENERATED_FILE_IGNORED,
                    format!("已忽略系统生成物 {normalized}"),
                )
                .in_file(&file),
            );
        }
        Ok(())
    }

    /// 把包内路径映射为文件系统路径，并验证真实路径仍位于包根内。
    fn resolve(&self, path: &PackagePath) -> Fatal<PathBuf> {
        let mut candidate = self.root.clone();
        for segment in path.segments() {
            candidate.push(segment);
        }
        let resolved = candidate
            .canonicalize()
            .map_err(|io_error| DocumentError::Io {
                message: format!("无法解析包内路径 {path}：{io_error}"),
            })?;
        if !resolved.starts_with(&self.root) {
            return Err(DocumentError::PathUnsafe {
                path: path.to_string(),
            });
        }
        if resolved
            .symlink_metadata()
            .map(|meta| meta.file_type().is_symlink())
            .unwrap_or(false)
        {
            return Err(DocumentError::PathUnsafe {
                path: path.to_string(),
            });
        }
        Ok(resolved)
    }
}

/// 命中系统生成物名单（任一路径段精确匹配）。
#[must_use]
pub(crate) fn is_ignored_generated(normalized_path: &str) -> bool {
    normalized_path
        .split('/')
        .any(|segment| IGNORED_GENERATED_NAMES.contains(&segment))
}

impl DocumentSource for DirectorySource {
    fn kind(&self) -> SourceKind {
        SourceKind::Directory
    }

    fn fingerprint(&self) -> SourceFingerprint {
        SourceFingerprint {
            kind: SourceKind::Directory,
            members: self
                .index
                .iter()
                .map(|(path, meta)| (path.clone(), MemberFingerprint::of(meta)))
                .collect(),
        }
    }

    fn member(&self, path: &PackagePath) -> Option<MemberMeta> {
        self.index.get(path).cloned()
    }

    fn list(&self, prefix: &PackagePath) -> Fatal<Vec<PackagePath>> {
        let needle = format!("{prefix}/");
        Ok(self
            .index
            .keys()
            .filter(|path| path.as_str().starts_with(&needle))
            .cloned()
            .collect())
    }

    fn read(&self, path: &PackagePath) -> Result<Vec<u8>, DocumentError> {
        if !self.index.contains_key(path) {
            return Err(DocumentError::NotFound {
                path: path.to_string(),
            });
        }
        let resolved = self.resolve(path)?;
        std::fs::read(&resolved).map_err(|io_error| DocumentError::Io {
            message: format!("读取成员 {path} 失败：{io_error}"),
        })
    }

    fn open_stream(&self, path: &PackagePath) -> Result<ByteStream, DocumentError> {
        if !self.index.contains_key(path) {
            return Err(DocumentError::NotFound {
                path: path.to_string(),
            });
        }
        let resolved = self.resolve(path)?;
        let file = std::fs::File::open(&resolved).map_err(|io_error| DocumentError::Io {
            message: format!("打开成员流 {path} 失败：{io_error}"),
        })?;
        // 目录态成员读取走普通文件流（设计稿 §4.2）。
        Ok(ByteStream::Decoded(Box::new(std::io::BufReader::new(file))))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::{DOCUMENT_LIMIT_EXCEEDED, DOCUMENT_NOT_FOUND};

    /// 在临时目录开辟一棵独立小树；返回根路径。
    fn temp_root(tag: &str) -> PathBuf {
        let base = std::env::temp_dir().join(format!(
            "chips-parser-dir-{tag}-{}-{:?}",
            std::process::id(),
            std::thread::current().id()
        ));
        let _ = std::fs::remove_dir_all(&base);
        std::fs::create_dir_all(&base).expect("创建夹具根目录");
        base
    }

    #[test]
    fn test_open_indexes_files_and_ignores_generated() {
        let root = temp_root("index");
        std::fs::create_dir_all(root.join(".card")).expect("创建配置目录");
        std::fs::write(
            root.join(".card/metadata.yaml"),
            b"chip_standards_version: \"1.0.0\"\n",
        )
        .expect("写入元数据");
        std::fs::write(root.join(".DS_Store"), b"junk").expect("写入生成物");
        std::fs::create_dir_all(root.join("__MACOSX/sub")).expect("创建生成物目录");
        std::fs::write(root.join("__MACOSX/sub/resource.txt"), b"junk").expect("写入生成物内容");
        let mut diagnostics = Vec::new();
        let source = DirectorySource::open(&root, &mut diagnostics).expect("打开目录态");
        assert_eq!(source.kind(), SourceKind::Directory);
        let paths: Vec<String> = source
            .fingerprint()
            .members
            .iter()
            .map(|(path, _)| path.to_string())
            .collect();
        assert_eq!(paths, vec![".card/metadata.yaml"], "系统生成物不得进入索引");
        assert_eq!(
            diagnostics
                .iter()
                .filter(|d| d.code == DOCUMENT_GENERATED_FILE_IGNORED)
                .count(),
            3,
            ".DS_Store、__MACOSX/ 目录与其子文件各记一条信息诊断"
        );
        std::fs::remove_dir_all(root).expect("清理临时目录");
    }

    #[test]
    fn test_read_and_stream_roundtrip() {
        let root = temp_root("read");
        std::fs::write(root.join("note.txt"), b"hello chips").expect("写入资源");
        let mut diagnostics = Vec::new();
        let source = DirectorySource::open(&root, &mut diagnostics).expect("打开");
        let path = PackagePath::new("note.txt").expect("合法路径");
        assert_eq!(source.read(&path).expect("读取成功"), b"hello chips");
        let mut stream = source.open_stream(&path).expect("打开流");
        assert_eq!(stream.read_to_vec().expect("流读取成功"), b"hello chips");
        std::fs::remove_dir_all(root).expect("清理");
    }

    #[test]
    fn test_missing_member_returns_not_found() {
        let root = temp_root("missing");
        std::fs::write(root.join("present.txt"), b"x").expect("写入");
        let mut diagnostics = Vec::new();
        let source = DirectorySource::open(&root, &mut diagnostics).expect("打开");
        let missing = PackagePath::new("absent.txt").expect("合法路径");
        let error = source.read(&missing).expect_err("索引外成员必须失败");
        assert_eq!(error.code(), DOCUMENT_NOT_FOUND);
        let stream_error = source.open_stream(&missing).expect_err("索引外流必须失败");
        assert_eq!(stream_error.code(), DOCUMENT_NOT_FOUND);
        std::fs::remove_dir_all(root).expect("清理");
    }

    #[test]
    fn test_symlink_recorded_and_skipped() {
        let root = temp_root("symlink");
        std::fs::write(root.join("real.txt"), b"content").expect("写入实体");
        std::os::unix::fs::symlink(root.join("real.txt"), root.join("link.txt"))
            .expect("创建符号链接");
        let mut diagnostics = Vec::new();
        let source = DirectorySource::open(&root, &mut diagnostics).expect("打开");
        let link = PackagePath::new("link.txt").expect("合法路径");
        assert!(source.member(&link).is_none(), "符号链接不得纳入索引");
        assert!(diagnostics
            .iter()
            .any(|d| d.code == DOCUMENT_SYMLINK_IGNORED));
        std::fs::remove_dir_all(root).expect("清理");
    }

    #[test]
    fn test_list_prefix() {
        let root = temp_root("list");
        std::fs::create_dir_all(root.join("content")).expect("创建目录");
        std::fs::write(
            root.join("content/a1B2c3D4e5.yaml"),
            b"card_type: base.image\n",
        )
        .expect("写入");
        std::fs::write(root.join("video.mp4"), b"00").expect("写入");
        let mut diagnostics = Vec::new();
        let source = DirectorySource::open(&root, &mut diagnostics).expect("打开");
        let prefix = PackagePath::new("content").expect("合法前缀");
        let listed = source.list(&prefix).expect("列举成功");
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].as_str(), "content/a1B2c3D4e5.yaml");
        std::fs::remove_dir_all(root).expect("清理");
    }

    #[test]
    fn test_depth_limit() {
        let root = temp_root("depth");
        let mut deep = root.clone();
        for _ in 0..DIRECTORY_SCAN_MAX_DEPTH + 1 {
            deep = deep.join("nested");
        }
        std::fs::create_dir_all(&deep).expect("创建深层目录");
        let mut diagnostics = Vec::new();
        let error =
            DirectorySource::open(&root, &mut diagnostics).expect_err("深层目录必须触发限额");
        assert_eq!(error.code(), DOCUMENT_LIMIT_EXCEEDED);
        std::fs::remove_dir_all(root).expect("清理");
    }

    #[test]
    fn test_is_ignored_generated_matches_segments() {
        assert!(is_ignored_generated("__MACOSX/anything"));
        assert!(is_ignored_generated("docs/desktop.ini"));
        assert!(!is_ignored_generated("notes.md"));
    }
}
