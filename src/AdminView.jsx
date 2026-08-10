import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './App.css';
import { auth, db } from './firebase';
import { signOut } from 'firebase/auth';
import { collection, addDoc, doc, updateDoc, onSnapshot, query, orderBy } from 'firebase/firestore';

/* ════════════════════════════════════════════════════
   PDF REPORT GENERATOR
════════════════════════════════════════════════════ */
function generatePDFReport(sub) {
  const formattedDate = sub.submittedAt
    ? new Date(sub.submittedAt.toDate()).toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' })
    : 'N/A';

  const escape = (str = '') => String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const checkpointsHTML = sub.checkpointResponses?.length > 0
    ? sub.checkpointResponses.map((cp, i) => `
        <tr>
          <td class="cp-num">${i + 1}</td>
          <td class="cp-label">${escape(cp.label)}</td>
          <td class="cp-value">${escape(cp.value) || '<span style="color:#94a3b8">—</span>'}</td>
        </tr>`).join('')
    : `<tr><td colspan="3" style="text-align:center;padding:1.5rem;color:#94a3b8;font-style:italic">No checkpoints recorded</td></tr>`;

  const cmmSig = sub.signatures?.cmm;
  const ammSig = sub.signatures?.amm;

  const sigBlock = (sig, title, icon) => `
    <div class="sig-card">
      <div class="sig-card-header">${icon} ${title}</div>
      <div class="sig-card-body">
        ${sig ? `
          <div class="sig-info">
            <div><span class="si-label">Name:</span> <span class="si-val">${escape(sig.name || '—')}</span></div>
            <div><span class="si-label">Designation:</span> <span class="si-val">${escape(sig.designation || '—')}</span></div>
            <div><span class="si-label">Date:</span> <span class="si-val">${escape(sig.date || '—')}</span></div>
          </div>
          ${sig.signatureDataUrl
            ? `<img class="sig-image" src="${sig.signatureDataUrl}" alt="${title} Signature">`
            : '<p class="sig-missing">No signature drawn</p>'
          }
        ` : '<p class="sig-missing">Not signed</p>'}
      </div>
    </div>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>CMM Report — ${sub.uniqueCode}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', Arial, sans-serif; color: #1e293b; background: #fff; }
    .page { padding: 32px 40px; max-width: 860px; margin: 0 auto; }

    /* Header */
    .report-header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 20px; border-bottom: 3px solid #7c3aed; margin-bottom: 28px; }
    .company-logo { font-size: 21px; font-weight: 800; color: #7c3aed; letter-spacing: -0.02em; }
    .company-sub { font-size: 11px; color: #64748b; margin-top: 4px; }
    .code-block { text-align: right; }
    .code-label { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 5px; }
    .code-value { font-family: 'Courier New', monospace; font-size: 14px; font-weight: 700; color: #7c3aed; background: #f3f0ff; border: 1px solid #ddd6fe; padding: 6px 14px; border-radius: 8px; letter-spacing: 0.12em; display: inline-block; }

    /* Meta card */
    .meta-card { background: linear-gradient(135deg, #f8f7ff 0%, #eef2ff 100%); border: 1px solid #ddd6fe; border-radius: 14px; padding: 20px 24px; margin-bottom: 26px; }
    .meta-card h1 { font-size: 19px; font-weight: 800; color: #1e293b; margin-bottom: 14px; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 24px; }
    .meta-item { display: flex; flex-direction: column; gap: 2px; }
    .meta-label { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.07em; }
    .meta-value { font-size: 13px; font-weight: 600; color: #1e293b; }
    .meta-value.mono { font-family: 'Courier New', monospace; font-size: 12px; }

    /* Sections */
    .section { margin-bottom: 24px; }
    .section-title { font-size: 11px; font-weight: 700; color: #7c3aed; text-transform: uppercase; letter-spacing: 0.1em; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0; margin-bottom: 14px; display: flex; align-items: center; gap: 6px; }

    /* Checkpoints table */
    table { width: 100%; border-collapse: collapse; font-size: 12.5px; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
    thead tr { background: #7c3aed; color: white; }
    thead th { padding: 10px 14px; text-align: left; font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.07em; }
    tbody tr:nth-child(even) { background: #f8fafc; }
    tbody td { padding: 9px 14px; border-bottom: 1px solid #f1f5f9; }
    td.cp-num { width: 38px; font-weight: 800; color: #7c3aed; text-align: center; font-size: 12px; }
    td.cp-label { color: #475569; }
    td.cp-value { font-weight: 600; color: #1e293b; }

    /* Notes */
    .notes-box { background: #f8fafc; border: 1px solid #e2e8f0; border-left: 3px solid #7c3aed; border-radius: 10px; padding: 14px 16px; font-size: 13px; line-height: 1.7; color: #475569; white-space: pre-wrap; min-height: 56px; }

    /* Signatures */
    .signatures-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
    .sig-card { border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
    .sig-card-header { background: #7c3aed; color: white; padding: 9px 16px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; }
    .sig-card-body { padding: 14px 16px; }
    .sig-info { font-size: 12px; line-height: 2; color: #475569; margin-bottom: 10px; }
    .si-label { color: #64748b; font-weight: 500; }
    .si-val { color: #1e293b; font-weight: 600; margin-left: 4px; }
    .sig-image { width: 100%; max-height: 90px; object-fit: contain; background: white; border: 1px solid #e2e8f0; border-radius: 8px; }
    .sig-missing { color: #94a3b8; font-style: italic; font-size: 12px; text-align: center; padding: 18px; }

    /* Footer */
    .report-footer { margin-top: 28px; padding-top: 14px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #94a3b8; }
    .footer-brand { font-weight: 700; color: #7c3aed; }

    @media print {
      @page { margin: 15mm 18mm; }
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .page { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="page">
    <!-- Top print button (hidden on print) -->
    <div class="no-print" style="text-align:right;margin-bottom:16px">
      <button onclick="window.print()" style="background:#7c3aed;color:white;border:none;padding:9px 20px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">
        🖨️ Print / Save PDF
      </button>
    </div>

    <!-- Header -->
    <div class="report-header">
      <div>
        <div class="company-logo">⚙️ CMM Checklist</div>
        <div class="company-sub">Central Mechanical Maintenance System</div>
      </div>
      <div class="code-block">
        <div class="code-label">Tracking Code</div>
        <div class="code-value">${escape(sub.uniqueCode)}</div>
      </div>
    </div>

    <!-- Meta -->
    <div class="meta-card">
      <h1>${escape(sub.checklistTitle || 'Checklist Report')}</h1>
      <div class="meta-grid">
        <div class="meta-item">
          <span class="meta-label">Filled By</span>
          <span class="meta-value">${escape(sub.fillerName || 'Anonymous')}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Submitted At</span>
          <span class="meta-value">${formattedDate}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Template ID</span>
          <span class="meta-value mono">${escape(sub.checklistId || 'N/A')}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Document ID</span>
          <span class="meta-value mono">${escape((sub.id || '').slice(0, 14))}…</span>
        </div>
      </div>
    </div>

    ${sub.checkpointResponses?.length > 0 ? `
    <div class="section">
      <div class="section-title">📋 Checkpoint Responses</div>
      <table>
        <thead><tr><th>#</th><th>Checkpoint</th><th>Response</th></tr></thead>
        <tbody>${checkpointsHTML}</tbody>
      </table>
    </div>` : ''}

    ${sub.notes ? `
    <div class="section">
      <div class="section-title">📝 Notes &amp; Report</div>
      <div class="notes-box">${escape(sub.notes)}</div>
    </div>` : ''}

    <div class="section">
      <div class="section-title">✍️ Digital Signatures</div>
      <div class="signatures-grid">
        ${sigBlock(cmmSig, 'Central Mechanical Maintenance', '🏭')}
        ${sigBlock(ammSig, 'Area Mechanical Maintenance', '🔧')}
      </div>
    </div>

    <div class="report-footer">
      <span><span class="footer-brand">CMM Checklist System</span> — Confidential</span>
      <span>Generated: ${new Date().toLocaleString('en-IN')}</span>
    </div>
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 120000);
}

/* ════════════════════════════════════════════════════
   SETTINGS MODAL — tabbed, rendered via createPortal
════════════════════════════════════════════════════ */
const SETTINGS_TABS = [
  { id: 'cloud', icon: '📊', label: 'Cloud Usage' },
];

function SettingsModal({ showSettings, setShowSettings, rawCloudData }) {
  const [activeTab, setActiveTab] = useState('cloud');

  if (!showSettings) return null;

  const stringifiedData = JSON.stringify(rawCloudData || []);
  const estimatedBytes  = stringifiedData.length * 2;
  const quotaBytes      = 1_073_741_824;

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const usagePct = Math.min((estimatedBytes / quotaBytes) * 100, 100).toFixed(4);

  return createPortal(
    <div className="modal-overlay" onClick={() => setShowSettings(false)}>
      <div
        className="modal-content glass-panel settings-modal"
        onClick={e => e.stopPropagation()}
        style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        {/* Header */}
        <div className="modal-header">
          <h3>⚙️ Settings</h3>
          <button className="close-btn" onClick={() => setShowSettings(false)}>✕</button>
        </div>

        {/* Tab bar */}
        <div className="settings-tab-bar">
          {SETTINGS_TABS.map(tab => (
            <button
              key={tab.id}
              className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="modal-body">
          {activeTab === 'cloud' && (
            <div className="usage-dashboard">

              {/* Card 1 — Total Checklists */}
              <div className="usage-card">
                <h4>Total Checklists</h4>
                <div className="usage-value">{rawCloudData?.length ?? 0}</div>
                <p className="usage-subtitle">Templates stored in Firestore</p>
              </div>

              {/* Card 2 — Storage Used */}
              <div className="usage-card">
                <h4>Storage Used</h4>
                <div className="usage-value">{formatBytes(estimatedBytes)}</div>
                <div className="progress-container">
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${Math.max(usagePct, 0.5)}%` }}></div>
                  </div>
                  <div className="progress-labels">
                    <span>0 GB</span>
                    <span>{usagePct}% of 1 GB quota</span>
                    <span>1 GB</span>
                  </div>
                </div>
              </div>

              {/* Card 3 — Status */}
              <div className="usage-card status-card">
                <h4>Database Status</h4>
                <div className="status-indicator">
                  <div className="status-dot online"></div>
                  <span>Healthy &amp; Synced</span>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ════════════════════════════════════════════════════
   CHECKPOINTS EDITOR
