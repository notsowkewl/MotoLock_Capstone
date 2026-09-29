import React from 'react';

declare global {
  interface Window { openAdminPanel?: () => void }
}

// Expose openAdminPanel on top-level window for console testing
window.openAdminPanel = () => {
  const iframe = document.querySelector('iframe') as HTMLIFrameElement;
  if (iframe && iframe.contentWindow) {
    const iframeWindow = iframe.contentWindow as Window & { openAdminPanel?: () => void };
    if (typeof iframeWindow.openAdminPanel === 'function') {
      iframeWindow.openAdminPanel();
    } else {
      console.warn('Admin panel function is loading inside iframe...');
    }
  } else {
    console.error('MotoLock app iframe not found.');
  }
};

function App() {
  return (
    <iframe
      src="/index.html"
      style={{
        width: '100%',
        height: '100vh',
        border: 'none',
      }}
      title="MotoLock"
    />
  );
}

export default App;
