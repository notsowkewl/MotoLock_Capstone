import React from 'react';

// Expose openAdminPanel on top-level window for console testing
(window as any).openAdminPanel = () => {
  const iframe = document.querySelector('iframe') as HTMLIFrameElement;
  if (iframe && iframe.contentWindow) {
    if (typeof (iframe.contentWindow as any).openAdminPanel === 'function') {
      (iframe.contentWindow as any).openAdminPanel();
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