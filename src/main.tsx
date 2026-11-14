import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

declare global {
  interface Window {
    gm_authFailure?: () => void;
    __gmpQuotaExceeded?: boolean;
  }
}

function triggerQuotaBanner() {
  window.__gmpQuotaExceeded = true;
  window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
}

window.gm_authFailure = () => {
  triggerQuotaBanner();
};

const origConsoleError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  const joined = args.map((a) => (typeof a === 'string' ? a : String(a))).join(' ');
  if (
    joined.includes('OverQuotaMapError') ||
    joined.includes('QuotaExceededError') ||
    joined.includes('QuotaExceeded')
  ) {
    triggerQuotaBanner();
  }
  origConsoleError(...args);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
