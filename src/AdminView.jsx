import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { firebaseService } from './services/firebaseService';
import { toast } from 'react-hot-toast';
import Papa from 'papaparse';
import { LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useSubmissions, usePendingTokens } from './hooks/useFirebaseSubscriptions';

import SettingsModal from './components/admin/SettingsModal';
import CreateChecklistModal from './components/admin/CreateChecklistModal';
import EditChecklistModal from './components/admin/EditChecklistModal';
import SubmissionCard from './components/admin/SubmissionCard';
import ShareLinkModal from './ShareLinkModal';

export default function AdminView({ selectedChecklist, setSelectedChecklist, rawCloudData }) {
  const [showSettings, setShowSettings]       = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal]     = useState(false);
  const VALID_TABS = ['dashboard', 'templates', 'submissions', 'rejected'];
  const [adminTab, setAdminTab]               = useState(() => {
    const saved = localStorage.getItem('adminTab');
    return VALID_TABS.includes(saved) ? saved : 'dashboard';
  });
  const [limitCount, setLimitCount]           = useState(20);
  const [searchTerm, setSearchTerm]           = useState('');
  
  const [hiddenSubmissionIds, setHiddenSubmissionIds] = useState([]);
  const [hiddenChecklistIds, setHiddenChecklistIds] = useState([]);
  
  const [shareTokenId, setShareTokenId] = useState(null);
  const [shareSub, setShareSub] = useState(null);
  const [shareTokenExpiresAt, setShareTokenExpiresAt] = useState(null);
  
  const { data: submissions, loading: submissionsLoading } = useSubmissions(limitCount);
  const { data: pendingTokens } = usePendingTokens();

  const visibleSubmissions = submissions.filter(s => !hiddenSubmissionIds.includes(s.id));
  const visibleChecklists = rawCloudData.filter(c => !hiddenChecklistIds.includes(c.id));

  const [bulkSelectedIds, setBulkSelectedIds] = useState([]);

  useEffect(() => {
    localStorage.setItem('adminTab', adminTab);
    setBulkSelectedIds([]); // clear bulk selection on tab change
  }, [adminTab]);

  const handleLogout = useCallback(async () => await firebaseService.logout(), []);

  const handleDeleteChecklist = useCallback(async (checklistOrId) => {
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
    ), { duration: 3000 });

    setTimeout(async () => {
      if (!isUndone) {
        try {
          await firebaseService.deleteChecklist(checklistToHide.id);
          await firebaseService.logEvent('Template Deleted', `Deleted checklist template: "${checklistToHide.title || checklistToHide.id}"`);
        } catch (err) {
          console.error(err);
          toast.error('Failed to delete checklist.');
          setHiddenChecklistIds(prev => prev.filter(id => id !== checklistToHide.id));
        }
      }
    }, 3000);
  }, [rawCloudData, selectedChecklist, setSelectedChecklist]);

  const handleDeleteSubmission = useCallback(async (sub) => {
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
    ), { duration: 3000 });

    setTimeout(async () => {
      if (!isUndone) {
        try {
          await firebaseService.deleteSubmission(sub.id);
          await firebaseService.logEvent('Submission Deleted', `Deleted submission: ${sub.uniqueCode}`);
        } catch (err) {
          console.error(err);
          firebaseService.logEvent('Error', `Failed to delete submission ${sub.uniqueCode}: ${err.message}`);
          toast.error('Failed to delete submission.');
          setHiddenSubmissionIds(prev => prev.filter(id => id !== sub.id));
        }
      }
    }, 3000);
  }, []);

  const handleExportCSV = useCallback(() => {
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
  }, [submissions, pendingTokens, visibleSubmissions]);

  const handleGenerateShareLink = useCallback(async (sub) => {
    try {
      const toastId = toast.loading('Generating link...');
      const expiresAt = new Date(Date.now() + 3600000); // 1 hour
      const tokenData = {
        submissionId: sub.id,
        checklistId: sub.checklistId || '',
        checklistTitle: sub.checklistTitle || '',
        fillerName: sub.fillerName || '',
        notes: sub.notes || '',
        uniqueCode: sub.uniqueCode || '',
        checkpointResponses: sub.checkpointResponses || [],
        generalPhotoUrl: sub.generalPhotoUrl || null,
        cmmSignature: sub.signatures?.cmm || null,
        status: 'pending',
        expiresAt: expiresAt,
        createdAt: firebaseService.getServerTimestamp()
      };
      
      const tokenDoc = await firebaseService.createReviewToken(tokenData);
      toast.dismiss(toastId);
      setShareTokenId(tokenDoc.id);
      setShareSub(sub);
      setShareTokenExpiresAt(expiresAt.getTime());
    } catch (err) {
      console.error(err);
      firebaseService.logEvent('Error', `Failed to generate share link: ${err.message}`);
      toast.error('Failed to generate link');
    }
  }, []);

  const handleDownloadPDF = useCallback(async (sub) => {
    const { generatePDFReport } = await import('./utils/pdfGenerator');
    generatePDFReport(sub);
  }, []);

  const handleBulkToggle = useCallback((id) => {
    setBulkSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, []);

  const handleSelectAll = useCallback((ids) => {
    setBulkSelectedIds(prev => prev.length === ids.length ? [] : ids);
  }, []);

  const handleBulkDelete = useCallback(() => {
    if (!bulkSelectedIds.length) return;
    if (window.confirm(`Are you sure you want to delete ${bulkSelectedIds.length} submissions?`)) {
      setHiddenSubmissionIds(prev => [...prev, ...bulkSelectedIds]);
      toast.success(`${bulkSelectedIds.length} submissions deleted`);
      
      bulkSelectedIds.forEach(async (id) => {
        try {
          await firebaseService.deleteSubmission(id);
        } catch(err) {
          console.error('Failed bulk delete for', id, err);
        }
      });
      firebaseService.logEvent('Bulk Action', `Deleted ${bulkSelectedIds.length} submissions`);
      setBulkSelectedIds([]);
    }
  }, [bulkSelectedIds]);

  // Chart data formatting
  const chartData = useMemo(() => {
    if (!visibleSubmissions.length) return [];
    
    // Group by day for the last 7 days
    const counts = {};
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      counts[d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })] = 0;
    }

    visibleSubmissions.forEach(sub => {
      if (!sub.submittedAt) return;
      const date = new Date(typeof sub.submittedAt.toDate === 'function' ? sub.submittedAt.toDate() : sub.submittedAt);
      const key = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      if (counts[key] !== undefined) {
        counts[key]++;
      }
    });

    return Object.entries(counts).map(([date, count]) => ({ date, count }));
  }, [visibleSubmissions]);

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
                  <span className="metric-value">{visibleSubmissions.filter(s => !s.signatures?.amm && s.status !== 'rejected').length}</span>
                  <span className="metric-label">Pending AMM Signatures</span>
                </div>
              </div>
              <div className="metric-card glass-panel" style={{ borderColor: 'rgba(255, 60, 60, 0.3)' }}>
                <div className="metric-icon">⛔</div>
                <div className="metric-info">
                  <span className="metric-value">{visibleSubmissions.filter(s => s.status === 'rejected').length}</span>
                  <span className="metric-label">AMM Rejected</span>
                </div>
              </div>
            </div>

            {chartData.length > 0 && (
              <div className="trend-chart-wrap">
                <div className="trend-chart-title">Submission Trend (Last 7 Days)</div>
                <div style={{ width: '100%', height: 200 }}>
                  <ResponsiveContainer>
                    <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                      <XAxis dataKey="date" stroke="var(--text-tertiary)" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="var(--text-tertiary)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                      <RechartsTooltip 
                        contentStyle={{ backgroundColor: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
                        itemStyle={{ color: 'var(--accent)' }}
                        cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
                      />
                      <Line type="monotone" dataKey="count" name="Submissions" stroke="var(--accent)" strokeWidth={3} dot={{ fill: 'var(--bg-primary)', stroke: 'var(--accent)', strokeWidth: 2, r: 4 }} activeDot={{ r: 6, fill: 'var(--neon-cyan)' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontFamily: 'var(--font-display)', margin: 0 }}>Recent Submissions</h3>
              <button className="secondary-btn" onClick={handleExportCSV} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                📥 Export CSV
              </button>
            </div>
            {submissionsLoading && submissions.length === 0 ? (
               <div className="admin-templates-grid">
                  <div className="skeleton-card"><div className="skeleton-line"></div><div className="skeleton-line medium"></div></div>
                  <div className="skeleton-card"><div className="skeleton-line"></div><div className="skeleton-line short"></div></div>
                  <div className="skeleton-card"><div className="skeleton-line"></div><div className="skeleton-line"></div></div>
               </div>
            ) : visibleSubmissions.length === 0 ? (
              <div className="empty-state glass-panel">
                 <p style={{ color: 'var(--text-secondary)' }}>No submissions yet.</p>
              </div>
            ) : (
              <div className="admin-templates-grid">
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
                      className="styled-input" 
                      style={{ flex: 1, minWidth: 0, padding: '0.6rem 1rem' }}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <button className="secondary-btn" onClick={handleExportCSV}>
                      📥 Export CSV
                    </button>
                  </div>
                  
                  {bulkSelectedIds.length > 0 && (
                    <div className="bulk-action-bar">
                      <span className="bulk-count">{bulkSelectedIds.length} selected</span>
                      <button className="secondary-btn" onClick={() => setBulkSelectedIds([])} style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}>Cancel</button>
                      <button className="secondary-btn" onClick={handleBulkDelete} style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', color: 'var(--neon-red)', borderColor: 'rgba(239,68,68,0.3)' }}>🗑️ Delete Selected</button>
                    </div>
                  )}

                  {(() => {
                    const filtered = visibleSubmissions.filter(sub => {
                      if (!searchTerm) return true;
                      const term = searchTerm.toLowerCase();
                      const matchesCode = sub.uniqueCode?.toLowerCase().includes(term);
                      const matchesTitle = sub.checklistTitle?.toLowerCase().includes(term);
                      const matchesName = sub.fillerName?.toLowerCase().includes(term) || sub.signatures?.cmm?.name?.toLowerCase().includes(term);
                      return matchesCode || matchesTitle || matchesName;
                    });
                    return (
                      <>
                        <div style={{ marginBottom: '0.75rem', paddingLeft: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                            <input 
                              type="checkbox" 
                              className="bulk-checkbox"
                              checked={filtered.length > 0 && bulkSelectedIds.length === filtered.length}
                              onChange={() => handleSelectAll(filtered.map(s => s.id))}
                            />
                            Select All
                          </label>
                        </div>
                        {filtered.map(sub => {
                          const activeToken = pendingTokens.find(t => t.submissionId === sub.id && t.status === 'pending' && new Date(t.expiresAt?.toDate?.() || t.expiresAt) > new Date());
                          return (
                            <SubmissionCard 
                              key={sub.id} 
                              sub={sub} 
                              activeToken={activeToken} 
                              onDelete={handleDeleteSubmission} 
                              onShareLink={handleGenerateShareLink}
                              bulkSelected={bulkSelectedIds.includes(sub.id)}
                              onBulkToggle={handleBulkToggle}
                              onShowLink={(sub, token) => {
                                setShareTokenId(token.id);
                                setShareSub(sub);
                                setShareTokenExpiresAt(new Date(token.expiresAt?.toDate?.() || token.expiresAt).getTime());
                              }}
                            />
                          );
                        })}
                      </>
                    );
                  })()}
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

      case 'rejected':
        const rejectedSubmissions = visibleSubmissions.filter(sub => sub.status === 'rejected');
        return (
          <div className="submissions-tab animate-fade-in">
            <div className="checklist-container">
              {submissionsLoading && rejectedSubmissions.length === 0 ? (
                <>
                  <div className="skeleton-card"><div className="skeleton-line"></div></div>
                </>
              ) : rejectedSubmissions.length === 0 ? (
                <div className="empty-state glass-panel">
                  <div className="empty-state-icon">✅</div>
                  <h3>No Rejected Checklists</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>All checklists look good!</p>
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: '1rem' }}>
                    <h3 style={{ color: 'var(--neon-red)' }}>Checklists Rejected by AMM</h3>
                  </div>
                  {rejectedSubmissions.map(sub => {
                    const activeToken = pendingTokens.find(t => t.submissionId === sub.id && t.status === 'pending' && new Date(t.expiresAt?.toDate?.() || t.expiresAt) > new Date());
                    return (
                      <SubmissionCard 
                        key={sub.id} 
                        sub={sub} 
                        activeToken={activeToken} 
                        onDelete={handleDeleteSubmission} 
                        onShareLink={handleGenerateShareLink} 
                        onShowLink={(sub, token) => {
                          setShareTokenId(token.id);
                          setShareSub(sub);
                          setShareTokenExpiresAt(new Date(token.expiresAt?.toDate?.() || token.expiresAt).getTime());
                        }}
                      />
                    );
                  })}
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
    <div className="right-pane dashboard-pane animate-slide-in" style={{ padding: 'clamp(1rem, 4vw, 2rem)' }}>
      {/* Portaled modals — rendered into document.body */}
      <SettingsModal showSettings={showSettings} setShowSettings={setShowSettings} rawCloudData={rawCloudData} />
      <CreateChecklistModal showCreateModal={showCreateModal} setShowCreateModal={setShowCreateModal} />
      <EditChecklistModal showEditModal={showEditModal} setShowEditModal={setShowEditModal} selectedChecklist={selectedChecklist} onDelete={handleDeleteChecklist} />
      
      {shareTokenId && shareSub && (
        <ShareLinkModal 
          tokenId={shareTokenId}
          expiresAtMs={shareTokenExpiresAt}
          checklistTitle={shareSub.checklistTitle}
          fillerName={shareSub.fillerName}
          onClose={() => {
            setShareTokenId(null);
            setShareSub(null);
            setShareTokenExpiresAt(null);
          }}
        />
      )}

      {/* Admin Header with Top Nav */}
      <div className="dashboard-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '1rem', marginBottom: '1.5rem' }}>
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
        
        <nav className="admin-nav-tabs glass-panel" style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', padding: '0.5rem' }}>
          {VALID_TABS.map(tab => {
            const getBadge = () => {
              if (tab === 'templates') return visibleChecklists.length || null;
              if (tab === 'submissions') {
                const pendingCount = visibleSubmissions.filter(s => !s.signatures?.amm && s.status !== 'rejected').length;
                return (
                  <>
                    <span>{visibleSubmissions.length}</span>
                    {pendingCount > 0 && <span className="admin-tab-badge-pending" title={`${pendingCount} pending AMM`}>{pendingCount}</span>}
                  </>
                );
              }
              if (tab === 'rejected') {
                const count = visibleSubmissions.filter(s => s.status === 'rejected').length;
                return count > 0 ? count : null;
              }
              return null;
            };

            const badgeContent = getBadge();
            return (
              <button
                key={tab}
                className={`admin-tab ${adminTab === tab ? 'active' : ''}`}
                onClick={() => setAdminTab(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {badgeContent !== null && (
                  <span className="admin-tab-badge">{badgeContent}</span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {renderTabContent()}
    </div>
  );
}
