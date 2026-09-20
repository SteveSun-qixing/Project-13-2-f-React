//! 薯片平台 Neon 绑定（`chips-native.node`）。
//!
//! 本 crate 是 Rust 核心向 JavaScript 暴露的唯一出口，接口面以
//! 《核心接口规范》§8（Neon 绑定约定）为唯一权威：
//!
//! - 导出表集中在 [`abi`] 中声明，函数名一经登记不得重命名；
//! - `Rust ↔ JS` 值映射与二进制信封见 [`convert`] / [`envelope`]；
//! - 跨边界错误只有 [`chips_core::ChipsError`] 一个形状，见 [`error`]；
//! - 线程约束：JS 值只在 JS 线程操作，跨线程回投只经 [`neon::event::Channel`]；
//! - 绑定层只做类型转换与错误归一，业务逻辑全部位于子系统 crate。
//!
//! 本 crate 不感知插件角色与 `.cpk`；内核启动、插件管理等导出由插件管理层登记。

#![warn(missing_docs)]

mod abi;
mod bridge;
mod cancel;
mod context;
mod convert;
mod envelope;
mod error;
mod handles;
mod runtime;

use neon::prelude::*;

/// 原生模块唯一入口；导出表集中在此声明，不允许散落注册。
#[neon::main]
fn main(mut cx: ModuleContext) -> NeonResult<()> {
    abi::register(&mut cx)?;
    Ok(())
}
