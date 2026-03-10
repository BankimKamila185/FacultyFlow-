import React, { useState, useEffect } from 'react';
import { API_URL } from '../config';
import { fetchWithAuth, getAvatarUrl } from '../utils/api';

export default function AdminDashboard({ setActiveTab }) {
    const [facultyStats, setFacultyStats] = useState([]);
    const [globalMetrics, setGlobalMetrics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedFaculty, setSelectedFaculty] = useState(null);
    const [facultyTasks, setFacultyTasks] = useState([]);
    const [tasksLoading, setTasksLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [usersRes, metricsRes] = await Promise.all([
                fetchWithAuth(`${API_URL}/users`),
                fetchWithAuth(`${API_URL}/analytics/dashboard-metrics`)
            ]);
            
            const usersData = await usersRes.json();
            const metricsData = await metricsRes.json();
            
            if (usersData.success) {
                setFacultyStats(usersData.data);
            }
            if (metricsData.success) {
                setGlobalMetrics(metricsData.data);
            }
        } catch (err) {
            console.error('Error fetching admin data:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchFacultyTasks = async (email) => {
        setTasksLoading(true);
        try {
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

    const handleNudgeAll = async () => {
        const confirmNudge = window.confirm(`This will send a reminder to all faculty members with overdue tasks. Proceed?`);
        if (!confirmNudge) return;
        
        try {
            const res = await fetchWithAuth(`${API_URL}/tasks/nudge-all`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                alert(data.message);
                fetchData(); // Refresh metrics
            } else {
                alert('Nudge failed: ' + data.message);
            }
        } catch (err) {
            console.error('Error in batch nudge:', err);
            alert('An error occurred during batch nudge.');
        }
    };

    const sortedByCompletion = [...facultyStats].sort((a, b) => {
        const rateA = a.stats?.total > 0 ? (a.stats.completed / a.stats.total) : 0;
        const rateB = b.stats?.total > 0 ? (b.stats.completed / b.stats.total) : 0;
        return rateB - rateA;
    });

    const filteredFaculty = facultyStats.filter(fac => 
        fac.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        fac.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) {
        return <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-dim)' }}>
            <div className="loader" style={{ margin: '0 auto 1rem' }} />
            Initializing Insights...
        </div>;
    }

    return (
        <div className="admin-dashboard-container">
            <style>{`
                .admin-dashboard-container { animation: fadeIn 0.4s ease; display: flex; flex-direction: column; gap: 2.5rem; height: 100%; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                
                .admin-header { display: flex; justify-content: space-between; align-items: center; }
                .admin-header h2 { font-size: 2.4rem; font-weight: 950; letter-spacing: -0.05em; color: var(--text-main); margin-bottom: 0.25rem; }
                .admin-header p { color: var(--text-dim); font-size: 1.15rem; font-weight: 500; }

                /* Global Metric Widgets */
                .metrics-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.5rem; }
                .metric-widget { background: var(--bg-card); border-radius: 28px; padding: 1.75rem; border: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 0.6rem; box-shadow: var(--shadow-sm); transition: transform 0.2s; }
                .metric-widget:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); border-color: var(--primary-light); }
                .metric-val { font-size: 2.5rem; font-weight: 950; color: var(--text-main); line-height: 1; letter-spacing: -0.02em; }
                .metric-lab { font-size: 0.85rem; font-weight: 750; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.08em; }
                .metric-trend { font-size: 0.75rem; font-weight: 800; padding: 0.3rem 0.6rem; border-radius: 8px; width: fit-content; }
                .trend-up { background: rgba(16, 185, 129, 0.1); color: #10B981; }

                /* Dashboard Sections */
                .dashboard-section { display: flex; flex-direction: column; gap: 1.5rem; }
                .section-header { display: flex; justify-content: space-between; align-items: center; }
                .section-title { font-size: 1.4rem; font-weight: 900; color: var(--text-main); letter-spacing: -0.02em; }

                /* Leaderboard Table */
                .leaderboard-card { background: var(--bg-card); border-radius: 28px; border: 1px solid var(--border-color); padding: 1.5rem; box-shadow: var(--shadow-sm); }
                .leader-table { width: 100%; border-collapse: collapse; }
                .leader-table th { text-align: left; padding: 1rem; color: var(--text-dim); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 800; border-bottom: 1px solid var(--border-color); }
                .leader-table td { padding: 1.2rem 1rem; border-bottom: 1px solid var(--border-color); font-weight: 600; }
                .leader-table tr:last-child td { border-bottom: none; }
                .rank-badge { width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 900; }
                .rank-1 { background: #FFD700; color: #000; }
                .rank-2 { background: #C0C0C0; color: #000; }
                .rank-3 { background: #CD7F32; color: #fff; }

                /* Progress Bar */
                .progress-container { width: 100%; height: 8px; background: var(--bg-dark); border-radius: 100px; overflow: hidden; margin-top: 0.5rem; }
                .progress-bar { height: 100%; background: var(--grad-primary); border-radius: 100px; transition: width 0.8s ease-out; }

                /* Faculty Grid */
                .faculty-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.5rem; }
                .fac-card { background: var(--bg-card); border-radius: 24px; padding: 1.75rem; border: 1px solid var(--border-color); cursor: pointer; transition: all 0.2s; display: flex; flex-direction: column; gap: 1.5rem; box-shadow: var(--shadow-sm); position: relative; overflow: hidden; }
                .fac-card:hover { transform: translateY(-4px); border-color: var(--primary); box-shadow: var(--shadow-md); }

                .tasks-view { background: var(--bg-card); border-radius: 36px; padding: 3rem; border: 1px solid var(--border-color); box-shadow: var(--shadow-lg); transition: all 0.3s ease; }
            `}</style>

            <div className="admin-header">
                <div>
                    <h2>Admin Intelligence</h2>
                    <p>Strategic oversight of faculty operations and departmental flow.</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                   <button className="btn-vibrant" onClick={() => setActiveTab('Projects')}>
                        Portfolio View
                    </button>
                </div>
            </div>

            {!selectedFaculty && (
                <div className="metrics-row">
                    <div className="metric-widget">
                        <span className="metric-lab">Faculty Reach</span>
                        <span className="metric-val">{facultyStats.length}</span>
                        <div className="metric-trend trend-up">Active Personnel</div>
                    </div>
                    <div className="metric-widget">
                        <span className="metric-lab">Live Workflows</span>
                        <span className="metric-val">{globalMetrics?.workflows?.active || 0}</span>
                        <div className="metric-trend trend-up" style={{ color: 'var(--primary)', background: 'rgba(99, 102, 241, 0.1)' }}>Deployment Phase</div>
                    </div>
                    <div className="metric-widget">
                        <span className="metric-lab">Compliance Rate</span>
                        <span className="metric-val">
                            {globalMetrics?.tasks?.total > 0 
                                ? Math.round(((globalMetrics.tasks.completed) / globalMetrics.tasks.total) * 100) 
                                : 0}%
                        </span>
                        <div className="metric-trend trend-up">On-Time Pipeline</div>
                    </div>
                    <div className="metric-widget" style={{ borderColor: '#EF4444' }}>
                        <span className="metric-lab" style={{ color: '#EF4444' }}>Instruction Blocks</span>
                        <span className="metric-val" style={{ color: '#EF4444' }}>{globalMetrics?.tasks?.overdue || 0}</span>
                        <div className="metric-trend" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444' }}>Immediate Attention</div>
                    </div>
                </div>
            )}

            {!selectedFaculty ? (
                <>
                    <div className="dashboard-section">
                        <div className="section-header">
                            <h3 className="section-title">Performance Leaderboard</h3>
                        </div>
                        <div className="leaderboard-card">
                            <table className="leader-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '60px' }}>Rank</th>
                                        <th>Faculty Member</th>
                                        <th style={{ width: '200px' }}>Completion Rate</th>
                                        <th style={{ textAlign: 'right' }}>Active Tasks</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedByCompletion.slice(0, 5).map((fac, idx) => {
                                        const rate = fac.stats?.total > 0 ? Math.round((fac.stats.completed / fac.stats.total) * 100) : 0;
                                        return (
                                            <tr key={`leader-${fac.id}`} onClick={() => handleSelectFaculty(fac)} style={{ cursor: 'pointer' }}>
                                                <td>
                                                    <div className={`rank-badge rank-${idx + 1}`}>{idx + 1}</div>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                        <img src={fac.photoUrl || getAvatarUrl(fac.email)} style={{ width: 32, height: 32, borderRadius: 8 }} alt="" />
                                                        <div>
                                                            <div style={{ fontSize: '1rem', color: 'var(--text-main)' }}>{fac.name}</div>
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{fac.department || 'General'}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>
                                                        {rate}%
                                                        <div className="progress-container">
                                                            <div className="progress-bar" style={{ width: `${rate}%` }} />
                                                        </div>
                                                    </div>
                                                </td>
                                                <td style={{ textAlign: 'right', fontSize: '1.1rem', fontWeight: 900 }}>
                                                    {(fac.stats?.pending || 0) + (fac.stats?.inProgress || 0)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="dashboard-section">
                        <div className="section-header">
                            <h3 className="section-title">All Personnel</h3>
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                <div className="search-pill">
                                    <span>🔍</span>
                                    <input 
                                        type="text" 
                                        placeholder="Search by name or email..." 
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                                {globalMetrics?.tasks?.overdue > 0 && (
                                    <button className="btn-nudge" onClick={handleNudgeAll}>
                                        Nudge All Delayed
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="faculty-grid">
                            {filteredFaculty.map(fac => (
                                <div key={fac.id} className="fac-card" onClick={() => handleSelectFaculty(fac)}>
                                    <div className="fac-top">
                                        <img src={fac.photoUrl || getAvatarUrl(fac.email)} alt={fac.name} className="fac-avatar" />
                                        <div className="fac-info">
                                            <div className="fac-name">{fac.name}</div>
                                            <div className="fac-email">{fac.email}</div>
                                        </div>
                                        <div style={{ color: 'var(--text-muted)' }}>
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                                        </div>
                                    </div>
                                    <div className="fac-stats">
                                        <div className="stat-pill success">
                                            <span className="stat-num">{fac.stats?.completed || 0}</span>
                                            <span className="stat-label">Resolved</span>
                                        </div>
                                        <div className="stat-pill warning">
                                            <span className="stat-num">{(fac.stats?.pending || 0) + (fac.stats?.inProgress || 0)}</span>
                                            <span className="stat-label">In-Flight</span>
                                        </div>
                                        <div className="stat-pill danger">
                                            <span className="stat-num">{fac.stats?.overdue || 0}</span>
                                            <span className="stat-label">Critical</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {filteredFaculty.length === 0 && (
                            <div style={{ padding: '5rem', textAlign: 'center', color: 'var(--text-dim)', background: 'var(--bg-card)', borderRadius: '32px', border: '1px dashed var(--border-color)' }}>
                                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🕵️‍♂️</div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text-main)' }}>No matching personnel found</div>
                                <div style={{ fontSize: '1rem' }}>Try adjusting your search parameters.</div>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <div className="tasks-view">
                    <div className="tasks-header">
                        <div className="fac-top" style={{ gap: '1.75rem' }}>
                            <img src={selectedFaculty.photoUrl || getAvatarUrl(selectedFaculty.email)} alt={selectedFaculty.name} className="fac-avatar" style={{width: 72, height: 72, borderRadius: '20px'}} />
                            <div>
                                <h3 style={{ fontSize: '2rem', fontWeight: 950, color: 'var(--text-main)', margin: 0, letterSpacing: '-0.03em' }}>{selectedFaculty.name}</h3>
                                <p style={{ color: 'var(--text-dim)', margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Analyzing {facultyTasks.length} active engagements</p>
                            </div>
                        </div>
                        <button className="btn-close" onClick={() => setSelectedFaculty(null)} style={{ padding: '0.8rem 1.75rem', borderRadius: '14px' }}>Return to Fleet</button>
                    </div>

                    {tasksLoading ? (
                        <div style={{ textAlign: 'center', padding: '6rem', color: 'var(--text-dim)' }}>
                            <div className="loader" style={{ margin: '0 auto 2rem' }} />
                            Retrieving specific task payloads...
                        </div>
                    ) : (
                        <div className="task-list">
                            {facultyTasks.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--text-dim)', background: 'var(--bg-dark)', borderRadius: '28px' }}>
                                    No active tasks identified for this personnel.
                                </div>
                            )}
                            {facultyTasks.map(task => (
                                <div key={task.id} className={`task-row ${task.status === 'OVERDUE' ? 'overdue' : ''}`}>
                                    <div className="task-info">
                                        <div className="t-title">{task.title}</div>
                                        <div className="t-meta" style={{ display: 'flex', gap: '1.5rem', marginTop: '0.75rem', fontSize: '0.9rem' }}>
                                            <span className={`t-status ${task.status}`} style={{
                                                background: task.status === 'COMPLETED' ? 'rgba(16, 185, 129, 0.12)' : task.status === 'OVERDUE' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                                                color: task.status === 'COMPLETED' ? '#10B981' : task.status === 'OVERDUE' ? '#EF4444' : '#F59E0B'
                                            }}>
                                                {task.status.replace('_', ' ')}
                                            </span>
                                            <span style={{ color: 'var(--text-dim)', fontWeight: 600 }}>📅 Deadline: {task.deadline ? new Date(task.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Flexible'}</span>
                                            {task.sprintName && <span style={{ color: 'var(--primary)', fontWeight: 750 }}>🚀 {task.sprintName}</span>}
                                        </div>
                                    </div>
                                    <div className="task-actions" style={{ display: 'flex', gap: '1rem' }}>
                                        {task.status === 'OVERDUE' && (
                                            <button className="btn-ask" onClick={() => handleAskReason(task.id)} style={{ padding: '0.7rem 1.25rem', fontSize: '0.85rem' }}>
                                                Request Context
                                            </button>
                                        )}
                                        <button className="btn-vibrant-sm" onClick={() => alert('Detailed review layer coming soon...')} style={{ padding: '0.7rem 1.25rem' }}>
                                            Full Review
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


