/**
 * 测试期模块声明：Vite `?raw` 编译期内联（manifest 单一事实源锁定消费位）。
 */
declare module '*?raw' {
  const content: string;
  export default content;
}
