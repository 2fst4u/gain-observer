import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './styles/global.css';
import { App } from './App';
import { ErrorBoundary } from './components/UI/ErrorBoundary';

// Global diagnostics so any unhandled error lands in the console with
// actionable context rather than silently crashing the tab.
window.addEventListener('error', (e) => {
  console.error('[window.error]', e.message, e.error);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[unhandledrejection]', e.reason);
});

// Register PWA service worker
registerSW({ immediate: true });

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');
createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
