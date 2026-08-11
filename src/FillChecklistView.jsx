import { useState, useRef, useEffect } from 'react';
import { db } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import SignatureCanvas from 'react-signature-canvas';
import ShareLinkModal from './ShareLinkModal';

// Hex-style step indicator
function StepIndicator({ currentStep, totalSteps }) {
  const pct = totalSteps > 1 ? (currentStep / (totalSteps - 1)) * 100 : 0;
  return (
    <div className="step-indicator">
      {Array.from({ length: totalSteps }, (_, i) => (
        <div
          key={i}
          className={`step-dot ${i < currentStep ? 'done' : i === currentStep ? 'active' : ''}`}
        >
          {i < currentStep ? '✓' : i + 1}
        </div>
      ))}
      <div className="step-track">
        <div className="step-fill" style={{ width: `${pct}%` }}></div>
      </div>
    </div>
  );
}

export default function FillChecklistView({ selectedChecklist }) {
  const [fillerName, setFillerName]         = useState('');
  const [notes, setNotes]                   = useState('');
  const [isSubmitting, setIsSubmitting]     = useState(false);
  const [submittedCode, setSubmittedCode]   = useState(null);
  const [checkpointValues, setCheckpointValues] = useState({});
  const [cmmData, setCmmData] = useState({ name: '', designation: '', date: '' });
  const cmmSigRef = useRef();
  const [currentStep, setCurrentStep]       = useState(0);
  const totalSteps = 3;

  // Share link modal state
  const [shareTokenId, setShareTokenId]     = useState(null);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);

  useEffect(() => {
    setFillerName('');
    setNotes('');
    setSubmittedCode(null);
    setCheckpointValues({});
    setCmmData({ name: '', designation: '', date: '' });
    setCurrentStep(0);
    setShareTokenId(null);

    let timer;
    timer = setTimeout(() => {
      if (cmmSigRef.current) cmmSigRef.current.clear();
    }, 100);
    return () => clearTimeout(timer);
  }, [selectedChecklist]);

  const generateCode = () => Math.floor(1000000000 + Math.random() * 9000000000).toString();

  const handleCheckpointChange = (id, value) =>
    setCheckpointValues(prev => ({ ...prev, [id]: value }));

  const buildPayload = (code) => {
    const formattedCheckpoints = (selectedChecklist.checkpoints || []).map(cp => ({
      label: cp.label,
      value: checkpointValues[cp.id] || ''
    }));

    const cmmSignature = {
      ...cmmData,
      signatureDataUrl: (cmmSigRef.current && !cmmSigRef.current.isEmpty()) 
        ? cmmSigRef.current.getTrimmedCanvas().toDataURL('image/png') 
        : null
    };

    return {
      checklistId:         selectedChecklist.id,
      checklistTitle:      selectedChecklist.title,
      fillerName:          fillerName.trim() || 'Anonymous',
      notes:               notes.trim(),
      uniqueCode:          code,
      checkpointResponses: formattedCheckpoints,
      cmmSignature,
    };
  };

  /* ── Generate Review Link (saves draft, opens share modal) ── */
  const handleGenerateLink = async (e) => {
    e.preventDefault();
    if (!selectedChecklist) return;
    setIsGeneratingLink(true);

    const code = generateCode();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    const payload = {
      ...buildPayload(code),
      status: 'pending_review',
      createdAt: serverTimestamp(),
      expiresAt,
      ammSignature: null,
    };

    try {
      const docRef = await addDoc(collection(db, 'review_tokens'), payload);
      setShareTokenId(docRef.id);
    } catch (err) {
      console.error('Error generating review link:', err);
      alert("Failed to generate link. Check Firestore rules allow writes to 'review_tokens'.");
    } finally {
      setIsGeneratingLink(false);
    }
  };

  /* ── Direct Submit (no review link, both signatures in-person) ── */
  const handleDirectSubmit = async (e) => {
    e.preventDefault();
    if (!selectedChecklist) return;
    setIsSubmitting(true);
    const code = generateCode();

    try {
      await addDoc(collection(db, 'filled_checklists'), {
        ...buildPayload(code),
        submittedAt: serverTimestamp(),
        signatures: {
          cmm: {
            ...cmmData,
            signatureDataUrl: cmmSigRef.current?.isEmpty() ? null : cmmSigRef.current?.getTrimmedCanvas().toDataURL('image/png')
          },
          amm: null
        }
      });
      setSubmittedCode(code);
    } catch (err) {
      console.error('Error submitting checklist:', err);
      alert("Failed to submit. Make sure Firestore rules allow writes to 'filled_checklists'.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFillerName('');
    setNotes('');
    setSubmittedCode(null);
    setCheckpointValues({});
    setCmmData({ name: '', designation: '', date: '' });
    setCurrentStep(0);
    setShareTokenId(null);
    if (cmmSigRef.current) cmmSigRef.current.clear();
  };

  /* ── Empty state ── */
  if (!selectedChecklist) {
    return (
      <div className="right-pane dashboard-pane">
        <div className="empty-state glass-panel animate-fade-in">
          <div className="empty-state-icon">📋</div>
          <h3>No Checklist Selected</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
            Pick a checklist template from the left panel to start filling it out.
          </p>
        </div>
      </div>
    );
  }

  /* ── Success screen ── */
  if (submittedCode) {
    return (
      <div className="right-pane dashboard-pane">
        <div className="success-screen glass-panel animate-scale-in">
          {/* 16-particle burst */}
          <div className="success-confetti">
            {[...Array(16)].map((_, i) => (
              <div key={i} className="confetti-dot"></div>
            ))}
          </div>

          <span className="success-icon">🎉</span>
          <h2 style={{ color: 'var(--neon-green)', marginBottom: '0.4rem', fontFamily: 'var(--font-display)' }}>
            Submitted Successfully!
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.9rem' }}>
            Your signed checklist has been recorded. Save your tracking code:
          </p>

          <div className="tracking-code">{submittedCode}</div>

          <p style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
            Present this code to your supervisor for verification.
          </p>

          <button
            onClick={handleReset}
            className="primary-btn"
            style={{ marginTop: '2rem', minWidth: '200px' }}
          >
            ✍️ Fill Another Checklist
          </button>
        </div>
      </div>
    );
  }

  /* ── Main form ── */
  return (
    <div className="right-pane dashboard-pane animate-slide-in">
      <div className="dashboard-header">
        <div>
          <h2>Fill Checklist</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem', fontFamily: 'var(--font-display)' }}>
            Complete all sections and sign to submit.
          </p>
        </div>
      </div>

      <StepIndicator currentStep={currentStep} totalSteps={totalSteps} />

      <div className="checklist-details glass-panel" style={{ marginTop: '1rem' }}>
        {/* Header */}
        <div className="details-header">
          <div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>{selectedChecklist.title}</h3>
            {selectedChecklist.description && (
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {selectedChecklist.description}
              </p>
            )}
          </div>
          <span className="badge">ID: {selectedChecklist.id.slice(0, 8)}…</span>
        </div>

        <div className="section-divider"></div>

        <form onSubmit={handleGenerateLink} className="checklist-form">

          {/* ── Section 1: Basic Info ── */}
          <div className="form-section" id="section-info">
            <div className="section-label">
              <span className="section-number">1</span>
              <span>Basic Information</span>
            </div>
            <div className="input-group">
              <label>Filled By (Your Name) <span style={{ color: 'var(--neon-red)' }}>*</span></label>
              <input
                type="text"
                value={fillerName}
                onChange={e => { setFillerName(e.target.value); setCurrentStep(s => Math.max(s, 0)); }}
                placeholder="Enter your full name"
                required
                className="styled-input"
              />
            </div>
          </div>

          {/* ── Section 2: Checkpoints ── */}
          {selectedChecklist.checkpoints?.length > 0 && (
            <div className="form-section">
              <div className="section-divider"></div>
              <div className="section-label">
                <span className="section-number">2</span>
                <span>Checkpoints ({selectedChecklist.checkpoints.length})</span>
              </div>
              <div className="checkpoints-list">
                {selectedChecklist.checkpoints.map((cp, idx) => {
                  const val = checkpointValues[cp.id] || '';
                  return (
                    <div
                      key={cp.id}
                      className="checkpoint-item animate-slide-up glass-panel"
                      style={{ '--delay': `${idx * 0.05}s` }}
                      onClick={() => setCurrentStep(s => Math.max(s, 1))}
                    >
                      <div className="checkpoint-header">
                        <span className="checkpoint-number">{idx + 1}</span>
                        <label>{cp.label}</label>
                        <span className={`checkpoint-type-badge type-${cp.type}`}>{cp.type}</span>
                      </div>

                      {cp.type === 'text' && (
                        <input
                          type="text"
                          value={val}
                          onChange={e => handleCheckpointChange(cp.id, e.target.value)}
                          placeholder="Enter response…"
                          className="styled-input"
                        />
                      )}
                      {cp.type === 'number' && (
                        <input
                          type="number"
                          value={val}
                          onChange={e => handleCheckpointChange(cp.id, e.target.value)}
                          placeholder="0"
                          className="styled-input"
                          style={{ maxWidth: '200px' }}
                        />
                      )}
                      {cp.type === 'dropdown' && (
                        <select
                          value={val}
                          onChange={e => handleCheckpointChange(cp.id, e.target.value)}
                          className="styled-select"
                        >
                          <option value="" disabled>Select an option…</option>
                          {cp.options.split(',').map((opt, i) => (
                            <option key={i} value={opt.trim()}>{opt.trim()}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Additional Notes ── */}
          <div className="form-section">
            <div className="section-divider"></div>
            <div className="input-group">
              <label>Additional Notes / Report</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Enter extra details, issues found, or status reports here…"
                rows={4}
                className="styled-textarea"
              />
            </div>
          </div>

          {/* ── Section 3: CMM Signature ── */}
          <div className="form-section" onClick={() => setCurrentStep(s => Math.max(s, 2))}>
            <div className="section-divider"></div>
            <div className="section-label">
              <span className="section-number">3</span>
              <span>Your Signature (CMM)</span>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', fontFamily: 'var(--font-display)' }}>
              Sign below. Area Maintenance will sign after reviewing via the shared link.
            </p>

            <div className="signature-block">
              <div className="signature-block-header">
                <span className="sig-icon">🏭</span>
                <h4>Central Mechanical Maintenance</h4>
              </div>
              <div className="input-group">
                <label>Name <span style={{ color: 'var(--neon-red)' }}>*</span></label>
                <input type="text" placeholder="Full name" value={cmmData.name} onChange={e => setCmmData({ ...cmmData, name: e.target.value })} required className="styled-input" />
              </div>
              <div className="input-group">
                <label>Designation <span style={{ color: 'var(--neon-red)' }}>*</span></label>
                <input type="text" placeholder="e.g., Senior Engineer" value={cmmData.designation} onChange={e => setCmmData({ ...cmmData, designation: e.target.value })} required className="styled-input" />
              </div>
              <div className="input-group">
                <label>Date <span style={{ color: 'var(--neon-red)' }}>*</span></label>
                <input type="date" value={cmmData.date} onChange={e => setCmmData({ ...cmmData, date: e.target.value })} required className="styled-input" />
              </div>
              <div className="signature-pad-container">
                <label>Draw Signature <span style={{ color: 'var(--neon-red)' }}>*</span></label>
                <div className="sig-pad-wrapper">
                  <SignatureCanvas
                    ref={cmmSigRef}
                    penColor="#1e40af"
                    canvasProps={{ width: 500, height: 140, className: 'sigCanvas', style: { width: '100%', height: '140px' } }}
                  />
                  <button type="button" onClick={() => cmmSigRef.current?.clear()} className="sig-clear-btn">Clear</button>
                  <div className="sig-placeholder-line"></div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Action Buttons ── */}
          <div className="section-divider" style={{ margin: '1.5rem 0' }}></div>

          {/* Primary: Generate Review Link */}
          <button
            type="submit"
            className="primary-btn submit-btn"
            disabled={isGeneratingLink || isSubmitting}
            style={{ marginBottom: '0.75rem' }}
          >
            {isGeneratingLink ? (
              <><span className="spinner"></span> Generating Link…</>
            ) : (
              <>🔗 Generate Review Link &amp; Share</>
            )}
          </button>

          {/* Secondary: Direct Submit (no remote review) */}
          <button
            type="button"
            className="secondary-btn submit-btn"
            onClick={handleDirectSubmit}
            disabled={isSubmitting || isGeneratingLink}
            title="Use this if both parties are physically present"
          >
            {isSubmitting ? (
              <><span className="spinner"></span> Submitting…</>
            ) : (
              <>✍️ Submit Directly (No Review Link)</>
            )}
          </button>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.5rem', textAlign: 'center' }}>
            Use "Submit Directly" only when Area Maintenance is physically present to sign in person.
          </p>

        </form>
      </div>

      {/* Share Link Modal */}
      {shareTokenId && (
        <ShareLinkModal
          tokenId={shareTokenId}
          checklistTitle={selectedChecklist.title}
          fillerName={fillerName.trim() || 'Anonymous'}
          onClose={() => { setShareTokenId(null); handleReset(); }}
        />
      )}
    </div>
  );
}
