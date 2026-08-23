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

// Global safeguard for unhandled promise rejections (such as benign AbortError / user aborted requests)
window.addEventListener('unhandledrejection', (event) => {
  const reason = event?.reason;
  const message = reason?.message || String(reason || '');
  const name = reason?.name || '';

  // Suppress harmless DOMException aborts triggered on component unmounts / rapid navigation
  if (
    name === 'AbortError' ||
    message.includes('The user aborted a request') ||
    message.includes('aborted') ||
    message.includes('cancelled')
  ) {
    event.preventDefault();
    console.warn('Suppressed benign async abort:', message);
    return;
  }
});

window.addEventListener('error', (event) => {
  const message = event?.message || '';
  if (message.includes('The user aborted a request') || message.includes('AbortError')) {
    event.preventDefault();
    console.warn('Suppressed benign abort error event:', message);
    return;
  }
});

import { Component, ErrorInfo, ReactNode, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class RootErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by RootErrorBoundary:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white p-6 font-sans">
          <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto text-2xl font-bold">
              !
            </div>
            <h2 className="text-xl font-bold">কিছু সমস্যা হয়েছে (Something went wrong)</h2>
            <p className="text-sm text-slate-300">
              {this.state.error?.message || 'একটি অনাকাঙ্ক্ষিত ত্রুটি ঘটেছে। অনুগ্রহ করে পেজটি রিলোড করুন।'}
            </p>
            <button
              onClick={this.handleReload}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-md cursor-pointer"
            >
              পেজ রিলোড করুন (Reload)
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>,
);
