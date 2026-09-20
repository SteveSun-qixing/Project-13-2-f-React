//! [`DocumentValue`] 转换与扫描防护（《06-文档解析器设计》§11.4 `yaml/value.rs`）。
//!
//! 以 serde 的 `MapAccess` / `SeqAccess` 逐流构造值树，因此能够：
//!
//! - 保持映射键的文档顺序（`serde_yaml::Value` 的 `IndexMap` 会折叠重复键，
//!   无法承担《卡片文件格式》§3.3「归档内归一化后的路径必须唯一」同源的
//!   重复键判定）；
//! - 在递归过程中执行深度限额（`max_depth`）与展开节点预算（别名炸弹防护）；
//! - 记录失败位置的 RFC 6901 字段指针，供诊断定位（§6.2）。

use std::fmt;

use serde::de::{DeserializeSeed, Deserializer, MapAccess, SeqAccess, Visitor};

use crate::model::{DocumentValue, ScanLimits};

/// 扫描失败原因。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ScanFailure {
    /// 嵌套深度超出 `max_depth`。
    DepthExceeded,
    /// 展开节点总数超出预算（别名炸弹）。
    NodeBudgetExceeded,
    /// 映射键重复。
    DuplicateKey,
}

impl ScanFailure {
    /// 简体中文错误文案。
    #[must_use]
    pub fn message(self) -> &'static str {
        match self {
            Self::DepthExceeded => "嵌套深度超出限额",
            Self::NodeBudgetExceeded => "展开节点总数超出限额",
            Self::DuplicateKey => "映射键重复",
        }
    }
}

/// 值树扫描状态：限额、当前指针与失败结论。
#[derive(Debug)]
pub struct ValueScan {
    limits: ScanLimits,
    depth: u64,
    nodes: u64,
    path: Vec<String>,
    failure: Option<ScanFailure>,
    failure_pointer: Option<String>,
}

impl ValueScan {
    /// 以给定限额开始扫描。
    #[must_use]
    pub fn new(limits: ScanLimits) -> Self {
        Self {
            limits,
            depth: 0,
            nodes: 0,
            path: Vec::new(),
            failure: None,
            failure_pointer: None,
        }
    }

    /// 已展开的节点数。
    #[must_use]
    pub fn nodes(&self) -> u64 {
        self.nodes
    }

    /// 失败原因（成功完成时为 `None`）。
    #[must_use]
    pub fn failure(&self) -> Option<ScanFailure> {
        self.failure
    }

    /// 失败位置的 RFC 6901 指针。
    #[must_use]
    pub fn failure_pointer(&self) -> Option<&str> {
        self.failure_pointer.as_deref()
    }

    /// 当前指针（递归过程中用于诊断）。
    #[must_use]
    pub fn current_pointer(&self) -> String {
        if self.path.is_empty() {
            return String::new();
        }
        let mut pointer = String::new();
        for token in &self.path {
            pointer.push('/');
            pointer.push_str(token);
        }
        pointer
    }

    /// 进入容器层：检查深度限额。
    fn enter(&mut self) -> Result<(), ScanFailure> {
        self.depth += 1;
        if self.depth > self.limits.max_depth {
            return Err(self.record(ScanFailure::DepthExceeded));
        }
        Ok(())
    }

    /// 离开容器层。
    fn leave(&mut self) {
        self.depth = self.depth.saturating_sub(1);
    }

    /// 记账一个节点：检查展开预算。
    fn visit_node(&mut self) -> Result<(), ScanFailure> {
        self.nodes += 1;
        if self.nodes > self.limits.node_budget {
            return Err(self.record(ScanFailure::NodeBudgetExceeded));
        }
        Ok(())
    }

    /// 记录失败结论并返回原因。
    fn record(&mut self, failure: ScanFailure) -> ScanFailure {
        if self.failure.is_none() {
            self.failure = Some(failure);
            self.failure_pointer = Some(self.current_pointer());
        }
        failure
    }

    /// 压入指针段。
    fn push_token(&mut self, token: &str) {
        self.path.push(escape_pointer_token(token));
    }

    /// 弹出指针段。
    fn pop_token(&mut self) {
        self.path.pop();
    }
}

/// RFC 6901 指针段转义。
#[must_use]
pub fn escape_pointer_token(token: &str) -> String {
    token.replace('~', "~0").replace('/', "~1")
}

