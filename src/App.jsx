import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { flushSync } from 'react-dom';
import ChecklistView from './ChecklistView';
const AdminView = lazy(() => import('./AdminView'));
import FillChecklistView from './FillChecklistView';
import ReviewPage from './ReviewPage';
import PWAInstallPrompt from './PWAInstallPrompt';
import ErrorBoundary from './components/ErrorBoundary';
import { Toaster } from 'react-hot-toast';
import './App.css';
import { firebaseService } from './services/firebaseService';
import { useLockBodyScroll } from './hooks/useLockBodyScroll';

// Live clock component
function LiveClock() {
  const [time, setTime] = useState('');

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(now.toLocaleString('en-US', { 
        month: 'short', day: 'numeric', year: 'numeric', 
        hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' 
      }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return <span className="live-clock">{time}</span>;
}

function App() {
  const reviewTokenId = useMemo(() => new URLSearchParams(window.location.search).get('review'), []);
  const [authResolved, setAuthResolved] = useState(false);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [selectedChecklist, setSelectedChecklist] = useState(null);
  const [checklists, setChecklists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState(false);
  const [syncErrorMessage, setSyncErrorMessage] = useState('');
  const [theme, setTheme] = useState(() => localStorage.getItem('app-theme') || 'dark');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  // Mobile: which tab is active — 'list' | 'content'
  const [mobileTab, setMobileTab] = useState('list');

  const navigateWithTransition = useCallback((callback) => {
    if (!document.startViewTransition) {
      callback();
      return;
    }
    document.startViewTransition(() => {
      flushSync(() => {
        callback();
      });
    });
  }, []);

  useLockBodyScroll(showLoginModal);

  // Mouse parallax for aurora & 3D background
  const handleMouseMove = useCallback((e) => {
    if (document.hidden) return;
    requestAnimationFrame(() => {
      const x = (e.clientX / window.innerWidth  - 0.5) * 20;
      const y = (e.clientY / window.innerHeight - 0.5) * 20;
      document.documentElement.style.setProperty('--mouseX', `${x}deg`);
      document.documentElement.style.setProperty('--mouseY', `${y}deg`);
    });
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [handleMouseMove]);

  useEffect(() => {
    const unsubscribe = firebaseService.onAuthStateChanged((user) => {
      setIsAdminLoggedIn(!!user);
      setAuthResolved(true);
      if (user) setShowLoginModal(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = firebaseService.subscribeToChecklists((data) => {
      setChecklists(data);
      setLoading(false);
      setSyncError(false);
    }, (error) => {
      console.error('Firestore sync error:', error);
      setSyncError(true);
      setSyncErrorMessage(error?.message || 'Unknown error');
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => {
      const nextTheme = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('app-theme', nextTheme);
      return nextTheme;
    });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await firebaseService.login(username, password);
      setLoginError('');
    } catch (err) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setLoginError('Invalid email or password.');
      } else if (err.code === 'auth/too-many-requests') {
        setLoginError('Too many failed attempts. Try again later.');
      } else {
        setLoginError(err.message || 'Login failed. Please check your connection and try again.');
      }
    }
  };

  // When a checklist is selected on mobile, auto-switch to content tab
  const handleSelectChecklist = (checklist) => {
    setSelectedChecklist(checklist);
    navigateWithTransition(() => setMobileTab('content'));
  };

  // ── Wait for auth to resolve before showing main UI, unless it's a review page ──
  if (reviewTokenId) {
    return <ReviewPage tokenId={reviewTokenId} />;
  }

  if (!authResolved) {
    return (
      <div className="background-3d" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'white', gap: '1rem' }}>
        <div className="review-spinner-big">⚙️</div>
        <h2 style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.05em' }}>CMM Checklist</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Authenticating...</p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Toaster position="bottom-center" />
      {/* ── Animated 3D Background ── */}
      <div className="background-3d">
        <div className="shape-3d cube"></div>
        <div className="shape-3d ring"></div>
        <div className="shape-3d cube"></div>
        <div className="shape-3d diamond"></div>
        <div className="shape-3d ring"></div>
        <div className="shape-3d triangle"></div>
        <div className="shape-3d cube"></div>
        <div className="shape-3d cross"></div>
        <div className="shape-3d ring"></div>
        <div className="shape-3d diamond"></div>
        <div className="shape-3d cube"></div>
        <div className="shape-3d triangle"></div>
        <div className="shape-3d ring"></div>
        <div className="shape-3d cross"></div>
      </div>

      {/* ── Top Header Bar ── */}
      <header className="top-header glass-panel">
        <div className="app-logo">
          <div className="app-logo-icon">⚙️</div>
          <span className="app-logo-text">CMM Checklist</span>
        </div>

        <div className="header-actions">
          <LiveClock />
          <div className="cloud-sync-status" title={syncErrorMessage}>
            <div className={`status-dot ${syncError ? '' : 'online'}`} style={syncError ? { backgroundColor: 'var(--neon-red)', boxShadow: '0 0 8px var(--neon-red)' } : {}}></div>
            <span className="sync-label" style={{maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
              {syncError ? `Offline (${syncErrorMessage})` : 'Live'}
            </span>
          </div>
          <button className="theme-toggle-inline" onClick={toggleTheme} title="Toggle Theme">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          {!isAdminLoggedIn && (
            <button
              className="admin-login-btn"
              onClick={() => setShowLoginModal(true)}
              title="Admin Login"
            >
              🔒 <span className="admin-btn-text">Admin</span>
            </button>
          )}
        </div>
      </header>

      {/* ── Admin Login Modal ── */}
      {showLoginModal && !isAdminLoggedIn && (
        <div className="modal-overlay" onClick={() => setShowLoginModal(false)}>
          <div
            className="modal-content glass-panel"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '420px' }}
          >
            <div className="modal-header">
              <h3>🔐 Admin Login</h3>
              <button className="close-btn" onClick={() => setShowLoginModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ padding: '1.5rem' }}>
              <form onSubmit={handleLogin} className="login-form">
                <div className="input-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="admin@company.com"
                    autoComplete="email"
                  />
                </div>
                <div className="input-group">
                  <label>Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                </div>
                {loginError && <div className="error-message">⚠️ {loginError}</div>}
                <button type="submit" className="primary-btn" style={{ marginTop: '0.5rem' }}>
                  🚀 Log In
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── Main App Layout ── */}
      <div className="app-container">
        {/* Left pane — only visible to regular users */}
        {!isAdminLoggedIn && (
          <>
            <div className={`left-pane-wrapper ${mobileTab === 'list' ? 'mobile-active' : 'mobile-hidden'}`}>
              <ChecklistView
                checklists={checklists}
                loading={loading}
                selectedChecklist={selectedChecklist}
                setSelectedChecklist={handleSelectChecklist}
              />
            </div>
            <div className="divider desktop-only"></div>
          </>
        )}

        {/* Right pane — hidden on mobile when list tab active */}
        <div className={`right-pane-wrapper ${mobileTab === 'content' ? 'mobile-active' : 'mobile-hidden'}`}>
          {isAdminLoggedIn ? (
            <Suspense fallback={
              <div style={{ padding: '24px', width: '100%' }}>
                <div style={{ display: 'flex', gap: '20px', marginBottom: '24px', flexWrap: 'wrap' }}>
                  <div className="skeleton" style={{ width: '220px', height: '120px', borderRadius: '12px' }}></div>
                  <div className="skeleton" style={{ width: '220px', height: '120px', borderRadius: '12px' }}></div>
                  <div className="skeleton" style={{ width: '220px', height: '120px', borderRadius: '12px' }}></div>
                </div>
                <div className="skeleton" style={{ width: '100%', height: '400px', borderRadius: '12px' }}></div>
              </div>
            }>
              <AdminView
                selectedChecklist={selectedChecklist}
                setSelectedChecklist={handleSelectChecklist}
                rawCloudData={checklists}
              />
            </Suspense>
          ) : (
            <FillChecklistView 
              selectedChecklist={selectedChecklist} 
              onBack={() => navigateWithTransition(() => setMobileTab('list'))}
            />
          )}
        </div>
      </div>

      {/* ── Mobile Bottom Tab Bar (Users Only) ── */}
      {!isAdminLoggedIn && (
        <nav className="mobile-bottom-nav glass-panel">
          <button
            className={`mobile-nav-btn ${mobileTab === 'list' ? 'active' : ''}`}
            onClick={() => navigateWithTransition(() => setMobileTab('list'))}
          >
            <span className="mobile-nav-icon">📋</span>
            <span className="mobile-nav-label">Checklists</span>
            {checklists.length > 0 && (
              <span className="mobile-nav-badge">{checklists.length}</span>
            )}
          </button>

          <button
            className={`mobile-nav-btn ${mobileTab === 'content' ? 'active' : ''}`}
            onClick={() => navigateWithTransition(() => setMobileTab('content'))}
          >
            <span className="mobile-nav-icon">✍️</span>
            <span className="mobile-nav-label">Fill Form</span>
          </button>
        </nav>
      )}

      {/* ── PWA Install Prompt ── */}
      <PWAInstallPrompt />
    </ErrorBoundary>
  );
}

export default App;
