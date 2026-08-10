import { useState, useEffect, useCallback } from 'react';
import ChecklistView from './ChecklistView';
import AdminView from './AdminView';
import FillChecklistView from './FillChecklistView';
import './App.css';
import { auth, db } from './firebase';
import { onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth';
import { collection, onSnapshot } from 'firebase/firestore';

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
            <span>Live</span>
          </div>
        </div>

        <div className="header-actions">
          {!isAdminLoggedIn && (
            <button
              className="admin-login-btn"
              onClick={() => setShowLoginModal(true)}
              title="Admin Login"
            >
              🔒 Admin
            </button>
          )}
        </div>
      </header>

      {/* ── Theme Toggle ── */}
      <button className="theme-toggle glass-panel" onClick={toggleTheme} title="Toggle Theme">
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>

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
            <div className="modal-body" style={{ padding: '2rem' }}>
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
        <ChecklistView
          checklists={checklists}
          loading={loading}
          selectedChecklist={selectedChecklist}
          setSelectedChecklist={setSelectedChecklist}
        />
        <div className="divider"></div>
        {isAdminLoggedIn ? (
          <AdminView
            selectedChecklist={selectedChecklist}
            rawCloudData={checklists}
          />
        ) : (
          <FillChecklistView selectedChecklist={selectedChecklist} />
        )}
      </div>
    </>
  );
}

export default App;
