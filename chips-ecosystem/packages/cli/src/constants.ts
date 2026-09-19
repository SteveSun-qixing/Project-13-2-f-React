/**
 * CLI 常量。
 *
 * 数值一律引自权威文档，本文件只做命名引用，不新造平台基线：
 * - `LIFECYCLE_APPLY_TIMEOUT`：30s（[薯片内核设计] §6.7、§6.6 表），
 *   CLI 用于"等待应用实例启动与命令注册"的超时（[CLI 完整参考] §5.3.2）；
 * - 轮询与取消确认窗口为本进程实现细节，只影响等待节奏，不构成性能基线。
 */

/** 内核生命周期 apply 超时（30s）。 */
export const LIFECYCLE_APPLY_TIMEOUT_MS = 30_000;

/** 任务终态轮询间隔（ms）。 */
export const TASK_POLL_INTERVAL_MS = 50;

/** 取消请求后的终态确认轮询间隔（ms）。 */
export const CANCEL_CONFIRM_POLL_INTERVAL_MS = 50;

/** 取消请求后的终态确认轮询次数上限（超过则按未上报任务收口，[CLI 完整参考] §5.7.5）。 */
export const CANCEL_CONFIRM_POLL_LIMIT = 20;
