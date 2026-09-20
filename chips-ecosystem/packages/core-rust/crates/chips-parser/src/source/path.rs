//! 包内路径 [`PackagePath`]：构造时完成全部校验与归一（设计稿 §11.6）。
//!
//! 规则（《06-文档解析器设计》§1.3）：相对包根、`/` 分隔、UTF-8；
//! 禁 `..`、绝对路径、反斜杠与控制字符；空段与 `.` 段非法。

use std::fmt;

use serde::{Deserialize, Deserializer, Serialize, Serializer};

use crate::error::{DocumentError, Fatal};

/// 相对包根的规范化路径。
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct PackagePath(String);

impl PackagePath {
    /// 校验并构造；非法路径返回 `DOCUMENT_PATH_UNSAFE`。
    pub fn new(raw: &str) -> Fatal<Self> {
        validate_package_path(raw)?;
        Ok(Self(raw.to_owned()))
    }

    /// 已通过校验的内部构造（索引构建时复用校验结果）。
    pub(crate) fn from_validated(raw: String) -> Self {
        Self(raw)
    }

    /// 规范化文本。
    #[must_use]
    pub fn as_str(&self) -> &str {
        &self.0
    }

    /// 以 `/` 分隔的路径段。
    #[must_use]
    pub fn segments(&self) -> impl Iterator<Item = &str> {
        self.0.split('/')
    }

    /// 父目录路径；根层文件返回 `None`。
    #[must_use]
    pub fn parent(&self) -> Option<PackagePath> {
        let index = self.0.rfind('/')?;
        if index == 0 {
            None
        } else {
            Some(PackagePath(self.0[..index].to_owned()))
        }
    }

    /// 是否位于指定前缀目录下（含前缀本身）。
    #[must_use]
    pub fn starts_with(&self, prefix: &str) -> bool {
        self.0.starts_with(prefix)
    }

    /// 文件名段。
    #[must_use]
    pub fn file_name(&self) -> &str {
        self.0.rsplit('/').next().unwrap_or(&self.0)
    }
}

impl fmt::Display for PackagePath {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.0)
    }
}

impl Serialize for PackagePath {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.0)
    }
}

impl<'de> Deserialize<'de> for PackagePath {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        let raw = String::deserialize(deserializer)?;
        Self::new(&raw).map_err(serde::de::Error::custom)
    }
}

/// 校验包内路径文本；错误消息为简体中文。
pub(crate) fn validate_package_path(raw: &str) -> Fatal<()> {
    if raw.is_empty() {
        return Err(DocumentError::PathUnsafe { path: raw.to_owned() });
    }
    if raw.starts_with('/') || raw.contains('\\') {
        return Err(DocumentError::PathUnsafe { path: raw.to_owned() });
    }
    // Windows 盘符样式绝对路径。
    if raw.len() >= 2 && raw.as_bytes()[1] == b':' && raw.as_bytes()[0].is_ascii_alphabetic() {
        return Err(DocumentError::PathUnsafe { path: raw.to_owned() });
    }
    for ch in raw.chars() {
        if (ch as u32) < 0x20 || ch == '\u{7f}' {
            return Err(DocumentError::PathUnsafe { path: raw.to_owned() });
        }
    }
    for segment in raw.split('/') {
        if segment.is_empty() || segment == "." || segment == ".." {
            return Err(DocumentError::PathUnsafe { path: raw.to_owned() });
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_accepts_normalized_paths() {
        for raw in [
            ".card/metadata.yaml",
            "content/a1B2c3D4e5.yaml",
            "docs/季度报告.pdf",
            "video.mp4",
            "richtext/a1B2c3D4e5.md",
        ] {
            let path = PackagePath::new(raw).unwrap_or_else(|error| panic!("{raw} 应合法：{error}"));
            assert_eq!(path.as_str(), raw);
        }
    }

    #[test]
    fn test_rejects_unsafe_paths() {
        // 《06-文档解析器设计》§11.6：zip-slip、绝对路径、反斜杠、控制字符。
        for raw in [
            "",
            "/absolute.yaml",
            "../escape.yaml",
            "a/../../b.yaml",
            "back\\slash.yaml",
            "C:/drive.yaml",
            "ctrl\u{1}char.yaml",
            "empty//segment.yaml",
            "./relative.yaml",
        ] {
            let error = PackagePath::new(raw).expect_err(&format!("{raw} 必须被拒绝"));
            assert_eq!(error.code(), crate::error::DOCUMENT_PATH_UNSAFE);
        }
    }

    #[test]
    fn test_segments_parent_and_file_name() {
        let path = PackagePath::new("richtext/a1B2c3D4e5.md").expect("合法路径");
        assert_eq!(path.segments().collect::<Vec<_>>(), vec!["richtext", "a1B2c3D4e5.md"]);
        assert_eq!(path.parent().expect("有父目录").as_str(), "richtext");
        assert_eq!(path.file_name(), "a1B2c3D4e5.md");
        let root_file = PackagePath::new("video.mp4").expect("合法路径");
        assert!(root_file.parent().is_none());
        assert!(root_file.starts_with("video"));
    }

    #[test]
    fn test_serde_roundtrip() {
        let path = PackagePath::new(".card/structure.yaml").expect("合法路径");
        let json = serde_json::to_value(&path).expect("序列化为字符串");
        assert_eq!(json, ".card/structure.yaml");
        let back: PackagePath = serde_json::from_value(json).expect("反序列化合法");
        assert_eq!(back, path);
        assert!(serde_json::from_value::<PackagePath>(serde_json::json!("../bad")).is_err());
    }
}
