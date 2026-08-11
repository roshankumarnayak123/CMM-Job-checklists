import { useState } from 'react';
import { createPortal } from 'react-dom';

const SETTINGS_TABS = [
  { id: 'cloud', icon: '📊', label: 'Cloud Usage' },
  { id: 'account', icon: '👤', label: 'Account' },
  { id: 'audit', icon: '📝', label: 'Audit Log' }
];

export default function SettingsModal({ showSettings, setShowSettings, rawCloudData }) {
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
          {activeTab === 'account' && (
            <div className="settings-section animate-fade-in" style={{ padding: '1rem' }}>
              <h4>Admin Account</h4>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                You are currently logged in as an administrator.
              </p>
              <button className="secondary-btn" onClick={() => alert('Password reset link sent (mock)')}>Reset Password</button>
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