/// 由任意`Deserializer` 构造 [`DocumentValue`]。
///
/// # Errors
///
/// 反序列化失败（语法错误、重复键、深度或节点预算超限）时返回
/// `D::Error`，原因文案为简体中文；`scan` 同步记录失败指针。
pub fn from_deserializer<'de, D>(
    deserializer: D,
    scan: &mut ValueScan,
) -> Result<DocumentValue, D::Error>
where
    D: Deserializer<'de>,
{
    deserializer.deserialize_any(ValueVisitor(scan))
}

/// 值树访问器。
struct ValueVisitor<'a>(&'a mut ValueScan);

impl<'a> ValueVisitor<'a> {
    fn guard<E: serde::de::Error>(result: Result<(), ScanFailure>) -> Result<(), E> {
        result.map_err(|failure| E::custom(failure.message()))
    }
}

impl<'de, 'a> Visitor<'de> for ValueVisitor<'a> {
    type Value = DocumentValue;

    fn expecting(formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("YAML 1.2 核心 schema 的标量、序列或映射")
    }

    fn visit_bool<E: serde::de::Error>(self, value: bool) -> Result<DocumentValue, E> {
        Self::guard(self.0.visit_node())?;
        Ok(DocumentValue::Bool(value))
    }

    fn visit_i64<E: serde::de::Error>(self, value: i64) -> Result<DocumentValue, E> {
        Self::guard(self.0.visit_node())?;
        Ok(DocumentValue::Integer(value))
    }

    fn visit_i32<E: serde::de::Error>(self, value: i32) -> Result<DocumentValue, E> {
        self.visit_i64(i64::from(value))
    }

    fn visit_u64<E: serde::de::Error>(self, value: u64) -> Result<DocumentValue, E> {
        Self::guard(self.0.visit_node())?;
        Ok(DocumentValue::Integer(i64::try_from(value).unwrap_or(i64::MAX)))
    }

    fn visit_f64<E: serde::de::Error>(self, value: f64) -> Result<DocumentValue, E> {
        Self::guard(self.0.visit_node())?;
        Ok(DocumentValue::Float(value))
    }

    fn visit_str<E: serde::de::Error>(self, value: &str) -> Result<DocumentValue, E> {
        Self::guard(self.0.visit_node())?;
        Ok(DocumentValue::String(value.to_owned()))
    }

    fn visit_string<E: serde::de::Error>(self, value: String) -> Result<DocumentValue, E> {
        Self::guard(self.0.visit_node())?;
        Ok(DocumentValue::String(value))
    }

    fn visit_none<E: serde::de::Error>(self) -> Result<DocumentValue, E> {
        Self::guard(self.0.visit_node())?;
        Ok(DocumentValue::Null)
    }

    fn visit_unit<E: serde::de::Error>(self) -> Result<DocumentValue, E> {
        Self::guard(self.0.visit_node())?;
        Ok(DocumentValue::Null)
    }

    fn visit_seq<A: SeqAccess<'de>>(self, mut accessor: A) -> Result<DocumentValue, A::Error> {
        Self::guard(self.0.visit_node())?;
        Self::guard(self.0.enter())?;
        let mut items = Vec::new();
        let mut index = 0usize;
        loop {
            // 序列元素以索引入指针（RFC 6901）。
            self.0.push_token(&index.to_string());
            let item = accessor.next_element_seed(ValueSeed(self.0));
            self.0.pop_token();
            match item? {
                Some(value) => {
                    items.push(value);
                    index += 1;
                }
                None => break,
            }
        }
        self.0.leave();
        Ok(DocumentValue::Sequence(items))
    }

    fn visit_map<A: MapAccess<'de>>(self, mut accessor: A) -> Result<DocumentValue, A::Error> {
        Self::guard(self.0.visit_node())?;
        Self::guard(self.0.enter())?;
        let mut entries: Vec<(String, DocumentValue)> = Vec::new();
        while let Some(key) = accessor.next_key::<String>()? {
            if entries.iter().any(|(name, _)| *name == key) {
                let failure = self.0.record(ScanFailure::DuplicateKey);
                return Err(A::Error::custom(failure.message()));
            }
            self.0.push_token(&key);
            let value = accessor.next_value_seed(ValueSeed(self.0))?;
            self.0.pop_token();
            entries.push((key, value));
        }
        self.0.leave();
        Ok(DocumentValue::Mapping(entries))
    }
}

