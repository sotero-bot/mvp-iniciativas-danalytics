import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './i18n';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Suspense fallback={<div style={{ padding: 24 }}>…</div>}>
      <App />
    </Suspense>
  </React.StrictMode>
);
