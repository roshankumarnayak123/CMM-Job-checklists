export default function CheckpointsEditor({ checkpoints, setCheckpoints }) {
  const addCheckpoint = () =>
    setCheckpoints([...checkpoints, { id: Date.now().toString(), label: '', type: 'text', options: '' }]);
  const removeCheckpoint = (id) =>
    setCheckpoints(checkpoints.filter(cp => cp.id !== id));
  const updateCheckpoint = (id, field, value) =>
    setCheckpoints(checkpoints.map(cp => cp.id === id ? { ...cp, [field]: value } : cp));

  const moveCheckpoint = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= checkpoints.length) return;
    const newCheckpoints = [...checkpoints];
    [newCheckpoints[index], newCheckpoints[newIndex]] = [newCheckpoints[newIndex], newCheckpoints[index]];
    setCheckpoints(newCheckpoints);
  };

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
              <span style={{ color: 'var(--accent-hover)', fontWeight: 700, fontSize: '0.8rem', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                Checkpoint {index + 1}
                <div style={{ display: 'flex', gap: '0.2rem' }}>
                  <button type="button" onClick={() => moveCheckpoint(index, -1)} disabled={index === 0} style={{ background: 'transparent', border: 'none', cursor: index === 0 ? 'not-allowed' : 'pointer', opacity: index === 0 ? 0.3 : 1 }}>↑</button>
                  <button type="button" onClick={() => moveCheckpoint(index, 1)} disabled={index === checkpoints.length - 1} style={{ background: 'transparent', border: 'none', cursor: index === checkpoints.length - 1 ? 'not-allowed' : 'pointer', opacity: index === checkpoints.length - 1 ? 0.3 : 1 }}>↓</button>
                </div>
              </span>
              <button type="button" aria-label="Remove checkpoint" onClick={() => removeCheckpoint(cp.id)} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: 'var(--neon-red)', cursor: 'pointer', fontSize: '0.85rem', width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', flexShrink: 0 }}>
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
              <option value="checkbox">Checkbox (True/False)</option>
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
