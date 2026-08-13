export function generatePDFReport(sub) {
  const formattedDate = sub.submittedAt
    ? new Date(typeof sub.submittedAt.toDate === 'function' ? sub.submittedAt.toDate() : sub.submittedAt).toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' })
    : 'N/A';

  const escape = (str = '') => String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const checkpointsHTML = sub.checkpointResponses?.length > 0
    ? sub.checkpointResponses.map((cp, i) => `
        <tr>
          <td class="cp-num">${i + 1}</td>
          <td class="cp-label">${escape(cp.label)}</td>
          <td class="cp-value">
            ${escape(cp.value) || '<span style="color:#94a3b8">—</span>'}
            ${cp.photoDataUrl ? `<div style="margin-top: 8px;"><img src="${cp.photoDataUrl}" style="max-height: 80px; border-radius: 4px; object-fit: cover;" alt="Checkpoint Photo"></div>` : ''}
          </td>
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
          <p class="sig-missing" style="color: #16a34a; font-weight: 600;">Approved</p>
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
    .checklist-title { font-size: 18px; font-weight: 800; color: #1e293b; margin-top: 12px; }
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
        <div class="checklist-title">${escape(sub.checklistTitle || 'Checklist Report')}</div>
      </div>
      <div class="code-block">
        <div class="code-label">Tracking Code</div>
        <div class="code-value">${escape(sub.uniqueCode)}</div>
      </div>
    </div>

    <!-- Meta -->
    <div class="meta-card">
      <div class="meta-grid">
        <div class="meta-item">
          <span class="meta-label">Filled By</span>
          <span class="meta-value">${escape(sub.fillerName || 'Anonymous')}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Submitted At</span>
          <span class="meta-value">${formattedDate}</span>
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
}
