import React, { useState, useEffect } from 'react';
import { API_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import { fetchWithAuth, getAvatarUrl } from '../utils/api';

export default function Workflow() {
  const { currentUser, devUser, backendUser } = useAuth();
  const [rawTasks, setRawTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [suggestion, setSuggestion] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const handleAISuggest = async () => {
    try {
        const res = await fetchWithAuth(`${API_URL}/ai/suggest`);
        const data = await res.json();
        if (data.success && data.bestSuggestion) {
            setSuggestion(data.bestSuggestion);
            setShowToast(true);
            setTimeout(() => setShowToast(false), 5000);
        }
    } catch (err) {
        console.error("AI Suggest Error:", err);
    }
  };

  const clearSuggestion = () => setSuggestion(null);
  const [showToast, setShowToast] = useState(false);

  const userEmail = (devUser?.email || currentUser?.email || backendUser?.email || '').toLowerCase();
  const userRole = (devUser?.role || currentUser?.role || backendUser?.role || 'FACULTY').toUpperCase();
  const isAdmin = userRole === 'ADMIN' || userRole === 'HOD';

  // 4 Columns matching the provided image
  // 4 Columns matching the status transitions
  const stages = [
    { id: 'PENDING', title: 'To Do', dot: 'var(--kb-todo-dot)', tint: 'var(--col-todo-bg)' },
    { id: 'IN_PROGRESS', title: 'In Progress', dot: 'var(--kb-progress-dot)', tint: 'var(--col-progress-bg)' },
    { id: 'IN_REVIEW', title: 'In Review', dot: '#8B5CF6', tint: 'rgba(139, 92, 246, 0.05)' },
    { id: 'OVERDUE', title: 'Overdue', dot: '#EF4444', tint: 'rgba(239, 68, 68, 0.05)' },
    { id: 'COMPLETED', title: 'Completed', dot: 'var(--kb-done-dot)', tint: 'var(--col-done-bg)' },
  ];

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const res = await fetchWithAuth(`${API_URL}/tasks`);
        const data = await res.json();
        console.log(`[Workflow] Fetched tasks: ${data.data?.length || 0}. User: ${userEmail}`);
        if (data.success) {
          const mappedTasks = data.data.map((task, idx) => {
            const isMe = task.assignedTo?.email?.toLowerCase() === userEmail || 
                         task.responsibles?.some(r => r.email.toLowerCase() === userEmail);
            
            const others = (task.responsibles || [])
              .filter(r => r.email.toLowerCase() !== userEmail)
              .map(r => r.email);

            const priority = task.priority || 'Medium';
            
            let progress = 0;
            if (task.status === 'COMPLETED') progress = 100;
            else if (task.status === 'IN_REVIEW') progress = 85;
            else if (task.status === 'IN_PROGRESS') progress = 50;

            const displayTitle = task.sprintName ? `${task.title} (${task.sprintName})` : task.title;

            return {
              id: task.id,
              title: displayTitle,
              faculty: task.assignedTo?.name || 'Unassigned',
              stage: task.status || 'PENDING',
              deadline: task.deadline ? new Date(task.deadline).toLocaleDateString() : null,
              priority,
              progress,
              description: task.description || '',
              isMe,
              others,
              files: 0, // Not yet implemented in DB
              comments: 0 // Not yet implemented in DB
            };
          });
          setRawTasks(mappedTasks);
        }
      } catch (err) {
        console.error("Failed to fetch tasks:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
    const interval = setInterval(fetchTasks, 30000);
    return () => clearInterval(interval);
  }, [userEmail]);

  return (
    <div className="workflow-container">
      <style>{`
        .workflow-container { display: flex; flex-direction: column; gap: 1.5rem; height: calc(100vh - 120px); font-family: 'SN Pro', sans-serif; }
        
        /* ─── Control Bar ───────────────────────────────────────────── */
        .wf-controls { display: flex; align-items: center; gap: 1rem; margin-bottom: 0.5rem; }
        .wf-search-wrap { display: flex; align-items: center; background: white; border: 1px solid #E2E8F0; border-radius: 99px; padding: 0.4rem 1rem; gap: 0.5rem; width: 180px; }
        .wf-search-wrap input { border: none; outline: none; font-size: 0.85rem; color: #64748B; width: 100%; }
        
        .wf-filter-group { display: flex; align-items: center; gap: 0.5rem; color: #64748B; font-size: 0.85rem; font-weight: 500; }
        .wf-select { background: white; border: 1px solid #E2E8F0; border-radius: 10px; padding: 0.4rem 0.75rem; font-size: 0.8rem; font-weight: 600; color: #1E293B; outline: none; cursor: pointer; }
        .wf-btn-white { background: white; border: 1px solid #E2E8F0; border-radius: 10px; padding: 0.4rem 0.75rem; font-size: 0.8rem; font-weight: 600; color: #1E293B; display: flex; align-items: center; gap: 0.4rem; cursor: pointer; }
        
        .wf-btn-add { margin-left: auto; background: var(--kb-yellow); color: #451A03; border: none; border-radius: 10px; padding: 0.5rem 1rem; font-size: 0.8rem; font-weight: 700; display: flex; align-items: center; gap: 0.4rem; cursor: pointer; transition: transform 0.2s; box-shadow: 0 4px 10px rgba(251, 191, 36, 0.2); }
        .wf-btn-add:hover { transform: translateY(-1px); }

        .wf-btn-ai { background: var(--primary); color: white; border: none; border-radius: 10px; padding: 0.5rem 1rem; font-size: 0.8rem; font-weight: 700; display: flex; align-items: center; gap: 0.4rem; cursor: pointer; transition: transform 0.2s; box-shadow: 0 4px 10px rgba(99, 102, 241, 0.2); }
        .wf-btn-ai:hover { transform: translateY(-1px); }
        .wf-ai-icon { font-size: 1.2rem; line-height: 1; }

        /* ─── Kanban Board ─────────────────────────────────────────── */
        .kanban-board { display: flex; gap: 1rem; overflow-x: auto; flex: 1; padding-bottom: 1rem; }
        .kanban-column { flex: 1; min-width: 200px; border-radius: 12px; display: flex; flex-direction: column; max-height: 100%; overflow: hidden; }
        
        .kanban-col-header { padding: 0.75rem 1rem; display: flex; align-items: center; justify-content: space-between; font-weight: 800; font-size: 0.85rem; color: #1E293B; }
        .col-dot-title { display: flex; align-items: center; gap: 0.75rem; }
        .col-dot { width: 8px; height: 8px; border-radius: 50%; }
        .col-more { color: #94A3B8; cursor: pointer; font-size: 1.2rem; }

        .kanban-col-body { padding: 0.5rem; display: flex; flex-direction: column; gap: 0.5rem; overflow-y: auto; flex: 1; }
        
        /* ─── Cards ─────────────────────────────────────────────────── */
        .kb-card { background: white; border: none; border-radius: 10px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02); padding: 0.75rem; cursor: grab; transition: transform 0.2s; }
        .kb-card:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0, 0, 0, 0.04); }
        
        .kb-badge { font-size: 0.55rem; font-weight: 800; padding: 0.15rem 0.4rem; border-radius: 4px; display: inline-block; margin-bottom: 0.4rem; }
        .kb-badge.high { background: #FEF2F2; color: #EF4444; }
        .kb-badge.medium { background: #FEFCE8; color: #CA8A04; }
        .kb-badge.low { background: #F0FDF4; color: #16A34A; }
        
        .kb-title { font-weight: 800; color: #1E293B; font-size: 0.8rem; margin-bottom: 0.3rem; line-height: 1.3; letter-spacing: -0.01em; }
        .kb-note { font-size: 0.7rem; color: #64748B; line-height: 1.4; margin-bottom: 0.75rem; font-weight: 400; }
        
        .kb-progress-wrap { margin-bottom: 0.75rem; }
        .kb-progress-label { display: flex; justify-content: space-between; font-size: 0.65rem; font-weight: 700; color: #64748B; margin-bottom: 0.3rem; }
        .kb-progress-bar { width: 100%; height: 6px; background: #F1F5F9; border-radius: 100px; overflow: hidden; }
        .kb-progress-fill { height: 100%; background: var(--kb-teal); border-radius: 100px; transition: width 1s ease-in-out; }
        
        .kb-footer { display: flex; align-items: center; justify-content: space-between; padding-top: 0.75rem; border-top: 1px solid #F1F5F9; }
        .kb-avatars { display: flex; -webkit-mask-image: linear-gradient(to right, black 80%, transparent 100%); }
        .kb-avatar { width: 18px; height: 18px; border-radius: 50%; border: 1.5px solid white; margin-left: -6px; }
        .kb-avatar:first-child { margin-left: 0; }
        
        .kb-meta { display: flex; align-items: center; gap: 0.5rem; color: #94A3B8; font-size: 0.65rem; font-weight: 600; }
        .kb-meta-item { display: flex; align-items: center; gap: 0.2rem; }

        /* Dark Mode OLED Adjustments */
        body.theme-dark .kb-card { background: #121212; border: 1px solid #1F2937; }
        body.theme-dark .kb-title { color: #F8FAFC; }
        body.theme-dark .kb-progress-bar { background: #27272A; }
        body.theme-dark .wf-search-wrap, body.theme-dark .wf-select, body.theme-dark .wf-btn-white { background: #121212; border-color: #27272A; color: #A1A1AA; }
        body.theme-dark .wf-btn-add { color: #FFF; }
        body.theme-dark .wf-btn-ai { color: #FFF; }
      `}</style>

      {/* ─── Control Bar ───────────────────────────────────────────── */}
      <div className="wf-controls">
        {isAdmin && (
            <div style={{
                background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)',
                padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.75rem',
                fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em',
                border: '1px solid rgba(99, 102, 241, 0.3)', display: 'flex', alignItems: 'center', gap: '0.4rem'
            }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                Admin View
            </div>
        )}
        <button className="wf-btn-ai" onClick={handleAISuggest}>
          <span className="wf-ai-icon">✨</span> AI Suggest Assignments
        </button>
        <div className="wf-search-wrap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input 
            type="text" 
            placeholder="Search task" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="wf-filter-group">
          <span>Sort by:</span>
          <select className="wf-select">
            <option>Stage</option>
            <option>Priority</option>
            <option>Deadline</option>
          </select>
        </div>
        <button className="wf-btn-white">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
          Filter
        </button>
        <button className="wf-btn-add">
          <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>+</span> Add New
        </button>
      </div>

      <div className="kanban-board">
        {stages.map(stage => {
          const colTasks = rawTasks.filter(t => {
            const matchesStage = t.stage === stage.id;
            const matchesSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                 t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                 t.faculty.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesStage && matchesSearch;
          });
          return (
            <div className="kanban-column" key={stage.id} style={{ background: stage.tint }}>
              <div className="kanban-col-header">
                <div className="col-dot-title">
                  <div className="col-dot" style={{ background: stage.dot }} />
                  {stage.title}
                </div>
                <div className="col-more">⋯</div>
              </div>
              <div className="kanban-col-body">
                {colTasks.map(task => (
                  <div className="kb-card" key={task.id}>
                    <div className={`kb-badge ${task.priority.toLowerCase()}`}>{task.priority}</div>
                    <div className="kb-title">{task.title}</div>
                    {task.description && (
                      <div className="kb-note">{task.description}</div>
                    )}

                    
                    <div className="kb-progress-wrap">
                      <div className="kb-progress-label">
                        <span>Progress</span>
                        <span>{task.progress}%</span>
                      </div>
                      <div className="kb-progress-bar">
                        <div className="kb-progress-fill" style={{ width: `${task.progress}%` }} />
                      </div>
                    </div>

                    <div className="kb-footer">
                      <div className="kb-avatars">
                        <img src={getAvatarUrl(task.faculty || task.id)} className="kb-avatar" alt="A" title={task.faculty} />
                        {task.others && task.others.length > 0 && (
                          <img src={getAvatarUrl(task.others[0])} className="kb-avatar" alt="B" title={task.others[0].split('@')[0]} />
                        )}
                        {task.isMe && task.others.length === 0 && (
                          <div title="You" style={{ width: 24, height: 24, borderRadius: '50%', background: '#F1F5F9', border: '2px solid white', marginLeft: -8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#64748B' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                          </div>
                        )}
                      </div>
                      <div className="kb-meta">
                        <div className="kb-meta-item">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                          {task.comments}
                        </div>
                        <div className="kb-meta-item">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
                          {task.files}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {colTasks.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#94A3B8', fontSize: '0.8rem', fontStyle: 'italic' }}>
                    No items found
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showToast && suggestion && (
          <div style={{
              position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 1000,
              background: 'var(--bg-card)', border: '1px solid var(--primary)',
              padding: '1.25rem', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              display: 'flex', alignItems: 'center', gap: '1rem',
              animation: 'slideUp 0.3s ease-out'
          }}>
              <div style={{ background: 'var(--primary)', padding: '0.6rem', borderRadius: '10px' }}>✨</div>
              <div>
                  <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.9rem' }}>Smart Suggestion</div>
                  <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>
                      <b>{suggestion.name}</b> has the lowest current load ({suggestion.activeTasks} tasks).
                  </div>
              </div>
              <button 
                onClick={() => setShowToast(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '0.5rem' }}
              >✕</button>
          </div>
      )}

      <style>{`
          @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </div>
  );
}
