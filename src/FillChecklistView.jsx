import { useState, useEffect } from 'react';
import { firebaseService } from './services/firebaseService';
import { toast } from 'react-hot-toast';
import ShareLinkModal from './ShareLinkModal';

const compressImage = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 600;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        resolve({ blob: null, previewUrl: dataUrl, dataUrl });
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

const withTimeout = (promise, ms, errorMsg) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(errorMsg)), ms))
  ]);
};

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

export default function FillChecklistView({ selectedChecklist, onBack }) {
  const [fillerName, setFillerName]         = useState('');
  const [notes, setNotes]                   = useState('');
  const [isSubmitting, setIsSubmitting]     = useState(false);
  const [submittedCode, setSubmittedCode]   = useState(null);
  const [reviewTokenId, setReviewTokenId] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [checkpointValues, setCheckpointValues] = useState({});
  const [generalPhoto, setGeneralPhoto] = useState(null);
  const [isCompressingImage, setIsCompressingImage] = useState(false);
  const [cmmData, setCmmData] = useState({ name: '', designation: '', date: new Date().toISOString().split('T')[0] });
  const [currentStep, setCurrentStep]       = useState(0);
  const totalSteps = 3;

  useEffect(() => {
    setSubmittedCode(null);
    setGeneralPhoto(null);
    
    const initialValues = {};
    if (selectedChecklist?.checkpoints) {
      selectedChecklist.checkpoints.forEach(cp => {
        initialValues[cp.id] = '';
      });
    }

    if (selectedChecklist?.id) {
      const draftStr = localStorage.getItem(`draft_${selectedChecklist.id}`);
      if (draftStr) {
        try {
          const draft = JSON.parse(draftStr);
          setFillerName(draft.fillerName || '');
          setNotes(draft.notes || '');
          setCmmData(draft.cmmData || { name: '', designation: '', date: new Date().toISOString().split('T')[0] });
          setCheckpointValues(draft.checkpointValues || initialValues);
          setCurrentStep(draft.currentStep || 0);
          return;
        } catch (err) {
          console.error('Failed to parse draft', err);
        }
      }
    }
    
    setFillerName('');
    setNotes('');
    setCheckpointValues(initialValues);
    setCmmData({ name: '', designation: '', date: new Date().toISOString().split('T')[0] });
    setCurrentStep(0);
  }, [selectedChecklist]);

  // Autosave
  useEffect(() => {
    if (selectedChecklist?.id) {
      const draft = { fillerName, notes, cmmData, checkpointValues, currentStep };
      localStorage.setItem(`draft_${selectedChecklist.id}`, JSON.stringify(draft));
    }
  }, [fillerName, notes, cmmData, checkpointValues, currentStep, selectedChecklist]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (generalPhoto && generalPhoto.previewUrl) {
        URL.revokeObjectURL(generalPhoto.previewUrl);
      }
    };
  }, [generalPhoto]);

  const generateCode = () => {
    try {
      const parts = crypto.randomUUID().split('-');
      return parts[0].toUpperCase() + parts[1].toUpperCase();
    } catch (e) {
      return Math.random().toString(36).substring(2, 10).toUpperCase();
    }
  };

  const handleCheckpointChange = (id, value) =>
    setCheckpointValues(prev => ({ ...prev, [id]: value }));

  const buildPayload = (code, uploadedImageUrls) => {
    const formattedCheckpoints = (selectedChecklist.checkpoints || []).map(cp => {
      let val = checkpointValues[cp.id];
      if (cp.type === 'checkbox') {
        val = (val === 'true') ? 'Yes' : 'No';
      } else {
        val = val || '';
      }
      return {
        label: cp.label,
        value: val
      };
    });

    const cmmSignature = {
      ...cmmData
    };

    return {
      checklistId:         selectedChecklist.id,
      checklistTitle:      selectedChecklist.title,
      fillerName:          fillerName.trim() || 'Anonymous',
      notes:               notes.trim(),
      uniqueCode:          code,
      checkpointResponses: formattedCheckpoints,
      generalPhotoUrl: uploadedImageUrls.general || null,
      cmmSignature,
    };
  };

  const uploadPhotos = async () => {
    // Instead of relying on Firebase Storage which is hanging, we will just 
    // save the compressed Base64 string directly into Firestore.
    // It's small enough (~50KB) to easily fit inside the 1MB Firestore document limit.
    const uploadedImageUrls = {};
    if (generalPhoto && generalPhoto.dataUrl) {
      uploadedImageUrls.general = generalPhoto.dataUrl;
    }
    return uploadedImageUrls;
  };

  /* ── Submit Form ── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedChecklist) return;
    
    // Validate required fields
    if (!fillerName.trim()) {
      toast.error("Please enter your name (Filled By).");
      return;
    }
    if (!cmmData.name.trim() || !cmmData.designation.trim() || !cmmData.date) {
      toast.error("Please fill in all CMM details.");
      return;
    }
    const firstUnansweredRequired = selectedChecklist.checkpoints?.find(cp => cp.required && !checkpointValues[cp.id]);
    if (firstUnansweredRequired) {
      toast.error('Please fill out all required checkpoints.');
      const el = document.getElementById(`cp-${firstUnansweredRequired.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('error-pulse');
        setTimeout(() => el.classList.remove('error-pulse'), 4500);
      }
      return;
    }

    setIsSubmitting(true);

    try {
      const code = generateCode();
      const uploadedImageUrls = await withTimeout(
        uploadPhotos(),
        15000,
        "Image upload took too long. Please try again."
      );
      const payloadBase = buildPayload(code, uploadedImageUrls);
      
      const submitPromise = await firebaseService.submitChecklist({
        ...payloadBase,
        submittedAt: firebaseService.getServerTimestamp(),
        signatures: {
          cmm: payloadBase.cmmSignature,
          amm: null
        },
        reviewMode: 'direct'
      });

      // Generate Review Token for AMM
      const tokenData = {
        submissionId: submitPromise.id,
        checklistId: selectedChecklist.id,
        checklistTitle: selectedChecklist.title,
        fillerName: fillerName.trim() || 'Anonymous',
        notes: notes.trim(),
        uniqueCode: code,
        checkpointResponses: payloadBase.checkpointResponses,
        generalPhotoUrl: uploadedImageUrls.general || null,
        cmmSignature: payloadBase.cmmSignature,
        status: 'pending',
        expiresAt: new Date(Date.now() + 3600000), // 1 hour
        createdAt: firebaseService.getServerTimestamp()
      };
      
      const tokenDoc = await firebaseService.createReviewToken(tokenData);
      setReviewTokenId(tokenDoc.id);

      await firebaseService.logEvent('Checklist Submitted', `Submitted checklist: "${selectedChecklist.title}"`, fillerName.trim() || 'Anonymous');
      toast.success("Checklist Submitted!");
      setSubmittedCode(code);
      localStorage.removeItem(`draft_${selectedChecklist.id}`); // clear draft on success
    } catch (err) {
      console.error("Submit Error:", err);
      toast.error(err.message || "Failed to submit. Make sure Firestore rules allow writes.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFillerName('');
    setNotes('');
    setSubmittedCode(null);
    setReviewTokenId(null);
    setShowShareModal(false);
    setCheckpointValues({});
    setGeneralPhoto(null);
    setCmmData({ name: '', designation: '', date: new Date().toISOString().split('T')[0] });
    setCurrentStep(0);
  };

  /* ── Empty state ── */
  if (!selectedChecklist) {
    return (
      <div className="right-pane dashboard-pane">
        <div className="empty-state glass-panel animate-fade-in">
          <div className="empty-state-icon">📋</div>
          <h3>No Checklist Selected</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
            Pick a checklist from the left panel to start filling it out.
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

          <div className="tracking-code" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <span>{submittedCode}</span>
            <button
              className="copy-btn"
              onClick={() => {
                navigator.clipboard.writeText(submittedCode);
                toast.success("Copied to clipboard!");
              }}
              style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', marginLeft: '0.5rem' }}
              title="Copy Tracking Code"
            >
              📋 Copy
            </button>
          </div>

          <p style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
            Present this code to your supervisor for verification.
          </p>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            {reviewTokenId && (
              <button
                onClick={() => setShowShareModal(true)}
                className="primary-btn"
                style={{ minWidth: '200px', backgroundColor: '#25D366', borderColor: '#25D366' }}
              >
                💬 Share with AMM
              </button>
            )}
            <button
              onClick={handleReset}
              className="secondary-btn"
              style={{ minWidth: '200px' }}
            >
              ✍️ Fill Another Checklist
            </button>
          </div>
          
          {showShareModal && reviewTokenId && (
            <ShareLinkModal 
              tokenId={reviewTokenId}
              expiresAtMs={Date.now() + 3600000}
              checklistTitle={selectedChecklist.title}
              fillerName={fillerName}
              onClose={() => setShowShareModal(false)}
            />
          )}
        </div>
      </div>
    );
  }

  /* ── Main form ── */
  return (
    <div className="right-pane dashboard-pane animate-slide-in">
      <div className="dashboard-header" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>Fill Checklist</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem', fontFamily: 'var(--font-display)' }}>
            Complete all sections and sign to submit.
          </p>
        </div>
        {onBack && (
          <button className="secondary-btn mobile-only" onClick={onBack} style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}>
            ← Back
          </button>
        )}
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
                      id={`cp-${cp.id}`}
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
                          {(cp.options || '').split(',').map((opt, i) => (
                            <option key={i} value={opt.trim()}>{opt.trim()}</option>
                          ))}
                        </select>
                      )}
                      {cp.type === 'checkbox' && (
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={val === 'true'}
                            onChange={e => handleCheckpointChange(cp.id, e.target.checked ? 'true' : 'false')}
                            style={{ width: '1.25rem', height: '1.25rem', cursor: 'pointer' }}
                          />
                          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                            {val === 'true' ? 'Yes / True' : 'No / False'}
                          </span>
                        </label>
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
            <div className="input-group" style={{ marginTop: '1rem' }}>
              <label>Attach Photo (Optional)</label>
              {generalPhoto ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
                  <img src={generalPhoto.previewUrl} alt="Attached" style={{ height: '80px', borderRadius: '4px', objectFit: 'cover', border: '1px solid var(--border-color)' }} />
                  <button 
                    type="button" 
                    className="secondary-btn" 
                    style={{ padding: '0.35rem 0.7rem', fontSize: '0.85rem' }}
                    onClick={() => {
                      if (generalPhoto && generalPhoto.previewUrl) {
                        URL.revokeObjectURL(generalPhoto.previewUrl);
                      }
                      setGeneralPhoto(null);
                    }}
                  >
                    Remove Photo
                  </button>
                </div>
              ) : (
                <div style={{ marginTop: '0.5rem' }}>
                  <label className="secondary-btn" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    {isCompressingImage ? (
                      <span><span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px', display: 'inline-block', marginRight: '6px' }}></span> Compressing…</span>
                    ) : (
                      <span>📷 Attach Photo</span>
                    )}
                    <input 
                      type="file" 
                      accept="image/*" 
                      style={{ display: 'none' }}
                      onChange={async (e) => {
                        const file = e.target.files[0];
                        if (!file) return;
                        try {
                          setIsCompressingImage(true);
                          const compressed = await compressImage(file);
                          if (generalPhoto && generalPhoto.previewUrl) {
                            URL.revokeObjectURL(generalPhoto.previewUrl);
                          }
                          setGeneralPhoto(compressed);
                        } catch (err) {
                          console.error('Error compressing image:', err);
                          toast.error('Failed to process image.');
                        } finally {
                          setIsCompressingImage(false);
                        }
                      }}
                    />
                  </label>
                </div>
              )}
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
                <label>Date (Auto-captured)</label>
                <input type="text" value={cmmData.date} readOnly className="styled-input" style={{ cursor: 'not-allowed', color: 'var(--text-secondary)' }} />
              </div>
            </div>
          </div>

          {/* ── Action Buttons ── */}
          <div className="section-divider" style={{ margin: '1.5rem 0' }}></div>

          <button
            type="submit"
            className="primary-btn submit-btn"
            disabled={isSubmitting}
            style={{ marginBottom: '0.75rem' }}
          >
            {isSubmitting ? (
              <><span className="spinner"></span> Submitting…</>
            ) : (
              <>✍️ Submit Checklist</>
            )}
          </button>

        </form>
      </div>
    </div>
  );
}
