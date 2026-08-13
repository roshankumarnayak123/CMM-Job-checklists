import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { toast } from 'react-hot-toast';
import CheckpointsEditor from './CheckpointsEditor';
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll';

export default function EditChecklistModal({ showEditModal, setShowEditModal, selectedChecklist, onDelete }) {
  useLockBodyScroll(showEditModal);
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
      const historyEntry = {
        modifiedAt: new Date().toISOString(),
        previousTitle: selectedChecklist.title,
        previousDescription: selectedChecklist.description,
        previousCheckpoints: selectedChecklist.checkpoints || []
      };
      const updatedHistory = [...(selectedChecklist.history || []), historyEntry];

      await updateDoc(doc(db, 'checklists', selectedChecklist.id), { 
        title: title.trim(), 
        description: description.trim(), 
        checkpoints,
        history: updatedHistory
      });
      setShowEditModal(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update checklist.');
    } finally { setIsSubmitting(false); }
  };

  const isDirty = () => {
    if (!selectedChecklist) return false;
    return title !== selectedChecklist.title || 
           description !== selectedChecklist.description || 
           JSON.stringify(checkpoints) !== JSON.stringify(selectedChecklist.checkpoints || []);
  };

  const handleClose = () => {
    if (isDirty()) {
      if (window.confirm("You have unsaved changes. Are you sure you want to close?")) {
        setShowEditModal(false);
      }
    } else {
      setShowEditModal(false);
    }
  };

  if (!showEditModal) return null;

  return createPortal(
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content glass-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '100%' }}>
        <div className="modal-header">
          <h3>✏️ Edit Checklist</h3>
          <button type="button" className="close-btn" aria-label="Close modal" onClick={handleClose}>✕</button>
        </div>
        <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
          <form onSubmit={handleSubmit} className="login-form">
            <div className="input-group">
              <label htmlFor="edit-checklist-title">Title</label>
              <input id="edit-checklist-title" type="text" value={title} onChange={e => setTitle(e.target.value)} required />
            </div>
            <div className="input-group">
              <label htmlFor="edit-checklist-desc">Description</label>
              <input id="edit-checklist-desc" type="text" value={description} onChange={e => setDescription(e.target.value)} required />
            </div>
            <div className="section-divider" style={{ margin: '1.1rem 0' }}></div>
            <CheckpointsEditor checkpoints={checkpoints} setCheckpoints={setCheckpoints} />
            <div className="section-divider" style={{ margin: '1.1rem 0' }}></div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                type="button" 
                className="secondary-btn" 
                style={{ flex: 1, color: 'var(--neon-red)' }} 
                disabled={isSubmitting}
                onClick={async () => {
                  if (onDelete) {
                    await onDelete();
                    setShowEditModal(false);
                  }
                }}
              >
                🗑️ Delete Checklist
              </button>
              <button type="submit" className="primary-btn" style={{ flex: 1 }} disabled={isSubmitting}>
                {isSubmitting ? <><span className="spinner"></span> Saving…</> : '💾 Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}
