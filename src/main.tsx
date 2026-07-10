// Safeguard for environments where window.fetch has only a getter but some library/script tries to overwrite it
try {
  let currentFetch = window.fetch;
  Object.defineProperty(window, 'fetch', {
    get() {
      return currentFetch;
    },
    set(newFetch) {
      currentFetch = newFetch;
    },
    configurable: true,
    enumerable: true
  });
} catch (e) {
  try {
    let currentFetch = window.fetch;
    Object.defineProperty(Window.prototype, 'fetch', {
      get() {
        return currentFetch;
      },
      set(newFetch) {
        currentFetch = newFetch;
      },
      configurable: true,
      enumerable: true
    });
  } catch (err) {
    console.warn("Unable to redefine window.fetch setter/getter:", err);
  }
}

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
