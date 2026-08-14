import { useState } from 'react';


export default function SubmissionCard({ sub, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const date = sub.submittedAt ? new Date(typeof sub.submittedAt.toDate === 'function' ? sub.submittedAt.toDate() : sub.submittedAt).toLocaleString() : 'Just now';

  const handleDownloadPDF = async () => {
    const { generatePDFReport } = await import('../../utils/pdfGenerator');
    generatePDFReport(sub);
  };

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
            <button className="pdf-btn" onClick={handleDownloadPDF}>
              📄 PDF
            </button>
            <button className="pdf-btn" onClick={() => onDelete(sub)} style={{ color: 'var(--neon-red)', borderColor: 'rgba(255, 60, 60, 0.3)' }}>
              🗑️ Delete
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
                  <div key={idx} style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.4rem', fontSize: '0.83rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{cp.label}</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{cp.value || '—'}</span>
                    </div>
                    {cp.photoDataUrl && (
                      <div style={{ marginTop: '0.4rem' }}>
                        <img src={cp.photoDataUrl} alt="Checkpoint photo" style={{ height: '40px', borderRadius: '4px', objectFit: 'cover' }} />
                      </div>
                    )}
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
