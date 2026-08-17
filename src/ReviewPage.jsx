import { useState, useEffect } from 'react';
import { firebaseService } from './services/firebaseService';

export default function ReviewPage({ tokenId }) {
  const [status, setStatus] = useState('loading'); // loading | expired | already_signed | ready | submitting | success | error
  const [tokenData, setTokenData] = useState(null);
  const [ammData, setAmmData] = useState({ name: '', designation: '', date: new Date().toISOString().split('T')[0] });
  const [submitError, setSubmitError] = useState('');
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    if (!tokenData || !tokenData.expiresAt || status !== 'ready') return;

    const expiresAt = new Date(tokenData.expiresAt?.toDate?.() || tokenData.expiresAt).getTime();
    
    const updateTimer = () => {
      const now = Date.now();
      const diff = expiresAt - now;
      if (diff <= 0) {
        setTimeLeft('Expired');
        setStatus('expired');
        return;
      }
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [tokenData, status]);

  useEffect(() => {
    async function fetchToken() {
      try {
        const snap = await firebaseService.getReviewToken(tokenId);
        if (!snap.exists()) {
          setStatus('error');
          return;
        }
        const data = snap.data();
        const now = new Date();
        const expiresAt = data.expiresAt?.toDate?.() || new Date(0);

        if (data.status === 'completed') {
          setTokenData(data);
          setStatus('already_signed');
          return;
        }
        if (now > expiresAt) {
          setStatus('expired');
          return;
        }
        setTokenData(data);
        setStatus('ready');
      } catch (err) {
        console.error('Error fetching review token:', err);
        setStatus('error');
      }
    }
    fetchToken();
  }, [tokenId]);

  const [ammRemarks, setAmmRemarks] = useState('');

  const submitAction = async (e, actionType) => {
    e.preventDefault();
    if (!ammData.name.trim()) {
      setSubmitError('Please enter your full name.');
      return;
    }
    if (!ammData.designation.trim()) {
      setSubmitError('Please enter your designation.');
      return;
    }
    if (actionType === 'reject' && !ammRemarks.trim()) {
      setSubmitError('Please provide remarks for why you are rejecting this checklist.');
      return;
    }
    
    setSubmitError('');
    setStatus('submitting');
    try {
      const finalStatus = actionType === 'approve' ? 'completed' : 'rejected';
      await firebaseService.updateReviewToken(tokenId, {
        status: finalStatus,
        ammSignature: ammData,
        completedAt: firebaseService.getServerTimestamp(),
        ammRemarks: ammRemarks.trim()
      });
      
      if (tokenData.submissionId) {
        await firebaseService.updateSubmission(tokenData.submissionId, {
          'signatures.amm': ammData,
          ammSignedAt: new Date().toISOString(),
          status: finalStatus,
          ammRemarks: ammRemarks.trim()
        });
      }
      
      setStatus(actionType === 'approve' ? 'success' : 'rejected_success');
    } catch (err) {
      console.error('Error submitting review:', err);
      setSubmitError('Failed to submit. Please try again.');
      setStatus('ready');
    }
  };

  // ── Loading ──
  if (status === 'loading') {
    return (
      <div className="review-page-shell">
        <div className="review-center-card glass-panel">
          <div className="review-spinner-big">⚙️</div>
          <h3>Loading Review…</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Fetching checklist data…</p>
        </div>
      </div>
    );
  }

  // ── Expired ──
  if (status === 'expired') {
    return (
      <div className="review-page-shell">
        <div className="review-center-card glass-panel">
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏰</div>
          <h3 style={{ color: 'var(--neon-amber)' }}>Link Expired</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '0.5rem', maxWidth: '320px', textAlign: 'center' }}>
            This review link has expired (valid for 1 hour only). Please ask the CMM technician to generate a new link.
          </p>
          <button className="primary-btn" style={{ marginTop: '2rem' }} onClick={() => {
            window.close();
            alert("You can safely close this tab now.");
          }}>
            Close Tab
          </button>
        </div>
      </div>
    );
  }

  // ── Error / not found ──
  if (status === 'error') {
    return (
      <div className="review-page-shell">
        <div className="review-center-card glass-panel">
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>❌</div>
          <h3 style={{ color: 'var(--neon-red)' }}>Link Not Found</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '0.5rem', maxWidth: '320px', textAlign: 'center' }}>
            This review link is invalid or has been removed. Please verify the URL and try again.
          </p>
          <button className="primary-btn" style={{ marginTop: '2rem' }} onClick={() => {
            window.close();
            alert("You can safely close this tab now.");
          }}>
            Close Tab
          </button>
        </div>
      </div>
    );
  }

  // ── Already signed ──
  if (status === 'already_signed') {
    return (
      <div className="review-page-shell">
        <div className="review-center-card glass-panel">
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
          <h3 style={{ color: 'var(--neon-green)' }}>Already Signed</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '0.5rem', maxWidth: '340px', textAlign: 'center' }}>
            This checklist has already been reviewed and signed by Area Maintenance. No further action is needed.
          </p>
          {tokenData && (
            <div style={{ marginTop: '1.5rem', padding: '1rem 1.5rem', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '12px', textAlign: 'left', width: '100%' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Checklist</div>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{tokenData.checklistTitle}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Signed by</div>
              <div style={{ fontWeight: 600 }}>{tokenData.ammSignature?.name || '—'}</div>
            </div>
          )}
          <button className="primary-btn" style={{ marginTop: '2rem' }} onClick={() => {
            window.close();
            alert("You can safely close this tab now.");
          }}>
            Close Tab
          </button>
        </div>
      </div>
    );
  }

  // ── Success ──
  if (status === 'success') {
    return (
      <div className="review-page-shell">
        <div className="review-center-card glass-panel animate-scale-in">
          <div className="success-confetti">
            {[...Array(16)].map((_, i) => <div key={i} className="confetti-dot" />)}
          </div>
          <span className="success-icon">🎉</span>
          <h2 style={{ color: 'var(--neon-green)', marginBottom: '0.4rem', fontFamily: 'var(--font-display)' }}>
            Signed Successfully!
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', maxWidth: '320px', textAlign: 'center' }}>
            Your signature has been recorded. The checklist is now fully completed and filed.
          </p>
          <div style={{ marginTop: '1.5rem', padding: '0.75rem 1.5rem', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '12px', fontSize: '0.85rem', color: 'var(--neon-green)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
            ✓ {tokenData?.checklistTitle}
          </div>
          <button 
            className="primary-btn" 
            style={{ marginTop: '2rem', width: '100%', maxWidth: '200px' }}
            onClick={() => {
              window.close();
              alert("You can safely close this tab now.");
            }}
          >
            Close Tab
          </button>
        </div>
      </div>
    );
  }

  // ── Rejected Success ──
  if (status === 'rejected_success') {
    return (
      <div className="review-page-shell">
        <div className="review-center-card glass-panel animate-scale-in" style={{ borderColor: 'rgba(255, 60, 60, 0.3)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⛔</div>
          <h2 style={{ color: 'var(--neon-red)', marginBottom: '0.4rem', fontFamily: 'var(--font-display)' }}>
            Checklist Rejected
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', maxWidth: '320px', textAlign: 'center' }}>
            You have rejected this checklist. It will be sent back to CMM for review.
          </p>
          <button 
            className="primary-btn" 
            style={{ marginTop: '2rem', width: '100%', maxWidth: '200px' }}
            onClick={() => {
              window.close();
              alert("You can safely close this tab now.");
            }}
          >
            Close Tab
          </button>
        </div>
      </div>
    );
  }

  // ── Main Review Form (ready | submitting) ──
  const cmmSig = tokenData?.cmmSignature;

  return (
    <div className="review-page-shell">
      {/* Header */}
      <header className="review-header glass-panel">
        <div className="app-logo">
          <div className="app-logo-icon">⚙️</div>
          <span className="app-logo-text">CMM Checklist</span>
        </div>
        <div className="review-header-badge">
          <span className="review-badge-dot" />
          Review &amp; Sign
        </div>
      </header>

      <div className="review-content">

        {/* Meta card */}
        <div className="review-meta-card glass-panel">
          <div className="review-meta-title">{tokenData.checklistTitle}</div>
          <div className="review-meta-row">
            <span className="review-meta-label">Filled by</span>
            <span className="review-meta-value">{tokenData.fillerName}</span>
          </div>
          <div className="review-meta-row">
            <span className="review-meta-label">Status</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
              <span className="badge badge-pending">⏳ Pending Your Signature</span>
              {timeLeft && timeLeft !== 'Expired' && (
                <span style={{ fontSize: '0.8rem', color: 'var(--neon-amber)', fontWeight: 600 }}>⏱ Expires in {timeLeft}</span>
              )}
            </div>
          </div>
        </div>

        {/* Checkpoints — read only */}
        {tokenData.checkpointResponses?.length > 0 && (
          <div className="review-section glass-panel">
            <div className="review-section-title">
              <span className="section-number">1</span>
              Checklist Responses
            </div>
            <div className="checkpoints-list review-readonly">
              {tokenData.checkpointResponses.map((cp, idx) => (
                <div key={idx} className="checkpoint-item glass-panel" style={{ cursor: 'default' }}>
                  <div className="checkpoint-header">
                    <span className="checkpoint-number">{idx + 1}</span>
                    <label style={{ flex: 1 }}>{cp.label}</label>
                  </div>
                  <div className="review-cp-value">
                    {cp.value || <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>No response</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {tokenData.notes && (
          <div className="review-section glass-panel">
            <div className="review-section-title">
              <span className="section-number">📝</span>
              Additional Notes
            </div>
            <div className="review-notes-box">{tokenData.notes}</div>
          </div>
        )}

        {/* General Photo */}
        {tokenData.generalPhotoUrl && (
          <div className="review-section glass-panel">
            <div className="review-section-title">
              <span className="section-number">3</span>
              Attached Photo
            </div>
            <div style={{ marginTop: '1rem' }}>
              <img src={tokenData.generalPhotoUrl} alt="Attached to checklist" style={{ maxWidth: '100%', maxHeight: '400px', borderRadius: '8px', objectFit: 'contain', border: '1px solid var(--border-color)' }} />
            </div>
          </div>
        )}

        {/* CMM Signature (read-only display) */}
        <div className="review-section glass-panel">
          <div className="review-section-title">
            <span className="section-number">2</span>
            CMM Signature (Already Signed)
          </div>
          <div className="review-sig-display">
            <div className="review-sig-info">
              <div><span className="review-sig-label">Name:</span> <strong>{cmmSig?.name || '—'}</strong></div>
              <div><span className="review-sig-label">Designation:</span> <strong>{cmmSig?.designation || '—'}</strong></div>
              <div><span className="review-sig-label">Date:</span> <strong>{cmmSig?.date || '—'}</strong></div>
            </div>
          </div>
        </div>

        {/* AMM Signature form */}
        <div className="review-section glass-panel">
          <div className="review-section-title">
            <span className="section-number">3</span>
            Your Signature — Area Mechanical Maintenance
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
            Please fill in your details and draw your signature to approve this checklist.
          </p>

          <form className="checklist-form">
            <div className="input-group">
              <label>Full Name <span style={{ color: 'var(--neon-red)' }}>*</span></label>
              <input
                type="text"
                required
                placeholder="Your full name"
                value={ammData.name}
                onChange={e => setAmmData({ ...ammData, name: e.target.value })}
                className="styled-input"
              />
            </div>
            <div className="input-group">
              <label>Designation <span style={{ color: 'var(--neon-red)' }}>*</span></label>
              <input
                type="text"
                required
                placeholder="e.g., Area Engineer"
                value={ammData.designation}
                onChange={e => setAmmData({ ...ammData, designation: e.target.value })}
                className="styled-input"
              />
            </div>
            <div className="input-group">
              <label>Date <span style={{ color: 'var(--neon-red)' }}>*</span></label>
              <input
                type="date"
                required
                value={ammData.date}
                onChange={e => setAmmData({ ...ammData, date: e.target.value })}
                className="styled-input"
              />
            </div>
            <div className="input-group">
              <label>Remarks / Report <span style={{ color: 'var(--text-tertiary)', fontWeight: 'normal', fontSize: '0.8em' }}>(Required for Rejection, optional for Approval)</span></label>
              <textarea
                placeholder="Any comments, notes, or reasons for rejection..."
                value={ammRemarks}
                onChange={e => setAmmRemarks(e.target.value)}
                className="styled-textarea"
                rows={3}
              />
            </div>

            {submitError && (
              <div className="error-message" style={{ marginTop: '1rem' }}>⚠️ {submitError}</div>
            )}

            <div className="section-divider" style={{ margin: '1.5rem 0' }} />
            
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={(e) => submitAction(e, 'approve')}
                className="primary-btn submit-btn"
                disabled={status === 'submitting'}
                style={{ flex: 1 }}
              >
                {status === 'submitting' ? (
                  <><span className="spinner" /> Submitting…</>
                ) : (
                  <>✅ Approve &amp; Sign</>
                )}
              </button>
              <button
                type="button"
                onClick={(e) => submitAction(e, 'reject')}
                className="secondary-btn"
                disabled={status === 'submitting'}
                style={{ flex: 1, borderColor: 'rgba(255, 60, 60, 0.4)', color: 'var(--neon-red)' }}
              >
                {status === 'submitting' ? (
                  <><span className="spinner" /> Submitting…</>
                ) : (
                  <>⛔ Reject</>
                )}
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}
