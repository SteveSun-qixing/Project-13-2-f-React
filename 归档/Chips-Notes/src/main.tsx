/**
 * 笔记应用主入口
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppRoot } from './app/AppRoot';
import './styles/global.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('找不到根元素 #root');
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AppRoot />
  </React.StrictMode>
);
