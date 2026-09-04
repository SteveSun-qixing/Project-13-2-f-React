import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";


const container = document.getElementById("root");

if (!container) {
  throw new Error("未找到根节点 #root");
}

const root = ReactDOM.createRoot(container);

// 注：Strict Mode 可能会导致 useEffect 重复调用，
// 但在正确的实现下这应是安全的且能暴露副作用问题。
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
