import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./features/shell/editor-shell.css";
import { createLogger, createTraceId } from "../config/logging";

const bootstrapTraceId = createTraceId("bootstrap");
const logger = createLogger({ scope: "bootstrap", traceId: bootstrapTraceId });

window.addEventListener("error", (event) => {
  logger.error("捕获到全局 window error", {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
  });
});

window.addEventListener("unhandledrejection", (event) => {
  logger.error("捕获到全局 unhandledrejection", {
    reason: event.reason,
  });
});

const container = document.getElementById("root");

if (!container) {
  logger.error("未找到根节点 #root");
  throw new Error("未找到根节点 #root");
}

const root = ReactDOM.createRoot(container);
logger.info("开始挂载编辑引擎应用壳层");

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
