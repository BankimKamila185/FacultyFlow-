import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';
import { fetchWithAuth, getAvatarUrl } from '../utils/api';

export default function Tasks() {
    const { currentUser, devUser, backendUser } = useAuth();
    const [filter, setFilter] = useState('All');
    const [allTasks, setAllTasks] = useState([]);
    const [loading, setLoading] = useState(true);

    const userEmail = (devUser?.email || currentUser?.email || backendUser?.email || '').toLowerCase();

    useEffect(() => {
        const fetchTasks = async () => {
            try {
                const res = await fetchWithAuth(`${API_URL}/tasks`);
                const data = await res.json();
                if (data.success) {
                    const mappedTasks = data.data.map((task, idx) => {
                        const allResp = task.responsibles || [];
                        const isMe = allResp.some(r => r.email.toLowerCase() === userEmail);
                        const colleagues = allResp.filter(r => r.email.toLowerCase() !== userEmail);

                        // Unified status mapping
                        let displayStatus = task.status || 'PENDING';
                        if (displayStatus === 'IN_PROGRESS') displayStatus = 'UPCOMING';
                        else if (displayStatus === 'OVERDUE') displayStatus = 'DELAYED';

                        return {
                            id: task.id,
                            title: task.title,
                            faculty: task.assignedTo?.name || 'Unassigned',
                            deadline: task.deadline ? new Date(task.deadline).toLocaleDateString() : 'No Deadline',
                            status: displayStatus,
                            priority: idx % 3 === 0 ? 'HIGH' : 'MEDIUM',
                            colleagues,
                            isMe,
                            sprintName: task.sprintName || 'SPRINT 1',
                            subEvent: task.subEvent || 'GENERAL'
                        };
                    });
                    setAllTasks(mappedTasks);
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

    const updateTaskStatus = async (taskId, newStatus) => {
        try {
            const res = await fetchWithAuth(`${API_URL}/tasks/${taskId}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status: newStatus })
            });
            const data = await res.json();
            if (data.success) {
                setAllTasks(prev => prev.map(t => {
                    if (t.id === taskId) {
                        return { 
                            ...t, 
                            status: newStatus === 'COMPLETED' ? 'COMPLETED' : 
                                    newStatus === 'IN_PROGRESS' ? 'UPCOMING' : 'PENDING' 
                        };
                    }
                    return t;
                }));
            }
        } catch (err) {
            console.error("Error updating status:", err);
        }
    };

    const filteredTasks = filter === 'All' ? allTasks : allTasks.filter(t => t.status === filter.toUpperCase() || (filter === 'Upcoming' && t.status === 'UPCOMING'));

    return (
        <div className="tasks-container">
            <style>{`
        .tasks-container { display: flex; flex-direction: column; gap: 1rem; font-family: 'SN Pro', sans-serif; }
        
        /* ─── Header & Filters ─────────────────────────────────────── */
        .tasks-header { display: flex; align-items: center; justify-content: space-between; position: relative; }
        .tasks-title { font-weight: 800; font-size: 1.1rem; color: #1E293B; }
        
        .filter-centered { position: absolute; left: 50%; transform: translateX(-50%); display: flex; align-items: center; background: #F8FAFC; padding: 0.2rem; border-radius: 99px; gap: 0.15rem; border: 1px solid #E2E8F0; }
        .filter-pill { border: none; background: transparent; padding: 0.35rem 0.85rem; border-radius: 99px; font-size: 0.75rem; font-weight: 600; color: #64748B; cursor: pointer; transition: all 0.2s; }
        .filter-pill.active { background: #EEF2FF; color: #6366F1; box-shadow: 0 1px 4px rgba(99, 102, 241, 0.1); }
        
        .ai-btn { background: white; color: #6366F1; border: 1px solid #E2E8F0; padding: 0.4rem 0.85rem; border-radius: 10px; font-size: 0.75rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 0.4rem; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03); transition: transform 0.2s; }
        .ai-btn:hover { transform: translateY(-1px); border-color: #6366F1; }

        /* ─── Task Cards ─────────────────────────────────────────── */
        .tasks-grid { display: flex; flex-direction: column; gap: 0.75rem; min-height: 200px; }
        
        .task-card { background: white; border-radius: 16px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.02); padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: 0.6rem; border: 1px solid #F1F5F9; transition: transform 0.2s; }
        .task-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0, 0, 0, 0.04); }
        
        .card-row-1 { display: flex; justify-content: space-between; align-items: center; }
        .card-title { font-weight: 900; font-size: 0.95rem; color: #1E293B; letter-spacing: -0.01em; margin-bottom: 0.25rem; }
        
        .card-badges { display: flex; gap: 0.5rem; }
        .badge-priority { background: #FEFCE8; color: #CA8A04; padding: 0.15rem 0.5rem; border-radius: 6px; font-size: 0.65rem; font-weight: 800; letter-spacing: 0.05em; border: 1px solid #FEF9C3; }
        .badge-status { padding: 0.15rem 0.5rem; border-radius: 6px; font-size: 0.65rem; font-weight: 800; display: flex; align-items: center; gap: 0.3rem; letter-spacing: 0.05em; }
        .badge-status.COMPLETED { background: #ECFDF5; color: #059669; border: 1px solid #D1FAE5; }
        .badge-status.UPCOMING { background: #EEF2FF; color: #4F46E5; border: 1px solid #E0E7FF; }
        .badge-status.PENDING { background: #FFF7ED; color: #D97706; border: 1px solid #FFEDD5; }
        .badge-status.DELAYED { background: #FEF2F2; color: #EF4444; border: 1px solid #FEE2E2; }
        .badge-status.IN_REVIEW { background: #F5F3FF; color: #8B5CF6; border: 1px solid #EDE9FE; }
        .status-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

        .card-row-2 { display: flex; align-items: center; gap: 0.75rem; }
        .card-faculty-group { display: flex; align-items: center; gap: 0.4rem; }
        .avatar-pile { display: flex; }
        .pile-img { width: 20px; height: 20px; border-radius: 50%; border: 1.5px solid white; margin-left: -6px; }
        .pile-img:first-child { margin-left: 0; }
        .faculty-main { font-size: 0.7rem; font-weight: 800; color: #475569; display: flex; align-items: center; gap: 0.25rem; background: #EEF2FF; padding: 0.15rem 0.4rem; border-radius: 5px; color: #4F46E5; }
        .faculty-others { font-size: 0.68rem; font-weight: 600; color: #94A3B8; }
        
        .tag-group { display: flex; gap: 0.4rem; }
        .tag { font-size: 0.6rem; font-weight: 800; padding: 0.15rem 0.4rem; border-radius: 5px; letter-spacing: 0.02em; text-transform: uppercase; }
        .tag.sprint { color: #EF4444; background: #FEF2F2; }
        .tag.category { color: #6366F1; background: #EEF2FF; }

        .dashed-sep { border: none; border-top: 2px dashed #F1F5F9; margin: 0.5rem 0; width: 100%; }

        .card-row-3 { display: flex; justify-content: space-between; align-items: center; margin-top: 0.25rem; }
        .card-deadline { display: flex; align-items: center; gap: 0.4rem; font-weight: 800; color: #1E293B; font-size: 0.82rem; }
        .deadline-icon { color: #EF4444; border: 1.5px solid #FEE2E2; padding: 0.2rem; border-radius: 6px; display: flex; align-items: center; justify-content: center; }
        
        .card-actions { display: flex; gap: 0.5rem; }
        .btn-action { border: none; border-radius: 9px; padding: 0.45rem 1rem; font-size: 0.75rem; font-weight: 800; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 0.4rem; }
        .btn-complete { background: #10B981; color: white; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.15); }
        .btn-initiate { background: #F59E0B; color: white; box-shadow: 0 2px 8px rgba(245, 158, 11, 0.15); }
        .btn-action:hover { transform: translateY(-1px); filter: brightness(1.05); }

        .empty-state { text-align: center; padding: 4rem 2rem; color: #94A3B8; display: flex; flex-direction: column; align-items: center; gap: 1rem; }
        .empty-icon { font-size: 3rem; opacity: 0.5; }

        /* Dark Mode OLED Adjustments */
        body.theme-dark .task-card { background: #121212; border-color: #27272A; }
        body.theme-dark .card-title, body.theme-dark .tasks-title, body.theme-dark .card-deadline { color: #F8FAFC; }
        body.theme-dark .dashed-sep { border-color: #27272A; }
        body.theme-dark .filter-centered { background: #121212; border-color: #27272A; }
        body.theme-dark .faculty-main { background: #1E1B4B; color: #818CF8; }
        body.theme-dark .ai-btn { background: #121212; border-color: #27272A; color: #818CF8; }
      `}</style>

            <div className="tasks-header">
                <h2 className="tasks-title">Task Monitoring Registry</h2>
                <div className="filter-centered">
                    {['All', 'Upcoming', 'Pending', 'Delayed', 'Completed'].map(f => (
                        <button
                            key={f}
                            className={`filter-pill ${filter === f ? 'active' : ''}`}
                            onClick={() => setFilter(f)}
                        >
                            {f}
                        </button>
                    ))}
                </div>
                <button className="ai-btn" title="✨ AI Suggest Assignments">
                    ✨ AI Suggest Assignments
                </button>
            </div>

            <div className="tasks-grid">
                {loading ? (
                  <p style={{ textAlign: 'center', padding: '2rem' }}>Loading registry from database...</p>
                ) : filteredTasks.length > 0 ? (
                  filteredTasks.map(task => (
                    <div className="task-card" key={task.id}>
                        <div className="card-row-1">
                            <div>
                                <div className="card-title">{task.title}</div>

                            </div>
                            <div className="card-badges">
                                <span className="badge-priority">{task.priority}</span>
                                <span className={`badge-status ${task.status}`}>
                                    <div className="status-dot" />
                                    {task.status.replace('_', ' ')}
                                </span>
                            </div>
                        </div>

                        <div className="card-row-2">
                            <div className="card-faculty-group">
                                <div className="avatar-pile">
                                    <img src={getAvatarUrl(task.faculty || task.id)} className="pile-img" alt="P" title={task.faculty} />
                                    {task.colleagues && task.colleagues.length > 0 && (
                                        <img src={getAvatarUrl(task.colleagues[0].email)} className="pile-img" alt="S" title={task.colleagues[0].name || task.colleagues[0].email.split('@')[0]} />
                                    )}
                                </div>
                                <span className="faculty-main">{task.isMe ? '👤 You' : `👤 ${task.faculty}`}</span>
                                {task.colleagues && task.colleagues.length > 0 && (
                                    <span className="faculty-others">& {task.colleagues.length} others</span>
                                )}
                            </div>
                            <div className="tag-group">
                                <span className="tag sprint">{task.sprintName}</span>
                                <span className="tag category">{task.subEvent}</span>
                            </div>
                        </div>

                        <hr className="dashed-sep" />

                        <div className="card-row-3">
                            <div className="card-deadline">
                                <div className="deadline-icon">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                </div>
                                Deadline: {task.deadline}
                            </div>
                            <div className="card-actions">
                                {task.status !== 'COMPLETED' && (
                                    <button 
                                        onClick={() => updateTaskStatus(task.id, 'COMPLETED')}
                                        className="btn-action btn-complete">
                                        Complete Task
                                    </button>
                                )}
                                {task.status === 'PENDING' && (
                                    <button 
                                        onClick={() => updateTaskStatus(task.id, 'IN_PROGRESS')}
                                        className="btn-action btn-initiate">
                                        Initiate Action
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    <div className="empty-icon">📁</div>
                    <p style={{ fontWeight: 800, color: '#1E293B' }}>No tasks found for "{filter}"</p>
                    <p style={{ fontSize: '0.85rem' }}>Select a different filter or check the "All" tab.</p>
                  </div>
                )}
            </div>
        </div>
    );
}
