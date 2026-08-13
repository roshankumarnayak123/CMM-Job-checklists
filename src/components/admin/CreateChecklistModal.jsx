import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { toast } from 'react-hot-toast';
import CheckpointsEditor from './CheckpointsEditor';
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll';

export default function CreateChecklistModal({ showCreateModal, setShowCreateModal }) {
  useLockBodyScroll(showCreateModal);
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
      toast.error('Failed to create checklist.');
    } finally { setIsSubmitting(false); }
  };

  const handleClose = () => {
    if (title.trim() || description.trim() || checkpoints.length > 0) {
      if (window.confirm("You have unsaved changes. Are you sure you want to close?")) {
        setShowCreateModal(false);
      }
    } else {
      setShowCreateModal(false);
    }
  };

  if (!showCreateModal) return null;

  return createPortal(
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content glass-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '100%' }}>
        <div className="modal-header">
          <h3>✨ Create New Checklist</h3>
          <button type="button" className="close-btn" aria-label="Close modal" onClick={handleClose}>✕</button>
        </div>
        <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
          <form onSubmit={handleSubmit} className="login-form">
            <div className="input-group">
              <label htmlFor="checklist-title">Title</label>
              <input id="checklist-title" type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Weekly Server Maintenance" required />
            </div>
            <div className="input-group">
              <label htmlFor="checklist-desc">Description</label>
              <input id="checklist-desc" type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="A brief description of this checklist…" required />
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
