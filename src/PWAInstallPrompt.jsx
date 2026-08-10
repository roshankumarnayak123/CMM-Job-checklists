import { useState, useEffect } from 'react';
import './App.css';

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Check if the app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
      return; // Already installed
    }

    const handler = (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Update UI notify the user they can install the PWA
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    // We no longer need the prompt. Clear it up.
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleClose = () => {
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="pwa-install-banner animate-slide-up">
      <div className="pwa-banner-content">
        <div className="pwa-banner-icon">
          <img src="/icon-192x192.svg" alt="App Icon" style={{ width: '40px', height: '40px' }} />
        </div>
        <div className="pwa-banner-text">
          <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontWeight: 700 }}>
            Install CMM Checklist
          </h4>
          <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Add to your home screen for offline access and better experience.
          </p>
        </div>
      </div>
      <div className="pwa-banner-actions">
        <button className="secondary-btn" onClick={handleClose} style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem', minHeight: '32px' }}>
          Later
        </button>
        <button className="primary-btn" onClick={handleInstallClick} style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', minHeight: '32px' }}>
          Install
        </button>
      </div>
    </div>
  );
}