════════════════════════════════════════════════════ */
function CheckpointsEditor({ checkpoints, setCheckpoints }) {
  const addCheckpoint = () =>
    setCheckpoints([...checkpoints, { id: Date.now().toString(), label: '', type: 'text', options: '' }]);
  const removeCheckpoint = (id) =>
    setCheckpoints(checkpoints.filter(cp => cp.id !== id));
  const updateCheckpoint = (id, field, value) =>
    setCheckpoints(checkpoints.map(cp => cp.id === id ? { ...cp, [field]: value } : cp));

  return (
    <div className="checkpoints-editor">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
        <label style={{ margin: 0, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', fontWeight: 700 }}>
          Checkpoints
        </label>
        <button type="button" onClick={addCheckpoint} className="secondary-btn" style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem' }}>
          + Add
        </button>
      </div>

      {checkpoints.length === 0 && (
        <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-tertiary)', fontFamily: 'var(--font-display)', border: '1px dashed var(--border)' }}>
          No checkpoints yet — click + Add to create one.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {checkpoints.map((cp, index) => (
          <div key={cp.id} className="checkpoint-editor-item">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.65rem', alignItems: 'center' }}>
              <span style={{ color: 'var(--accent-hover)', fontWeight: 700, fontSize: '0.8rem', fontFamily: 'var(--font-display)' }}>
                Checkpoint {index + 1}
              </span>
              <button type="button" onClick={() => removeCheckpoint(cp.id)} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: 'var(--neon-red)', cursor: 'pointer', fontSize: '0.85rem', width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', flexShrink: 0 }}>
                ✕
              </button>
            </div>
            <input
              type="text"
              placeholder="Label (e.g., Check Oil Level)"
              value={cp.label}
              onChange={e => updateCheckpoint(cp.id, 'label', e.target.value)}
              required
              className="styled-input"
              style={{ marginBottom: '0.5rem', fontSize: '0.88rem' }}
            />
            <select
              value={cp.type}
              onChange={e => updateCheckpoint(cp.id, 'type', e.target.value)}
              className="styled-select"
              style={{ fontSize: '0.88rem' }}
            >
              <option value="text">Text Input</option>
              <option value="number">Number Input</option>
              <option value="dropdown">Dropdown Selection</option>
            </select>
            {cp.type === 'dropdown' && (
              <input
                type="text"
                placeholder="Options (comma-separated): Pass, Fail, N/A"
                value={cp.options}
                onChange={e => updateCheckpoint(cp.id, 'options', e.target.value)}
                required
                className="styled-input"
                style={{ marginTop: '0.5rem', fontSize: '0.88rem' }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════
   CREATE CHECKLIST MODAL — via createPortal
════════════════════════════════════════════════════ */
function CreateChecklistModal({ showCreateModal, setShowCreateModal }) {
  const [title, setTitle]               = useState('');
  const [description, setDescription]   = useState('');
  const [checkpoints, setCheckpoints]   = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (showCreateModal) { setTitle(''); setDescription(''); setCheckpoints([]); setIsSubmitting(false); }
  }, [showCreateModal]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'checklists'), { title: title.trim(), description: description.trim(), checkpoints });
      setShowCreateModal(false);
    } catch (err) {
      console.error(err);
      alert('Failed to create checklist.');
    } finally { setIsSubmitting(false); }
  };

  if (!showCreateModal) return null;

  return createPortal(
    <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
      <div className="modal-content glass-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '100%' }}>
        <div className="modal-header">
          <h3>✨ Create New Template</h3>
          <button className="close-btn" onClick={() => setShowCreateModal(false)}>✕</button>
        </div>
        <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
          <form onSubmit={handleSubmit} className="login-form">
            <div className="input-group">
              <label>Title</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Weekly Server Maintenance" required />
            </div>
            <div className="input-group">
              <label>Description</label>
              <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="A brief description of this template…" required />
            </div>
            <div className="section-divider" style={{ margin: '1.1rem 0' }}></div>
            <CheckpointsEditor checkpoints={checkpoints} setCheckpoints={setCheckpoints} />
            <div className="section-divider" style={{ margin: '1.1rem 0' }}></div>
            <button type="submit" className="primary-btn" style={{ width: '100%' }} disabled={isSubmitting}>
              {isSubmitting ? <><span className="spinner"></span> Creating…</> : '🚀 Create Checklist'}
            </button>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ════════════════════════════════════════════════════
   EDIT CHECKLIST MODAL — via createPortal
════════════════════════════════════════════════════ */
function EditChecklistModal({ showEditModal, setShowEditModal, selectedChecklist }) {
  const [title, setTitle]               = useState('');
  const [description, setDescription]   = useState('');
  const [checkpoints, setCheckpoints]   = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (showEditModal && selectedChecklist) {
      setTitle(selectedChecklist.title || '');
      setDescription(selectedChecklist.description || '');
      setCheckpoints(selectedChecklist.checkpoints || []);
      setIsSubmitting(false);
    }
  }, [showEditModal, selectedChecklist]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !selectedChecklist) return;
    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, 'checklists', selectedChecklist.id), { title: title.trim(), description: description.trim(), checkpoints });
      setShowEditModal(false);
    } catch (err) {
      console.error(err);
      alert('Failed to update checklist.');
    } finally { setIsSubmitting(false); }
  };

  if (!showEditModal) return null;

  return createPortal(
    <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
      <div className="modal-content glass-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '100%' }}>
        <div className="modal-header">
          <h3>✏️ Edit Template</h3>
          <button className="close-btn" onClick={() => setShowEditModal(false)}>✕</button>
        </div>
        <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
          <form onSubmit={handleSubmit} className="login-form">
            <div className="input-group">
              <label>Title</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} required />
            </div>
            <div className="input-group">
              <label>Description</label>
              <input type="text" value={description} onChange={e => setDescription(e.target.value)} required />
            </div>
            <div className="section-divider" style={{ margin: '1.1rem 0' }}></div>
            <CheckpointsEditor checkpoints={checkpoints} setCheckpoints={setCheckpoints} />
            <div className="section-divider" style={{ margin: '1.1rem 0' }}></div>
            <button type="submit" className="primary-btn" style={{ width: '100%' }} disabled={isSubmitting}>
              {isSubmitting ? <><span className="spinner"></span> Saving…</> : '💾 Save Changes'}
            </button>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ════════════════════════════════════════════════════
   SUBMISSION CARD (with PDF export)
════════════════════════════════════════════════════ */
function SubmissionCard({ sub }) {
  const [expanded, setExpanded] = useState(false);
  const date = sub.submittedAt ? new Date(sub.submittedAt.toDate()).toLocaleString() : 'Just now';

  return (
    <div className="submission-card glass-panel">
      {/* Always-visible row */}
      <div className="submission-header">
        <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setExpanded(e => !e)}>
          <div className="submission-code">{sub.uniqueCode}</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '0.15rem', fontFamily: 'var(--font-display)' }}>
            <strong style={{ color: 'var(--text-primary)' }}>{sub.checklistTitle}</strong>
            <span style={{ margin: '0 0.4rem', color: 'var(--text-tertiary)' }}>·</span>
            {sub.fillerName}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem', flexShrink: 0 }}>
          <span className="submission-time">{date}</span>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button className="pdf-btn" onClick={() => generatePDFReport(sub)}>
              📄 PDF
            </button>
            <button
              onClick={() => setExpanded(e => !e)}
              style={{ background: 'none', border: 'none', color: 'var(--accent-hover)', fontSize: '0.72rem', fontFamily: 'var(--font-display)', fontWeight: 600, cursor: 'pointer', padding: '0.2rem 0.4rem' }}
            >
              {expanded ? '▲ Hide' : '▼ View'}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{ marginTop: '1rem', animation: 'slideUpItem 0.3s ease both' }}>
          {sub.checkpointResponses?.length > 0 && (
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '10px', marginBottom: '0.75rem' }}>
              <h4 style={{ margin: '0 0 0.6rem 0', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                Checkpoint Responses
              </h4>
              <div style={{ display: 'grid', gap: '0.4rem' }}>
                {sub.checkpointResponses.map((cp, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.25rem', fontSize: '0.83rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{cp.label}</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{cp.value || '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {sub.notes && (
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.85rem 1rem', borderRadius: '10px', marginBottom: '0.75rem' }}>
              <strong style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', fontWeight: 700 }}>Notes</strong>
              <p style={{ marginTop: '0.4rem', fontSize: '0.83rem', whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }}>{sub.notes}</p>
            </div>
          )}

          {sub.signatures && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {['cmm', 'amm'].map(key => (
                <div key={key} style={{ background: 'rgba(255,255,255,0.04)', padding: '0.85rem', borderRadius: '10px', border: '1px solid var(--border)' }}>
                  <h4 style={{ margin: '0 0 0.45rem 0', color: 'var(--accent-hover)', fontSize: '0.72rem', fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    {key === 'cmm' ? '🏭 CMM' : '🔧 AMM'}
                  </h4>
                  {sub.signatures[key] ? (
                    <>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', lineHeight: 1.8 }}>
                        <div><strong style={{ color: 'var(--text-primary)' }}>{sub.signatures[key].name}</strong></div>
                        <div>{sub.signatures[key].designation}</div>
                        <div>{sub.signatures[key].date}</div>
                      </div>
                      {sub.signatures[key].signatureDataUrl && (
                        <img src={sub.signatures[key].signatureDataUrl} alt={`${key} signature`} style={{ background: 'white', borderRadius: '6px', width: '100%', maxHeight: '70px', objectFit: 'contain' }} />
                      )}
                    </>
                  ) : (
                    <div style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem' }}>Not signed</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════
   ADMIN VIEW — Main Export
════════════════════════════════════════════════════ */
export default function AdminView({ selectedChecklist, rawCloudData }) {
  const [showSettings, setShowSettings]       = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal]     = useState(false);
  const [showSubmissions, setShowSubmissions] = useState(false);
  const [submissions, setSubmissions]         = useState([]);

  useEffect(() => {
    const q = query(collection(db, 'filled_checklists'), orderBy('submittedAt', 'desc'));
    const unsubscribe = onSnapshot(q, snapshot =>
      setSubmissions(snapshot.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => await signOut(auth);

  /* ── Submissions view ── */
  if (showSubmissions) {
    return (
      <div className="right-pane dashboard-pane animate-slide-in">
        <div className="dashboard-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button onClick={() => setShowSubmissions(false)} className="secondary-btn">← Back</button>
            <h2>Filled Submissions</h2>
            <span className="badge">{submissions.length} total</span>
          </div>
        </div>
        <div className="checklist-container">
          {submissions.length === 0 ? (
            <div className="empty-state glass-panel">
              <div className="empty-state-icon">📭</div>
              <h3>No Submissions Yet</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Filled checklists will appear here.</p>
            </div>
          ) : (
            submissions.map(sub => <SubmissionCard key={sub.id} sub={sub} />)
          )}
        </div>
      </div>
    );
  }

  /* ── Main admin dashboard ── */
  return (
    <div className="right-pane dashboard-pane animate-slide-in">

      {/* Portaled modals — rendered into document.body */}
      <SettingsModal showSettings={showSettings} setShowSettings={setShowSettings} rawCloudData={rawCloudData} />
      <CreateChecklistModal showCreateModal={showCreateModal} setShowCreateModal={setShowCreateModal} />
      <EditChecklistModal showEditModal={showEditModal} setShowEditModal={setShowEditModal} selectedChecklist={selectedChecklist} />

      <div className="dashboard-header">
        <h2>Admin Dashboard</h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="secondary-btn glass-panel" onClick={() => setShowSubmissions(true)}>
            📋 Submissions
            {submissions.length > 0 && (
              <span style={{ marginLeft: '0.3rem', background: 'var(--accent)', color: 'white', borderRadius: '999px', fontSize: '0.68rem', padding: '0.1rem 0.45rem', fontWeight: 700, fontFamily: 'var(--font-display)' }}>
                {submissions.length}
              </span>
            )}
          </button>
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

      {selectedChecklist ? (
        <div className="checklist-details glass-panel animate-fade-in">
          <div className="details-header">
            <div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>{selectedChecklist.title}</h3>
              <p style={{ margin: '0.3rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {selectedChecklist.description}
              </p>
            </div>
            <span className="badge" style={{ fontFamily: 'var(--font-mono)' }}>
              {selectedChecklist.id.slice(0, 8)}…
            </span>
          </div>

          {selectedChecklist.checkpoints?.length > 0 && (
            <div style={{ marginTop: '1.25rem', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border)' }}>
              <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                Checkpoints ({selectedChecklist.checkpoints.length})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {selectedChecklist.checkpoints.map((cp, i) => (
                  <div key={cp.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.83rem' }}>
                    <span style={{ width: 22, height: 22, borderRadius: '6px', background: 'rgba(139,92,246,0.15)', color: 'var(--accent-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800, fontFamily: 'var(--font-display)', border: '1px solid rgba(139,92,246,0.3)', flexShrink: 0 }}>
                      {i + 1}
                    </span>
                    <span style={{ color: 'var(--text-primary)', flex: 1 }}>{cp.label}</span>
                    <span className={`checkpoint-type-badge type-${cp.type}`}>{cp.type}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="action-buttons">
            <button className="action-btn download-btn" onClick={() => alert(`Downloading ${selectedChecklist.title}…`)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              Download PDF
            </button>
            <button className="action-btn edit-btn" onClick={() => setShowEditModal(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              Edit Checklist
            </button>
          </div>
        </div>
      ) : (
        <div className="empty-state glass-panel animate-fade-in">
          <div className="empty-state-icon">🛠️</div>
          <h3>Select a Template</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Choose a checklist from the left panel to manage it here.
          </p>
        </div>
      )}
    </div>
  );
}
