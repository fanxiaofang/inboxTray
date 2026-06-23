import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { getSettings } from './hooks/useDatabase';
import './index.css';

// 启动时应用主题
getSettings().then((s) => {
  document.documentElement.dataset.theme = s.theme;
}).catch(() => {
  document.documentElement.dataset.theme = 'brass';
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
