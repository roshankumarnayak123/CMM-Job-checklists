import { useState, useMemo } from 'react';
import { useAreas } from './hooks/useFirebaseSubscriptions';
import './App.css';

// Color accents for card variety
const CARD_ACCENTS = [
  'var(--accent)',
  'var(--neon-cyan)',
  'var(--neon-green)',
  'var(--neon-pink)',
  'var(--neon-amber)',
];

function SkeletonCard() {
  return (
    <div className="skeleton-card glass-panel">
      <div className="skeleton-line medium" style={{ height: '0.9rem', marginBottom: '0.6rem' }}></div>
      <div className="skeleton-line short"  style={{ height: '0.7rem' }}></div>
    </div>
  );
}

export default function ChecklistView({ checklists, loading, selectedChecklist, setSelectedChecklist }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAreaId, setSelectedAreaId] = useState('');
  const { data: areasList, loading: areasLoading } = useAreas();

  const filteredChecklists = useMemo(() => {
    if (!selectedAreaId) return []; // Require area selection

    return [...checklists]
      .filter(c => {
        const matchesSearch = c.title?.toLowerCase().includes(searchTerm.toLowerCase()) || c.description?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesArea = selectedAreaId === 'ALL' || c.areaId === selectedAreaId;
        return matchesSearch && matchesArea;
      })
      .sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  }, [checklists, searchTerm, selectedAreaId]);

  // 3D tilt effect on card hover
  const handleCardMouseMove = (e, el) => {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width  - 0.5) * 14;
    const y = ((e.clientY - rect.top)  / rect.height - 0.5) * -14;
    el.style.transform = `perspective(600px) rotateX(${y}deg) rotateY(${x}deg) translateZ(4px)`;
  };

  const handleCardMouseLeave = (el) => {
    if (!el) return;
    el.style.transform = 'perspective(600px) rotateX(0deg) rotateY(0deg) translateZ(0)';
  };

  return (
    <div className="left-pane">
      <div className="search-header glass-panel">
        <div className="pane-title">Checklists</div>
        <div className="pane-subtitle" style={{ 
          fontWeight: selectedAreaId ? 'normal' : '600',
          fontSize: selectedAreaId ? '0.9rem' : '1.1rem',
          color: selectedAreaId ? 'var(--text-dim)' : 'var(--text)',
          marginBottom: '1rem',
          marginTop: '0.2rem'
        }}>
          {loading ? 'Loading…' : (selectedAreaId ? `${filteredChecklists.length} checklist${filteredChecklists.length !== 1 ? 's' : ''}` : 'Select an area to continue:')}
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', width: '100%' }}>
          <select 
            value={selectedAreaId} 
            onChange={e => setSelectedAreaId(e.target.value)}
            className="primary-btn"
            style={{ 
              padding: '0.8rem 1rem', 
              borderRadius: '8px', 
              width: '100%',
              textAlign: 'left',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '1rem',
              outline: 'none',
              border: 'none',
              boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)'
            }}
            disabled={areasLoading}
          >
            <option value="">{areasLoading ? 'Loading areas...' : '👇 Select an Area First'}</option>
            <option value="ALL">🌍 All Areas</option>
            {areasList.map(area => (
              <option key={area.id} value={area.id}>📍 {area.name}</option>
            ))}
          </select>
          
          {selectedAreaId && (
            <div className="search-bar" style={{ margin: 0, animation: 'fadeIn 0.3s ease-out' }}>
              <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input
                type="text"
                placeholder="Search checklists in this area…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          )}
        </div>
      </div>

      <div className="checklist-container">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : filteredChecklists.length === 0 ? (
          <div className="no-results">
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔍</div>
            {!selectedAreaId ? 'Please select an area above to view checklists.' : (searchTerm ? `No results for "${searchTerm}"` : 'No checklists available in this area.')}
          </div>
        ) : (
          filteredChecklists.map((checklist, idx) => {
            const accent = CARD_ACCENTS[idx % CARD_ACCENTS.length];
            return (
              <div
                key={checklist.id}
                className={`checklist-card glass-panel ${selectedChecklist?.id === checklist.id ? 'selected' : ''}`}
                style={{ '--card-accent': accent, '--card-accent-glow': accent }}
                onClick={() => setSelectedChecklist(checklist)}
                onMouseMove={e => handleCardMouseMove(e, e.currentTarget)}
                onMouseLeave={e => handleCardMouseLeave(e.currentTarget)}
              >
                <div className="card-title">{checklist.title}</div>
                {checklist.description && (
                  <div className="card-desc">{checklist.description}</div>
                )}
                <div className="card-meta">
                  {checklist.checkpoints?.length > 0 && (
                    <span className="checkpoint-badge">
                      {checklist.checkpoints.length} checkpoint{checklist.checkpoints.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  {selectedChecklist?.id === checklist.id && (
                    <span className="checkpoint-badge" style={{ background: 'rgba(16,185,129,0.12)', color: 'var(--neon-green)', borderColor: 'rgba(16,185,129,0.3)' }}>
                      ✓ Selected
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
