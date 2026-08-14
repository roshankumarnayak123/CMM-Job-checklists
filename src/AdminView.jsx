import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './App.css';
import { firebaseService } from './services/firebaseService';
import { toast } from 'react-hot-toast';
import Papa from 'papaparse';
import { useSubmissions, usePendingTokens } from './hooks/useFirebaseSubscriptions';

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
  const [limitCount, setLimitCount]           = useState(20);
  const [searchTerm, setSearchTerm]           = useState('');
  
  const [hiddenSubmissionIds, setHiddenSubmissionIds] = useState([]);
  const [hiddenChecklistIds, setHiddenChecklistIds] = useState([]);
  
  const { data: submissions, loading: submissionsLoading } = useSubmissions(limitCount);
  const { data: pendingTokens } = usePendingTokens();

  const visibleSubmissions = submissions.filter(s => !hiddenSubmissionIds.includes(s.id));
  const visibleChecklists = rawCloudData.filter(c => !hiddenChecklistIds.includes(c.id));

  useEffect(() => {
    localStorage.setItem('adminTab', adminTab);
  }, [adminTab]);

  const handleLogout = async () => await firebaseService.logout();

  const handleDeleteChecklist = (checklistOrId) => {
    const checklistId = typeof checklistOrId === 'string' ? checklistOrId : checklistOrId?.id;
    const checklistToHide = checklistId ? rawCloudData.find(c => c.id === checklistId) : selectedChecklist;
    if (!checklistToHide) return;

    setHiddenChecklistIds(prev => [...prev, checklistToHide.id]);
    if (setSelectedChecklist && selectedChecklist?.id === checklistToHide.id) {
      setSelectedChecklist(null);
    }
    setShowEditModal(false);

    let isUndone = false;
    toast((t) => (
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span>Checklist deleted.</span>
        <button 
          className="undo-toast-btn"
          onClick={() => {
            isUndone = true;
            toast.dismiss(t.id);
            setHiddenChecklistIds(prev => prev.filter(id => id !== checklistToHide.id));
          }}
        >
          Undo
        </button>
      </div>
    ), { duration: 5000 });

    setTimeout(async () => {
      if (!isUndone) {
        try {
          await firebaseService.deleteChecklist(checklistToHide.id);
        } catch (err) {
          console.error(err);
          toast.error('Failed to delete checklist.');
          setHiddenChecklistIds(prev => prev.filter(id => id !== checklistToHide.id));
        }
      }
    }, 5000);
  };

  const handleDeleteSubmission = (sub) => {
    setHiddenSubmissionIds(prev => [...prev, sub.id]);
    
    let isUndone = false;
    toast((t) => (
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span>Submission deleted.</span>
        <button 
          className="undo-toast-btn"
          onClick={() => {
            isUndone = true;
            toast.dismiss(t.id);
            setHiddenSubmissionIds(prev => prev.filter(id => id !== sub.id));
          }}
        >
          Undo
        </button>
      </div>
    ), { duration: 5000 });

    setTimeout(async () => {
      if (!isUndone) {
        try {
          await firebaseService.deleteSubmission(sub.id);
        } catch (err) {
          console.error(err);
          toast.error('Failed to delete submission.');
          setHiddenSubmissionIds(prev => prev.filter(id => id !== sub.id));
        }
      }
    }, 5000);
  };

  const handleExportCSV = () => {
    if (submissions.length === 0 && pendingTokens.length === 0) {
      toast.error('No submissions to export.');
      return;
    }

    // Fully completed submissions from filled_checklists
    const completedRows = visibleSubmissions.map(sub => {
      const date = sub.submittedAt ? new Date(typeof sub.submittedAt.toDate === 'function' ? sub.submittedAt.toDate() : sub.submittedAt).toLocaleString() : 'N/A';
      return {
        ID: sub.id,
        Type: 'Completed',
        Title: sub.checklistTitle,
        Code: sub.uniqueCode,
        Date: date,
        'CMM Name': sub.signatures?.cmm?.name || '',
        'AMM Name': sub.signatures?.amm?.name || '',
        Status: sub.signatures?.amm ? 'Completed' : 'Pending AMM'
      };
    });

    // Bug #6 fix: include pending review tokens in the export
    const pendingRows = pendingTokens
      .filter(t => t.status !== 'completed') // skip already-completed ones (they'll be in filled_checklists)
      .map(token => {
        const date = token.createdAt ? new Date(typeof token.createdAt.toDate === 'function' ? token.createdAt.toDate() : token.createdAt).toLocaleString() : 'N/A';
        return {
          ID: token.id,
          Type: 'Pending Review',
          Title: token.checklistTitle,
          Code: token.uniqueCode || '',
          Date: date,
          'CMM Name': token.cmmSignature?.name || '',
          'AMM Name': '', // AMM has not signed yet
          Status: 'Pending AMM Signature'
        };
      });

    const csvContent = Papa.unparse([...completedRows, ...pendingRows]);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `submissions_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPDF = async (sub) => {
    const { generatePDFReport } = await import('./utils/pdfGenerator');
    generatePDFReport(sub);
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
                  <span className="metric-value">{visibleSubmissions.length}</span>
                  <span className="metric-label">Total Filled Checklists</span>
                </div>
              </div>
              <div className="metric-card glass-panel">
                <div className="metric-icon">⏳</div>
                <div className="metric-info">
                  <span className="metric-value">{visibleSubmissions.filter(s => !s.signatures?.amm).length}</span>
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
            {submissionsLoading && submissions.length === 0 ? (
               <div className="horizontal-submissions-scroll">
                  <div className="skeleton-card" style={{minWidth: '250px'}}><div className="skeleton-line"></div><div className="skeleton-line medium"></div></div>
                  <div className="skeleton-card" style={{minWidth: '250px'}}><div className="skeleton-line"></div><div className="skeleton-line short"></div></div>
                  <div className="skeleton-card" style={{minWidth: '250px'}}><div className="skeleton-line"></div><div className="skeleton-line"></div></div>
               </div>
            ) : visibleSubmissions.length === 0 ? (
              <div className="empty-state glass-panel">
                 <p style={{ color: 'var(--text-secondary)' }}>No submissions yet.</p>
              </div>
            ) : (
              <div className="horizontal-submissions-scroll">
                {visibleSubmissions.map(sub => (
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
                      <button className="secondary-btn" onClick={() => handleDownloadPDF(sub)} style={{ flex: 1, padding: '0.4rem', fontSize: '0.75rem' }}>
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
            {visibleChecklists.length === 0 ? (
              <div className="empty-state glass-panel">
                 <p style={{ color: 'var(--text-secondary)' }}>No checklists exist yet.</p>
              </div>
            ) : (
              <div className="admin-templates-grid">
                {visibleChecklists.map((checklist, idx) => {
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
              {submissionsLoading && submissions.length === 0 ? (
                <>
                  <div className="skeleton-card"><div className="skeleton-line"></div></div>
                  <div className="skeleton-card"><div className="skeleton-line short"></div></div>
                  <div className="skeleton-card"><div className="skeleton-line medium"></div></div>
                </>
              ) : visibleSubmissions.length === 0 ? (
                <div className="empty-state glass-panel">
                  <div className="empty-state-icon">📭</div>
                  <h3>No Submissions Yet</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Filled checklists will appear here.</p>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <input 
                      type="text" 
                      placeholder="Search submissions by code, title, or name..." 
                      className="text-input" 
                      style={{ flex: 1, minWidth: '250px' }}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <button className="secondary-btn" onClick={handleExportCSV}>
                      📥 Export CSV
                    </button>
                  </div>
                  {visibleSubmissions
                    .filter(sub => {
                      if (!searchTerm) return true;
                      const term = searchTerm.toLowerCase();
                      const matchesCode = sub.uniqueCode?.toLowerCase().includes(term);
                      const matchesTitle = sub.checklistTitle?.toLowerCase().includes(term);
                      const matchesName = sub.fillerName?.toLowerCase().includes(term) || sub.signatures?.cmm?.name?.toLowerCase().includes(term);
                      return matchesCode || matchesTitle || matchesName;
                    })
                    .map(sub => <SubmissionCard key={sub.id} sub={sub} onDelete={handleDeleteSubmission} />)}
                  {visibleSubmissions.length === limitCount && (
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
            <button className="primary-btn mobile-fab" onClick={() => setShowCreateModal(true)}>
              <span className="desktop-text">+ New Checklist</span>
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
            {visibleSubmissions.length > 0 && <span className="admin-tab-badge">{visibleSubmissions.length}</span>}
          </button>
        </div>
      </div>

      {renderTabContent()}
    </div>
  );
}
