import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { auth, db } from '../../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { updatePassword, sendPasswordResetEmail } from 'firebase/auth';
import { toast } from 'react-hot-toast';
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll';

const SETTINGS_TABS = [
  { id: 'cloud', icon: '📊', label: 'Cloud Usage' },
  { id: 'account', icon: '👤', label: 'Account' },
  { id: 'manual', icon: '📘', label: 'Store Manual' },
  { id: 'audit', icon: '📝', label: 'Audit Log' }
];

export default function SettingsModal({ showSettings, setShowSettings, rawCloudData }) {
  useLockBodyScroll(showSettings);
  const [activeTab, setActiveTab] = useState('cloud');
  const [storageStats, setStorageStats] = useState({
    templates: 0,
    textData: 0,
    signatures: 0,
    total: 0,
    isCalculating: true
  });

  useEffect(() => {
    if (activeTab === 'cloud' && showSettings) {
      calculateStorage();
    }
  }, [activeTab, showSettings]);

  const calculateStorage = async () => {
    setStorageStats(prev => ({ ...prev, isCalculating: true }));
    try {
      let templatesSize = 0;
      let textDataSize = 0;
      let signaturesSize = 0;

      // 1. Checklists (Templates)
      const checklistsSnap = await getDocs(collection(db, 'checklists'));
      checklistsSnap.forEach(doc => {
        templatesSize += JSON.stringify(doc.data()).length * 2; // rough byte size for JS string
      });

      // 2. Filled Checklists (Text + Signatures)
      const filledSnap = await getDocs(collection(db, 'filled_checklists'));
      filledSnap.forEach(doc => {
        const data = doc.data();
        let cmmSigUrl = data.signatures?.cmm?.signatureDataUrl || '';
        let ammSigUrl = data.signatures?.amm?.signatureDataUrl || '';
        signaturesSize += (cmmSigUrl.length + ammSigUrl.length) * 2;
        
        const textData = { ...data };
        if (textData.signatures) {
          textData.signatures = { ...textData.signatures };
          if (textData.signatures.cmm) textData.signatures.cmm = { ...textData.signatures.cmm, signatureDataUrl: null };
          if (textData.signatures.amm) textData.signatures.amm = { ...textData.signatures.amm, signatureDataUrl: null };
        }
        textDataSize += JSON.stringify(textData).length * 2;
      });

      // 3. Review Tokens
      const tokensSnap = await getDocs(collection(db, 'review_tokens'));
      tokensSnap.forEach(doc => {
        const data = doc.data();
        let cmmSigUrl = data.cmmSignature?.signatureDataUrl || '';
        let ammSigUrl = data.ammSignature?.signatureDataUrl || '';
        signaturesSize += (cmmSigUrl.length + ammSigUrl.length) * 2;
        
        const textData = { ...data };
        if (textData.cmmSignature) textData.cmmSignature = { ...textData.cmmSignature, signatureDataUrl: null };
        if (textData.ammSignature) textData.ammSignature = { ...textData.ammSignature, signatureDataUrl: null };
        textDataSize += JSON.stringify(textData).length * 2;
      });

      setStorageStats({
        templates: templatesSize,
        textData: textDataSize,
        signatures: signaturesSize,
        total: templatesSize + textDataSize + signaturesSize,
        isCalculating: false
      });
    } catch (err) {
      console.error("Error calculating storage:", err);
      setStorageStats(prev => ({ ...prev, isCalculating: false }));
    }
  };

  if (!showSettings) return null;

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const quotaBytes = 1_073_741_824;
  const usagePct = Math.min((storageStats.total / quotaBytes) * 100, 100).toFixed(4);

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
          <button type="button" className="close-btn" aria-label="Close settings" onClick={() => setShowSettings(false)}>✕</button>
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

              {/* Card 1 — Total Templates (Bug #5 fix: was misleadingly labelled "Total Checklists") */}
              <div className="usage-card">
                <h4>Checklist Templates</h4>
                <div className="usage-value">{rawCloudData?.length ?? 0}</div>
                <p className="usage-subtitle">Templates created by admin</p>
              </div>

              {/* Card 2 — Storage Used Categorically */}
              <div className="usage-card" style={{ gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <h4>Categorical Storage Breakdown</h4>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{usagePct}% of 1GB Quota Used</span>
                </div>
                <div className="usage-value">{storageStats.isCalculating ? 'Calculating...' : formatBytes(storageStats.total)}</div>
                
                {!storageStats.isCalculating && (
                  <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    
                    {/* Templates */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.3rem', color: 'var(--text-secondary)' }}>
                        <span>📑 Checklist Templates</span>
                        <span>{formatBytes(storageStats.templates)}</span>
                      </div>
                      <div className="progress-bar" style={{ height: '8px' }}>
                        <div className="progress-fill" style={{ width: `${Math.max((storageStats.templates / quotaBytes) * 100, 0.5)}%`, background: '#3b82f6', transition: 'width 0.5s ease-out' }}></div>
                      </div>
                    </div>

                    {/* Text Data */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.3rem', color: 'var(--text-secondary)' }}>
                        <span>📝 Text Responses & Metadata</span>
                        <span>{formatBytes(storageStats.textData)}</span>
                      </div>
                      <div className="progress-bar" style={{ height: '8px' }}>
                        <div className="progress-fill" style={{ width: `${Math.max((storageStats.textData / quotaBytes) * 100, 0.5)}%`, background: '#10b981', transition: 'width 0.5s ease-out' }}></div>
                      </div>
                    </div>

                    {/* Signatures */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.3rem', color: 'var(--text-secondary)' }}>
                        <span>✍️ Base64 Signatures</span>
                        <span>{formatBytes(storageStats.signatures)}</span>
                      </div>
                      <div className="progress-bar" style={{ height: '8px' }}>
                        <div className="progress-fill" style={{ width: `${Math.max((storageStats.signatures / quotaBytes) * 100, 0.5)}%`, background: '#f59e0b', transition: 'width 0.5s ease-out' }}></div>
                      </div>
                    </div>

                  </div>
                )}
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
          {activeTab === 'account' && (
            <div className="settings-section animate-fade-in" style={{ padding: '1rem' }}>
              <h4>Admin Account</h4>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                You are currently logged in as an administrator ({auth.currentUser?.email}).
              </p>
              <button 
                className="secondary-btn" 
                onClick={async () => {
                  if (auth.currentUser?.email) {
                    try {
                      await sendPasswordResetEmail(auth, auth.currentUser.email);
                      toast.success('Password reset link sent to your email.');
                    } catch (err) {
                      console.error('Error sending reset email:', err);
                      toast.error('Failed to send password reset email.');
                    }
                  }
                }}
              >
                Reset Password
              </button>
            </div>
          )}
          {activeTab === 'manual' && (
            <div className="settings-section animate-fade-in" style={{ padding: '1rem' }}>
              <h4>Store Operations Manual</h4>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                Access the official CMM SMS Store Operations Training Manual. You can view it in your browser or download the PDF for offline access.
              </p>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <a 
                  href="/CMM_SMS_Store_Training_Manual.pdf" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="primary-btn"
                  style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  👁️ View Manual
                </a>
                <a 
                  href="/CMM_SMS_Store_Training_Manual.pdf" 
                  download="CMM_SMS_Store_Training_Manual.pdf"
                  className="secondary-btn"
                  style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  📥 Download PDF
                </a>
              </div>
            </div>
          )}
          {activeTab === 'audit' && (
            <div className="settings-section animate-fade-in" style={{ padding: '1rem' }}>
              <h4>Audit Log</h4>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                System events and changes will appear here. (Coming soon)
              </p>
              <div className="empty-state glass-panel" style={{ padding: '2rem' }}>
                <p style={{ color: 'var(--text-tertiary)' }}>No recent events.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
