import { useState, useEffect } from 'react';
import { useLockBodyScroll } from './hooks/useLockBodyScroll';

const BASE_URL = `${window.location.origin}${import.meta.env.BASE_URL}`;

export default function ShareLinkModal({ tokenId, expiresAtMs, checklistTitle, fillerName, onClose }) {
  useLockBodyScroll(true);
  const reviewUrl = `${BASE_URL}?review=${tokenId}`;
  const [copied, setCopied] = useState(false);
  // Bug #3 fix: compute remaining seconds from actual expiry time, not a hardcoded 3600
  const [secondsLeft, setSecondsLeft] = useState(() => Math.max(0, Math.round((expiresAtMs - Date.now()) / 1000)));

  // Countdown timer
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setInterval(() => setSecondsLeft(s => {
      if (s <= 1) { clearInterval(id); return 0; }
      return s - 1;
    }), 1000);
    return () => clearInterval(id);
  }, []);

  const formatCountdown = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const urgencyClass = secondsLeft < 300 ? 'countdown-urgent' : secondsLeft < 900 ? 'countdown-warning' : 'countdown-ok';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(reviewUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback for older browsers
      const el = document.createElement('textarea');
      el.value = reviewUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const whatsappMessage = encodeURIComponent(
    `Hello,\n\nPlease review and sign the CMM checklist:\n📋 *${checklistTitle}*\nFilled by: ${fillerName}\n\n🔗 Review Link (valid for 1 hour):\n${reviewUrl}\n\nOpen the link, review the checklist, draw your signature, and submit.\n\nThank you.`
  );

  const emailSubject = encodeURIComponent(`CMM Checklist Review Request — ${checklistTitle}`);
  const emailBody = encodeURIComponent(
    `Hello,\n\nPlease review and digitally sign the following CMM checklist:\n\nChecklist: ${checklistTitle}\nFilled by: ${fillerName}\n\nReview Link (valid for 1 hour):\n${reviewUrl}\n\nPlease open the link, review the checklist entries, draw your signature, and click "Approve & Sign".\n\nNote: This link will expire in 1 hour.\n\nThank you,\nCentral Mechanical Maintenance`
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content glass-panel share-modal"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div>
            <h3>🔗 Review Link Generated</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              Share this link with Area Maintenance to review &amp; sign
            </p>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="modal-body share-modal-body">

          {/* Countdown */}
          <div className={`share-countdown ${urgencyClass}`}>
            <div className="countdown-icon">⏱</div>
            <div>
              <div className="countdown-time">{secondsLeft > 0 ? formatCountdown(secondsLeft) : 'Expired'}</div>
              <div className="countdown-label">Link expires in</div>
            </div>
          </div>

          {/* URL Box */}
          <div className="share-url-box">
            <div className="share-url-label">📎 Review URL</div>
            <div className="share-url-row">
              <input
                type="text"
                readOnly
                value={reviewUrl}
                className="styled-input share-url-input"
                onFocus={e => e.target.select()}
                aria-label="Review URL"
              />
              <button
                className={`copy-btn ${copied ? 'copied' : ''}`}
                onClick={handleCopy}
                title="Copy to clipboard"
              >
                {copied ? '✓ Copied!' : '📋 Copy'}
              </button>
            </div>
          </div>

          {/* Share buttons */}
          <div className="share-buttons-section">
            <div className="share-buttons-label">Share via</div>
            <div className="share-buttons-row">
              <a
                href={`https://wa.me/?text=${whatsappMessage}`}
                target="_blank"
                rel="noopener noreferrer"
                className="share-btn whatsapp-btn"
                aria-label="Share via WhatsApp"
              >
                <span className="share-btn-icon">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                </span>
                <span>WhatsApp</span>
              </a>

              <a
                href={`mailto:?subject=${emailSubject}&body=${emailBody}`}
                className="share-btn email-btn"
                aria-label="Share via Email"
              >
                <span className="share-btn-icon">✉️</span>
                <span>Email</span>
              </a>
            </div>
          </div>

          {/* Info note */}
          <div className="share-info-note">
            <span>ℹ️</span>
            <span>
              Area Maintenance can open this link on any device — mobile or PC — without logging in.
              Once they sign and submit, the record will be saved automatically.
            </span>
          </div>

        </div>

        <div className="modal-footer share-modal-footer">
          <button className="secondary-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
