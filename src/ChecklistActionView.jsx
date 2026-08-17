import { useState, useEffect } from 'react';
import { useSubmissionsByChecklist, useTokensByChecklist } from './hooks/useFirebaseSubscriptions';
import { firebaseService } from './services/firebaseService';
import { toast } from 'react-hot-toast';

import SubmissionCard from './components/admin/SubmissionCard';
import ShareLinkModal from './ShareLinkModal';
import FillChecklistView from './FillChecklistView';

export default function ChecklistActionView({ selectedChecklist, onBack }) {
  const [mode, setMode] = useState('menu'); // 'menu', 'fill', 'history'
  const [editSubmission, setEditSubmission] = useState(null);
  
  const { data: submissions, loading: subLoading } = useSubmissionsByChecklist(selectedChecklist?.id);
  const { data: pendingTokens } = useTokensByChecklist(selectedChecklist?.id);
  
  const [shareTokenId, setShareTokenId] = useState(null);
  const [shareSub, setShareSub] = useState(null);
  const [shareTokenExpiresAt, setShareTokenExpiresAt] = useState(null);
  
  useEffect(() => {
    // Reset to menu if a new checklist is selected
    setMode('menu');
    setEditSubmission(null);
  }, [selectedChecklist]);

  if (!selectedChecklist) {
    return (
      <div className="right-pane dashboard-pane">
        <div className="empty-state glass-panel animate-fade-in">
          <div className="empty-state-icon">📋</div>
          <h3>No Checklist Selected</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
            Pick a checklist from the left panel to start.
          </p>
        </div>
      </div>
    );
  }

  if (mode === 'fill') {
    return <FillChecklistView selectedChecklist={selectedChecklist} editSubmission={editSubmission} onBack={() => { setMode('menu'); setEditSubmission(null); }} />;
  }

  if (mode === 'history') {
    return (
      <div className="right-pane dashboard-pane animate-slide-in" style={{ padding: '2rem' }}>
        <div className="dashboard-header" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
          <div>
            <h2>Filled Checklists</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem', fontFamily: 'var(--font-display)' }}>
              History for: <strong>{selectedChecklist.title}</strong>
            </p>
          </div>
          <button className="secondary-btn" onClick={() => setMode('menu')} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
            ← Back to Menu
          </button>
        </div>

        <div className="checklist-container">
          {subLoading ? (
            <>
              <div className="skeleton-card"><div className="skeleton-line"></div></div>
              <div className="skeleton-card"><div className="skeleton-line short"></div></div>
              <div className="skeleton-card"><div className="skeleton-line medium"></div></div>
            </>
          ) : submissions.length === 0 ? (
            <div className="empty-state glass-panel">
              <div className="empty-state-icon">📭</div>
              <h3>No Submissions Yet</h3>
              <p style={{ color: 'var(--text-secondary)' }}>No one has filled this checklist yet.</p>
            </div>
          ) : (
            submissions.map(sub => {
              const activeToken = pendingTokens.find(t => t.submissionId === sub.id && t.status === 'pending' && new Date(t.expiresAt?.toDate?.() || t.expiresAt) > new Date());
              return (
                <SubmissionCard 
                  key={sub.id} 
                  sub={sub} 
                  activeToken={activeToken} 
                  onDelete={null} // Disabled for regular users
                  onShareLink={async (sub) => {
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
                      toast.error('Failed to generate link');
                    }
                  }} 
                  onShowLink={(sub, token) => {
                    setShareTokenId(token.id);
                    setShareSub(sub);
                    setShareTokenExpiresAt(new Date(token.expiresAt?.toDate?.() || token.expiresAt).getTime());
                  }}
                  onResubmit={(sub) => {
                    setEditSubmission(sub);
                    setMode('fill');
                  }}
                />
              );
            })
          )}
        </div>

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
      </div>
    );
  }

  // Menu mode
  return (
    <div className="right-pane dashboard-pane animate-fade-in" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem', fontFamily: 'var(--font-display)' }}>{selectedChecklist.title}</h2>
        <p style={{ color: 'var(--text-secondary)' }}>What would you like to do?</p>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', maxWidth: '400px' }}>
        <button 
          onClick={() => setMode('fill')}
          className="primary-btn" 
          style={{ padding: '1.5rem', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', borderRadius: '12px' }}
        >
          <span>✍️</span> Fill Checklist
        </button>
        
        <button 
          onClick={() => setMode('history')}
          className="secondary-btn glass-panel" 
          style={{ padding: '1.5rem', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', borderRadius: '12px', borderColor: 'rgba(139, 92, 246, 0.3)' }}
        >
          <span>📋</span> Show Filled Checklists 
          {subLoading ? (
            <span style={{ fontSize: '0.9rem', color: 'var(--text-tertiary)' }}>(...)</span>
          ) : (
            <span style={{ background: 'rgba(139, 92, 246, 0.2)', padding: '0.2rem 0.8rem', borderRadius: '20px', fontSize: '1rem', color: 'var(--accent)' }}>
              {submissions.length}
            </span>
          )}
        </button>
      </div>
      
      {onBack && (
        <button className="secondary-btn mobile-only" onClick={onBack} style={{ marginTop: '2rem' }}>
          ← Back
        </button>
      )}
    </div>
  );
}
