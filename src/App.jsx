import { useState, useEffect, useCallback } from 'react';
import ChecklistView from './ChecklistView';
import AdminView from './AdminView';
import FillChecklistView from './FillChecklistView';
import ReviewPage from './ReviewPage';
import PWAInstallPrompt from './PWAInstallPrompt';
import './App.css';
import { auth, db } from './firebase';
import { onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth';
import { collection, onSnapshot } from 'firebase/firestore';

// Detect ?review=<tokenId> in URL
const urlParams = new URLSearchParams(window.location.search);
const reviewTokenId = urlParams.get('review');

// Live clock component
function LiveClock() {
  const [time, setTime] = useState('');

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return <span className="live-clock">{time}</span>;
}

function App() {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [selectedChecklist, setSelectedChecklist] = useState(null);
  const [checklists, setChecklists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState('dark');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  // Mobile: which tab is active — 'list' | 'content'
  const [mobileTab, setMobileTab] = useState('list');

  // Mouse parallax for aurora & 3D background
  const handleMouseMove = useCallback((e) => {
    const x = (e.clientX / window.innerWidth  - 0.5) * 20;
    const y = (e.clientY / window.innerHeight - 0.5) * 20;
    document.documentElement.style.setProperty('--mouseX', `${x}deg`);
    document.documentElement.style.setProperty('--mouseY', `${y}deg`);
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [handleMouseMove]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAdminLoggedIn(!!user);
      if (user) setShowLoginModal(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'checklists'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setChecklists(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, username, password);
      setLoginError('');
    } catch {
      setLoginError('Invalid credentials. Please try again.');
    }
  };

  // When a checklist is selected on mobile, auto-switch to content tab
  const handleSelectChecklist = (checklist) => {
    setSelectedChecklist(checklist);
    setMobileTab('content');
  };

  // ── If URL has ?review=tokenId, show ReviewPage (no login needed) ──
  if (reviewTokenId) {
    return <ReviewPage tokenId={reviewTokenId} />;
  }

  return (
    <>
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

        <div className="header-center">
          <LiveClock />
          <div className="cloud-sync-status">
            <div className="status-dot online"></div>
            <span className="sync-label">Live</span>
          </div>
        </div>

        <div className="header-actions">
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
        {/* Left pane — hidden on mobile when content tab active */}
        <div className={`left-pane-wrapper ${mobileTab === 'list' ? 'mobile-active' : 'mobile-hidden'}`}>
          <ChecklistView
            checklists={checklists}
            loading={loading}
            selectedChecklist={selectedChecklist}
            setSelectedChecklist={handleSelectChecklist}
          />
        </div>

        <div className="divider desktop-only"></div>

        {/* Right pane — hidden on mobile when list tab active */}
        <div className={`right-pane-wrapper ${mobileTab === 'content' ? 'mobile-active' : 'mobile-hidden'}`}>
          {isAdminLoggedIn ? (
            <AdminView
              selectedChecklist={selectedChecklist}
              rawCloudData={checklists}
            />
          ) : (
            <FillChecklistView selectedChecklist={selectedChecklist} />
          )}
        </div>
      </div>

      {/* ── Mobile Bottom Tab Bar ── */}
      <nav className="mobile-bottom-nav glass-panel">
        <button
          className={`mobile-nav-btn ${mobileTab === 'list' ? 'active' : ''}`}
          onClick={() => setMobileTab('list')}
        >
          <span className="mobile-nav-icon">📋</span>
          <span className="mobile-nav-label">Checklists</span>
          {checklists.length > 0 && (
            <span className="mobile-nav-badge">{checklists.length}</span>
          )}
        </button>

        <button
          className={`mobile-nav-btn ${mobileTab === 'content' ? 'active' : ''}`}
          onClick={() => setMobileTab('content')}
        >
          <span className="mobile-nav-icon">{isAdminLoggedIn ? '🛠️' : '✍️'}</span>
          <span className="mobile-nav-label">{isAdminLoggedIn ? 'Admin' : 'Fill Form'}</span>
        </button>
      </nav>

      {/* ── PWA Install Prompt ── */}
      <PWAInstallPrompt />
    </>
  );
}

export default App;
