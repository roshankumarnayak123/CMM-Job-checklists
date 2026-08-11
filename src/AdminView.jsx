import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './App.css';
import { auth, db } from './firebase';
import { signOut } from 'firebase/auth';
import { collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { generatePDFReport } from './utils/pdfGenerator';

import SettingsModal from './components/admin/SettingsModal';
import CreateChecklistModal from './components/admin/CreateChecklistModal';
import EditChecklistModal from './components/admin/EditChecklistModal';
import SubmissionCard from './components/admin/SubmissionCard';

export default function AdminView({ selectedChecklist, setSelectedChecklist, rawCloudData }) {
  const [showSettings, setShowSettings]       = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal]     = useState(false);
  const VALID_TABS = ['dashboard', 'templates', 'submissions'];
  const [adminTab, setAdminTab]               = useState(() => {
    const saved = localStorage.getItem('adminTab');
    return VALID_TABS.includes(saved) ? saved : 'dashboard';
  });
  const [submissions, setSubmissions]         = useState([]);
  const [limitCount, setLimitCount]           = useState(20);
  const [pendingTokens, setPendingTokens]     = useState([]);

  useEffect(() => {
    localStorage.setItem('adminTab', adminTab);
  }, [adminTab]);

  useEffect(() => {
    const q = query(collection(db, 'filled_checklists'), orderBy('submittedAt', 'desc'), limit(limitCount));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSubmissions(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error('Failed to load filled checklists:', error);
    });
    return () => unsubscribe();
  }, [limitCount]);

  // Bug #6 fix: load pending review tokens so they appear in CSV export
  useEffect(() => {
    const q = query(collection(db, 'review_tokens'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setPendingTokens(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.error('Failed to load review tokens:', err);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => await signOut(auth);

  const handleDeleteChecklist = async () => {
    if (!selectedChecklist) return;
    const confirmDelete = window.confirm(`Are you sure you want to delete "${selectedChecklist.title}"? This cannot be undone.`);
    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, 'checklists', selectedChecklist.id));
      if (setSelectedChecklist) setSelectedChecklist(null);
    } catch (err) {
      console.error(err);
      alert('Failed to delete checklist.');
    }
  };

  const handleDeleteSubmission = async (sub) => {
    const confirmDelete = window.confirm(`Are you sure you want to delete submission ${sub.uniqueCode} (${sub.checklistTitle})?`);
    if (!confirmDelete) return;

    try {
      await deleteDoc(doc(db, 'filled_checklists', sub.id));
    } catch (err) {
      console.error(err);
      alert('Failed to delete submission.');
    }
  };

  const handleExportCSV = () => {
    if (submissions.length === 0 && pendingTokens.length === 0) {
      alert('No submissions to export.');
      return;
    }
    const headers = ['ID', 'Type', 'Title', 'Code', 'Date', 'CMM Name', 'AMM Name', 'Status'];

    // Fully completed submissions from filled_checklists
    const completedRows = submissions.map(sub => {
      const date = sub.submittedAt ? new Date(typeof sub.submittedAt.toDate === 'function' ? sub.submittedAt.toDate() : sub.submittedAt).toLocaleString() : 'N/A';
      return [
        sub.id,
        'Completed',
        `"${sub.checklistTitle || ''}"`,
        sub.uniqueCode,
        `"${date}"`,
        `"${sub.signatures?.cmm?.name || ''}"`,
        `"${sub.signatures?.amm?.name || ''}"`,
        sub.signatures?.amm ? 'Completed' : 'Pending AMM'
      ].join(',');
    });

    // Bug #6 fix: include pending review tokens in the export
    const pendingRows = pendingTokens
      .filter(t => t.status !== 'completed') // skip already-completed ones (they'll be in filled_checklists)
      .map(token => {
        const date = token.createdAt ? new Date(typeof token.createdAt.toDate === 'function' ? token.createdAt.toDate() : token.createdAt).toLocaleString() : 'N/A';
        return [
          token.id,
          'Pending Review',
          `"${token.checklistTitle || ''}"`,
          token.uniqueCode || '',
          `"${date}"`,
          `"${token.cmmSignature?.name || ''}"`,
          '', // AMM has not signed yet
          'Pending AMM Signature'
        ].join(',');
      });

    const csvContent = 'data:text/csv;charset=utf-8,' + headers.join(',') + '\n' + [...completedRows, ...pendingRows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `submissions_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /* ── Tab Rendering ── */
  const renderTabContent = () => {
    switch (adminTab) {
      case 'dashboard':
        return (
          <div className="dashboard-overview animate-fade-in">
            <div className="overview-metrics">
              <div className="metric-card glass-panel">
                <div className="metric-icon">📄</div>
                <div className="metric-info">
                  <span className="metric-value">{submissions.length}</span>
                  <span className="metric-label">Total Filled Checklists</span>
                </div>
              </div>
              <div className="metric-card glass-panel">
                <div className="metric-icon">⏳</div>
                <div className="metric-info">
                  <span className="metric-value">{submissions.filter(s => !s.signatures?.amm).length}</span>
                  <span className="metric-label">Pending AMM Signatures</span>
                </div>
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontFamily: 'var(--font-display)', margin: 0 }}>Recent Submissions</h3>
              <button className="secondary-btn" onClick={handleExportCSV} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                📥 Export CSV
              </button>
            </div>
            {submissions.length === 0 ? (
              <div className="empty-state glass-panel">
                 <p style={{ color: 'var(--text-secondary)' }}>No submissions yet.</p>
              </div>
            ) : (
              <div className="horizontal-submissions-scroll">
                {submissions.map(sub => (
                  <div key={sub.id} className="mini-sub-card glass-panel">
                    <div className="mini-sub-header">
                      <strong>{sub.uniqueCode}</strong>
                      <span className={`status-dot ${sub.signatures?.amm ? 'online' : 'pending'}`}></span>
                    </div>
                    <div className="mini-sub-title" style={{ marginTop: '0.4rem', fontSize: '0.85rem', fontWeight: 600 }}>{sub.checklistTitle}</div>
                    <div className="mini-sub-date" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.8rem' }}>
                      {sub.submittedAt 
                        ? new Date(typeof sub.submittedAt.toDate === 'function' ? sub.submittedAt.toDate() : sub.submittedAt).toLocaleDateString() 
                        : 'Just now'}
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', marginTop: 'auto' }}>
                      <button className="secondary-btn" onClick={() => generatePDFReport(sub)} style={{ flex: 1, padding: '0.4rem', fontSize: '0.75rem' }}>
                        PDF
                      </button>
                      <button className="secondary-btn" onClick={() => handleDeleteSubmission(sub)} style={{ padding: '0.4rem', fontSize: '0.75rem', color: 'var(--neon-red)' }}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      
      case 'templates':
        return (
          <div className="templates-tab animate-fade-in">
            {rawCloudData.length === 0 ? (
              <div className="empty-state glass-panel">
                 <p style={{ color: 'var(--text-secondary)' }}>No checklists exist yet.</p>
              </div>
            ) : (
              <div className="admin-templates-grid">
                {rawCloudData.map((checklist, idx) => {
                  const accents = ['var(--accent)', 'var(--neon-cyan)', 'var(--neon-green)', 'var(--neon-pink)', 'var(--neon-amber)'];
                  const accent = accents[idx % accents.length];
                  return (
                    <div
                      key={checklist.id}
                      className="checklist-card glass-panel"
                      style={{ '--card-accent': accent, '--card-accent-glow': accent, cursor: 'pointer' }}
                      onClick={() => {
                        if (setSelectedChecklist) setSelectedChecklist(checklist);
                        setShowEditModal(true);
                      }}
                    >
                      <div className="card-title">{checklist.title}</div>
                      {checklist.description && (
                        <div className="card-desc">{checklist.description}</div>
                      )}
                      <div className="card-meta">
                        {checklist.checkpoints?.length > 0 && (
                          <span className="checkpoint-badge">
                            {checklist.checkpoints.length} checkpoint{checklist.checkpoints.length !== 1 ? 's' : ''}
                          </span>
                        )}
                        <span className="checkpoint-badge" style={{ background: 'rgba(139,92,246,0.15)', color: 'var(--accent-hover)', borderColor: 'rgba(139,92,246,0.3)' }}>
                          ✏️ Edit
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );

      case 'submissions':
        return (
          <div className="submissions-tab animate-fade-in">
            <div className="checklist-container">
              {submissions.length === 0 ? (
                <div className="empty-state glass-panel">
                  <div className="empty-state-icon">📭</div>
                  <h3>No Submissions Yet</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Filled checklists will appear here.</p>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                    <button className="secondary-btn" onClick={handleExportCSV}>
                      📥 Export CSV
                    </button>
                  </div>
                  {submissions.map(sub => <SubmissionCard key={sub.id} sub={sub} onDelete={handleDeleteSubmission} />)}
                  {submissions.length === limitCount && (
                    <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                      <button className="secondary-btn" onClick={() => setLimitCount(prev => prev + 20)}>Load More</button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  /* ── Main admin dashboard ── */
  return (
    <div className="right-pane dashboard-pane animate-slide-in" style={{ padding: '2rem' }}>
      {/* Portaled modals — rendered into document.body */}
      <SettingsModal showSettings={showSettings} setShowSettings={setShowSettings} rawCloudData={rawCloudData} />
      <CreateChecklistModal showCreateModal={showCreateModal} setShowCreateModal={setShowCreateModal} />
      <EditChecklistModal showEditModal={showEditModal} setShowEditModal={setShowEditModal} selectedChecklist={selectedChecklist} onDelete={handleDeleteChecklist} />

      {/* Admin Header with Top Nav */}
      <div className="dashboard-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <h2>Admin Dashboard</h2>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="primary-btn" onClick={() => setShowCreateModal(true)}>
              ✨ New Checklist
            </button>
            <button
              className="secondary-btn glass-panel"
              onClick={() => setShowSettings(true)}
              title="Settings"
            >
              ⚙️ Settings
            </button>
            <button onClick={handleLogout} className="secondary-btn" style={{ color: 'var(--neon-red)' }}>
              Log Out
            </button>
          </div>
        </div>
        
        <div className="admin-nav-tabs">
          <button 
            className={`admin-tab ${adminTab === 'dashboard' ? 'active' : ''}`} 
            onClick={() => setAdminTab('dashboard')}
          >
            Overview
          </button>
          <button 
            className={`admin-tab ${adminTab === 'templates' ? 'active' : ''}`} 
            onClick={() => setAdminTab('templates')}
          >
            Checklists
          </button>
          <button 
            className={`admin-tab ${adminTab === 'submissions' ? 'active' : ''}`} 
            onClick={() => setAdminTab('submissions')}
          >
            Submissions
            {submissions.length > 0 && <span className="admin-tab-badge">{submissions.length}</span>}
          </button>
        </div>
      </div>

      {renderTabContent()}
    </div>
  );
}
