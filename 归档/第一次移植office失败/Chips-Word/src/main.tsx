import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "@chips/ui/global.css";
import "../src/assets/fonts/fonts.css";
import "./styles/document-editor.css";
import "./app/app-shell.css";
import "./components/word-workspace.css";
import "./components/start-page-stage.css";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Root element #root was not found.");
}

const root = ReactDOM.createRoot(container);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
