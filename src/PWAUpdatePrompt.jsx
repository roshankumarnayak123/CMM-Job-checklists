import { useState, useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import './App.css';

export default function PWAUpdatePrompt() {
  const [isUpdating, setIsUpdating] = useState(false);
  const [swRegistration, setSwRegistration] = useState(null);
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered:', r);
      if (r) {
        setSwRegistration(r);
      }
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  useEffect(() => {
    if (!swRegistration) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('App opened/visible. Checking for updates...');
        swRegistration.update();
      }
    };

    // Check for updates when the app becomes visible
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Also check for updates periodically (every 1 hour)
    const intervalId = setInterval(() => {
      swRegistration.update();
    }, 60 * 60 * 1000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(intervalId);
    };
  }, [swRegistration]);

  useEffect(() => {
    // Expose update functions globally so SettingsModal can trigger the update
    window.__pwaUpdateAvailable = needRefresh;
    window.__pwaPerformUpdate = () => {
      setIsUpdating(true);
      updateServiceWorker(true);
    };
  }, [needRefresh, updateServiceWorker]);

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
                    : 'A new version of the app is available. Please go to Settings to update.')}
            </p>
          </div>
        </div>
        {!isUpdating && (
          <div className="pwa-banner-actions" style={{ margin: 0 }}>
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
