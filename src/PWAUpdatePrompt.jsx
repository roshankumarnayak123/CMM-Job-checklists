import { useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import './App.css';

export default function PWAUpdatePrompt() {
  const [isUpdating, setIsUpdating] = useState(false);
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered:', r);
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  const handleUpdate = () => {
    setIsUpdating(true);
    updateServiceWorker(true);
  };

  // Only show the prompt if there's a new update, or if the app just became ready to work offline.
  if (!needRefresh && !offlineReady) return null;

  return (
    <div className="pwa-install-banner animate-slide-up" style={{ zIndex: 10000, flexDirection: 'column', padding: isUpdating ? '1rem' : undefined }}>
      <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="pwa-banner-content" style={{ margin: 0 }}>
          <div className="pwa-banner-icon">
            <img src="/CMM-Job-checklists/icon-192x192.svg" alt="App Icon" style={{ width: '40px', height: '40px' }} />
          </div>
          <div className="pwa-banner-text">
            <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontWeight: 700 }}>
              {isUpdating ? 'Updating App...' : (offlineReady ? 'App Ready Offline' : 'Update Available')}
            </h4>
            <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {isUpdating 
                ? 'Please wait while we refresh the app.'
                : (offlineReady 
                    ? 'You can now use this app without an internet connection.' 
                    : 'A new version of the app is available. Please update.')}
            </p>
          </div>
        </div>
        {!isUpdating && (
          <div className="pwa-banner-actions" style={{ margin: 0 }}>
            {needRefresh ? (
              <button className="primary-btn" onClick={handleUpdate} style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', minHeight: '32px' }}>
                Update App
              </button>
            ) : null}
            <button className="secondary-btn" onClick={close} style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem', minHeight: '32px' }}>
              Close
            </button>
          </div>
        )}
      </div>
      
      {/* ── Status / Progress Bar ── */}
      {isUpdating && (
        <div style={{ width: '100%', height: '4px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '2px', marginTop: '1rem', overflow: 'hidden' }}>
          <div className="indeterminate-progress-bar" style={{ height: '100%', backgroundColor: 'var(--primary-color)', width: '30%' }}></div>
        </div>
      )}
    </div>
  );
}
