import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./app/app-shell.css";

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
