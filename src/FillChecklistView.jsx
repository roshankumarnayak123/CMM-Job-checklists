import { useState, useRef, useEffect } from 'react';
import { db } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import SignatureCanvas from 'react-signature-canvas';

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
  const [ammData, setAmmData] = useState({ name: '', designation: '', date: '' });
  const cmmSigRef = useRef();
  const ammSigRef = useRef();
  const [currentStep, setCurrentStep]       = useState(0);
  const totalSteps = 3;

  useEffect(() => {
    setFillerName('');
    setNotes('');
    setSubmittedCode(null);
    setCheckpointValues({});
    setCmmData({ name: '', designation: '', date: '' });
    setAmmData({ name: '', designation: '', date: '' });
    setCurrentStep(0);

    let timer;
    timer = setTimeout(() => {
      if (cmmSigRef.current) cmmSigRef.current.clear();
      if (ammSigRef.current) ammSigRef.current.clear();
    }, 100);
    return () => clearTimeout(timer);
  }, [selectedChecklist]);

  const generateCode = () => Math.floor(1000000000 + Math.random() * 9000000000).toString();

  const handleCheckpointChange = (id, value) =>
    setCheckpointValues(prev => ({ ...prev, [id]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedChecklist) return;
    setIsSubmitting(true);
    const code = generateCode();

    const formattedCheckpoints = (selectedChecklist.checkpoints || []).map(cp => ({
      label: cp.label,
      value: checkpointValues[cp.id] || ''
    }));

    const signatures = {
      cmm: {
        ...cmmData,
        signatureDataUrl: cmmSigRef.current?.isEmpty() ? null : cmmSigRef.current?.getTrimmedCanvas().toDataURL('image/png')
      },
      amm: {
        ...ammData,
        signatureDataUrl: ammSigRef.current?.isEmpty() ? null : ammSigRef.current?.getTrimmedCanvas().toDataURL('image/png')
      }
    };

    try {
      await addDoc(collection(db, 'filled_checklists'), {
        checklistId:         selectedChecklist.id,
        checklistTitle:      selectedChecklist.title,
        fillerName:          fillerName.trim() || 'Anonymous',
        notes:               notes.trim(),
        uniqueCode:          code,
        submittedAt:         serverTimestamp(),
        checkpointResponses: formattedCheckpoints,
        signatures
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
    setAmmData({ name: '', designation: '', date: '' });
    setCurrentStep(0);
    if (cmmSigRef.current) cmmSigRef.current.clear();
    if (ammSigRef.current) ammSigRef.current.clear();
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

        <form onSubmit={handleSubmit} className="checklist-form">

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

          {/* ── Section 3: Signatures ── */}
          <div className="form-section" onClick={() => setCurrentStep(s => Math.max(s, 2))}>
            <div className="section-divider"></div>
            <div className="section-label">
              <span className="section-number">3</span>
              <span>Digital Signatures</span>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', fontFamily: 'var(--font-display)' }}>
              Both parties must sign below. Fill all fields and draw your signature.
            </p>

            <div className="signatures-grid">
              {/* CMM Signature */}
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

              {/* AMM Signature */}
              <div className="signature-block">
                <div className="signature-block-header">
                  <span className="sig-icon">🔧</span>
                  <h4>Area Mechanical Maintenance</h4>
                </div>
                <div className="input-group">
                  <label>Name <span style={{ color: 'var(--neon-red)' }}>*</span></label>
                  <input type="text" placeholder="Full name" value={ammData.name} onChange={e => setAmmData({ ...ammData, name: e.target.value })} required className="styled-input" />
                </div>
                <div className="input-group">
                  <label>Designation <span style={{ color: 'var(--neon-red)' }}>*</span></label>
                  <input type="text" placeholder="e.g., Area Engineer" value={ammData.designation} onChange={e => setAmmData({ ...ammData, designation: e.target.value })} required className="styled-input" />
                </div>
                <div className="input-group">
                  <label>Date <span style={{ color: 'var(--neon-red)' }}>*</span></label>
                  <input type="date" value={ammData.date} onChange={e => setAmmData({ ...ammData, date: e.target.value })} required className="styled-input" />
                </div>
                <div className="signature-pad-container">
                  <label>Draw Signature <span style={{ color: 'var(--neon-red)' }}>*</span></label>
                  <div className="sig-pad-wrapper">
                    <SignatureCanvas
                      ref={ammSigRef}
                      penColor="#1e40af"
                      canvasProps={{ width: 500, height: 140, className: 'sigCanvas', style: { width: '100%', height: '140px' } }}
                    />
                    <button type="button" onClick={() => ammSigRef.current?.clear()} className="sig-clear-btn">Clear</button>
                    <div className="sig-placeholder-line"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Submit ── */}
          <div className="section-divider" style={{ margin: '1.5rem 0' }}></div>
          <button
            type="submit"
            className="primary-btn submit-btn"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <><span className="spinner"></span> Submitting…</>
            ) : (
              <><span>✍️</span> Submit Signed Checklist</>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
