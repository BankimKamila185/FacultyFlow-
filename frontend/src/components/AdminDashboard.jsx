import React, { useState, useEffect } from 'react';
import { API_URL } from '../config';
import { fetchWithAuth, getAvatarUrl } from '../utils/api';

export default function AdminDashboard({ setActiveTab }) {
    const [facultyStats, setFacultyStats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedFaculty, setSelectedFaculty] = useState(null);
    const [facultyTasks, setFacultyTasks] = useState([]);
    const [tasksLoading, setTasksLoading] = useState(false);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const res = await fetchWithAuth(`${API_URL}/users`);
            const data = await res.json();
            if (data.success) {
                setFacultyStats(data.data);
            }
        } catch (err) {
            console.error('Error fetching faculty stats:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchFacultyTasks = async (email) => {
        setTasksLoading(true);
        try {
            // Note: The existing /api/users/profile/:email endpoint provides total details and tasks
            const res = await fetchWithAuth(`${API_URL}/users/profile/${encodeURIComponent(email)}`);
            const data = await res.json();
            if (data.success) {
                setFacultyTasks(data.profile.allTasks);
            }
        } catch (err) {
            console.error('Error fetching faculty tasks:', err);
        } finally {
            setTasksLoading(false);
        }
    };

    const handleSelectFaculty = (faculty) => {
        setSelectedFaculty(faculty);
        fetchFacultyTasks(faculty.email);
    };

    const handleAskReason = async (taskId) => {
        try {
            const res = await fetchWithAuth(`${API_URL}/tasks/${taskId}/ask-reason`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                alert('Reason requested successfully! The faculty member has been notified.');
            } else {
                alert('Failed to request reason: ' + data.message);
            }
        } catch (err) {
            console.error('Error asking reason:', err);
            alert('An error occurred.');
        }
    };

    if (loading) {
        return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-dim)' }}>Loading Admin Dashboard...</div>;
    }

    return (
        <div className="admin-dashboard-container">
            <style>{`
                .admin-dashboard-container { animation: fadeIn 0.4s ease; display: flex; flex-direction: column; gap: 2rem; height: 100%; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                
                .admin-header { display: flex; justify-content: space-between; align-items: flex-end; }
                .admin-header h2 { font-size: 2rem; font-weight: 900; letter-spacing: -0.03em; color: var(--text-main); margin-bottom: 0.25rem; }
                .admin-header p { color: var(--text-dim); font-size: 1rem; font-weight: 500; }

                /* Faculty Grid */
                .faculty-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.5rem; }
                .fac-card { background: var(--bg-card); border-radius: 20px; padding: 1.5rem; border: 1px solid var(--border-color); cursor: pointer; transition: all 0.2s; display: flex; flex-direction: column; gap: 1.25rem; box-shadow: var(--shadow-sm); }
                .fac-card:hover { transform: translateY(-4px); border-color: var(--primary); box-shadow: var(--shadow); }
                .fac-card.selected { border-color: var(--primary); background: rgba(99, 102, 241, 0.03); }

                .fac-top { display: flex; align-items: center; gap: 1rem; }
                .fac-avatar { width: 50px; height: 50px; border-radius: 12px; object-fit: cover; }
                .fac-info { flex: 1; }
                .fac-name { font-weight: 800; color: var(--text-main); font-size: 1.1rem; }
                .fac-email { font-size: 0.8rem; color: var(--text-dim); }

                .fac-stats { display: flex; gap: 0.5rem; }
                .stat-pill { flex: 1; padding: 0.5rem; border-radius: 10px; text-align: center; }
                .stat-pill.success { background: rgba(16, 185, 129, 0.1); color: #10B981; }
                .stat-pill.warning { background: rgba(245, 158, 11, 0.1); color: #F59E0B; }
                .stat-pill.danger { background: rgba(239, 68, 68, 0.1); color: #EF4444; }
                .stat-num { font-size: 1.2rem; font-weight: 900; display: block; }
                .stat-label { font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }

                /* Task Details View */
                .tasks-view { background: var(--bg-card); border-radius: 24px; padding: 2rem; border: 1px solid var(--border-color); box-shadow: var(--shadow-md); margin-top: 1rem; }
                .tasks-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border-color); }
                .btn-close { background: var(--bg-dark); color: var(--text-main); border: 1px solid var(--border-color); padding: 0.5rem 1rem; border-radius: 8px; font-weight: 700; cursor: pointer; }
                
                .task-list { display: flex; flex-direction: column; gap: 1rem; }
                .task-row { display: flex; justify-content: space-between; align-items: center; padding: 1.25rem; border-radius: 16px; background: var(--bg-dark); border: 1px solid var(--border-color); }
                .task-row.overdue { border-color: #EF4444; background: rgba(239, 68, 68, 0.02); }
                
                .task-info { display: flex; flex-direction: column; gap: 0.4rem; flex: 1; }
                .t-title { font-weight: 800; color: var(--text-main); font-size: 1.05rem; }
                .t-meta { display: flex; gap: 1rem; align-items: center; font-size: 0.8rem; color: var(--text-dim); font-weight: 600; }
                .t-status { padding: 0.2rem 0.6rem; border-radius: 6px; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; }
                .t-status.COMPLETED { background: rgba(16, 185, 129, 0.1); color: #10B981; }
                .t-status.OVERDUE { background: rgba(239, 68, 68, 0.1); color: #EF4444; }
                .t-status.PENDING, .t-status.IN_PROGRESS { background: rgba(245, 158, 11, 0.1); color: #F59E0B; }

                .task-actions { display: flex; gap: 0.75rem; }
                .btn-ask { background: #EF4444; color: white; border: none; padding: 0.6rem 1rem; border-radius: 8px; font-weight: 700; font-size: 0.8rem; cursor: pointer; transition: transform 0.2s; box-shadow: 0 4px 10px rgba(239, 68, 68, 0.2); }
                .btn-ask:hover { transform: translateY(-2px); }
                .btn-edit { background: var(--primary); color: white; border: none; padding: 0.6rem 1rem; border-radius: 8px; font-weight: 700; font-size: 0.8rem; cursor: pointer; transition: transform 0.2s; box-shadow: 0 4px 10px rgba(99, 102, 241, 0.2); }
                .btn-edit:hover { transform: translateY(-2px); }
            `}</style>

            <div className="admin-header">
                <div>
                    <h2>Admin Overview</h2>
                    <p>Monitor faculty task loads, completion rates, and delays.</p>
                </div>
                <button className="btn-vibrant" onClick={() => setActiveTab('Projects')}>
                    View All Workflows (Kanban)
                </button>
            </div>

            {!selectedFaculty ? (
                <div className="faculty-grid">
                    {facultyStats.map(fac => (
                        <div key={fac.id} className="fac-card" onClick={() => handleSelectFaculty(fac)}>
                            <div className="fac-top">
                                <img src={fac.photoUrl || getAvatarUrl(fac.email)} alt={fac.name} className="fac-avatar" />
                                <div className="fac-info">
                                    <div className="fac-name">{fac.name}</div>
                                    <div className="fac-email">{fac.email}</div>
                                </div>
                                <div style={{ color: 'var(--text-muted)' }}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                                </div>
                            </div>
                            <div className="fac-stats">
                                <div className="stat-pill success">
                                    <span className="stat-num">{fac.stats?.completed || 0}</span>
                                    <span className="stat-label">Done</span>
                                </div>
                                <div className="stat-pill warning">
                                    <span className="stat-num">{(fac.stats?.pending || 0) + (fac.stats?.inProgress || 0)}</span>
                                    <span className="stat-label">Active</span>
                                </div>
                                <div className="stat-pill danger">
                                    <span className="stat-num">{fac.stats?.overdue || 0}</span>
                                    <span className="stat-label">Delayed</span>
                                </div>
                            </div>
                        </div>
                    ))}
                    {facultyStats.length === 0 && (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-dim)', gridColumn: '1/-1' }}>No faculty data available.</div>
                    )}
                </div>
            ) : (
                <div className="tasks-view">
                    <div className="tasks-header">
                        <div className="fac-top" style={{ gap: '1.5rem' }}>
                            <img src={selectedFaculty.photoUrl || getAvatarUrl(selectedFaculty.email)} alt={selectedFaculty.name} className="fac-avatar" style={{width: 60, height: 60}} />
                            <div>
                                <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-main)', margin: 0 }}>{selectedFaculty.name}'s Tasks</h3>
                                <p style={{ color: 'var(--text-dim)', margin: 0 }}>Reviewing {facultyTasks.length} assigned tasks</p>
                            </div>
                        </div>
                        <button className="btn-close" onClick={() => setSelectedFaculty(null)}>Back to Overview</button>
                    </div>

                    {tasksLoading ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)' }}>Loading specific tasks...</div>
                    ) : (
                        <div className="task-list">
                            {facultyTasks.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-dim)' }}>No tasks assigned to this faculty.</div>
                            )}
                            {facultyTasks.map(task => (
                                <div key={task.id} className={`task-row ${task.status === 'OVERDUE' ? 'overdue' : ''}`}>
                                    <div className="task-info">
                                        <div className="t-title">{task.title}</div>
                                        <div className="t-meta">
                                            <span className={`t-status ${task.status}`}>{task.status.replace('_', ' ')}</span>
                                            <span>Deadline: {task.deadline ? new Date(task.deadline).toLocaleDateString() : 'None'}</span>
                                            {task.sprintName && <span>Sprint: {task.sprintName}</span>}
                                        </div>
                                    </div>
                                    <div className="task-actions">
                                        {task.status === 'OVERDUE' && (
                                            <button className="btn-ask" onClick={() => handleAskReason(task.id)}>
                                                Ask Reason
                                            </button>
                                        )}
                                        <button className="btn-edit" onClick={() => alert('Edit task functionality coming soon...')}>
                                            Edit/Review
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