/// 递归种子：把扫描状态沿子节点传递。
struct ValueSeed<'a>(&'a mut ValueScan);

impl<'de, 'a> DeserializeSeed<'de> for ValueSeed<'a> {
    type Value = DocumentValue;

    fn deserialize<D: Deserializer<'de>>(self, deserializer: D) -> Result<DocumentValue, D::Error> {
        from_deserializer(deserializer, self.0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse_with(text: &str, limits: ScanLimits) -> Result<DocumentValue, String> {
        let mut scan = ValueScan::new(limits);
        let result = from_deserializer(serde_yaml::Deserializer::from_str(text), &mut scan)
            .map_err(|error| error.to_string());
        match result {
            Ok(value) => Ok(value),
            Err(message) => Err(format!("{message}|{}", scan.nodes())),
        }
    }

    fn full_limits() -> ScanLimits {
        ScanLimits {
            max_depth: 32,
            node_budget: 1_000_000,
        }
    }

    #[test]
    fn test_scalars_and_containers_keep_order() {
        let value = parse_with("b: 1\na: [x, 2.5, true, ~]\n", full_limits()).expect("可解析");
        let DocumentValue::Mapping(entries) = &value else {
            panic!("根节点应为映射");
        };
        assert_eq!(
            entries.iter().map(|(key, _)| key.as_str()).collect::<Vec<_>>(),
            vec!["b", "a"],
            "映射必须保持文档顺序"
        );
        assert_eq!(entries[0].1, DocumentValue::Integer(1));
        let items = entries[1].1.as_sequence().expect("序列");
        assert_eq!(items[0], DocumentValue::String("x".to_owned()));
        assert_eq!(items[1], DocumentValue::Float(2.5));
        assert_eq!(items[2], DocumentValue::Bool(true));
        assert_eq!(items[3], DocumentValue::Null);
    }

    #[test]
    fn test_duplicate_key_rejected_with_pointer() {
        let mut scan = ValueScan::new(full_limits());
        let error =
            from_deserializer(serde_yaml::Deserializer::from_str("a: 1\na: 2\n"), &mut scan)
                .expect_err("重复键必须失败");
        assert!(error.to_string().contains("映射键重复"), "{error}");
        assert_eq!(scan.failure(), Some(ScanFailure::DuplicateKey));
        assert_eq!(scan.failure_pointer(), Some("/a"));
    }

    #[test]
    fn test_depth_limit_rejected() {
        let mut scan = ValueScan::new(ScanLimits {
            max_depth: 2,
            node_budget: 1_000,
        });
        let error =
            from_deserializer(serde_yaml::Deserializer::from_str("a:\n  b:\n    c: 1\n"), &mut scan)
                .expect_err("超深必须失败");
        assert!(error.to_string().contains("嵌套深度"), "{error}");
        assert_eq!(scan.failure(), Some(ScanFailure::DepthExceeded));
    }

    #[test]
    fn test_node_budget_rejects_alias_bomb() {
        // 锚点展开后节点数受预算约束（§9.1 别名炸弹防护）。
        let text = "a: &anchor [1, 2, 3, 4]\nb: *anchor\nc: *anchor\n";
        let mut scan = ValueScan::new(ScanLimits {
            max_depth: 32,
            node_budget: 6,
        });
        let error = from_deserializer(serde_yaml::Deserializer::from_str(text), &mut scan)
            .expect_err("预算超限必须失败");
        assert!(error.to_string().contains("展开节点"), "{error}");
        assert_eq!(scan.failure(), Some(ScanFailure::NodeBudgetExceeded));
    }

    #[test]
    fn test_pointer_escaping() {
        assert_eq!(escape_pointer_token("a/b~c"), "a~1b~0c");
        let value = parse_with("\"a/b\": 1\n", full_limits()).expect("可解析");
        assert!(value.pointer("/a~1b").is_some(), "指针转义必须可回溯");
    }

    #[test]
    fn test_scan_failure_message() {
        assert_eq!(
            ScanFailure::DuplicateKey.message(),
            "映射键重复"
        );
        assert!(ScanFailure::DepthExceeded.message().contains("深度"));
        assert!(ScanFailure::NodeBudgetExceeded.message().contains("节点"));
    }
}
