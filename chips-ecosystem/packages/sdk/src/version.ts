/**
 * 平台版本常量（核心接口规范 §3.4、九 §9.2）。
 *
 * SDK 与 `@chips/bridge`、`@chips/host`、`@chips/ui` 及全部 Rust crate 共用同一平台版本号，
 * 任一平台包发布时统一升版，禁止版本漂移（02-SDK-API规范 §10.1、代码组织规范 §3.4）。
 * 本常量与 `package.json` 的 `version` 必须一致，由 `src/version.test.ts` 门禁核对。
 */

/** 平台统一版本；与全部 `@chips/*` 包及 Rust crate 同值。 */
export const PLATFORM_VERSION: string = '0.1.0';
