import React, { useState, useEffect } from 'react';
import { API_URL } from '../config';
import { fetchWithAuth, getAvatarUrl } from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function AdminDashboard() {
    const [departments, setDepartments] = useState([]);
    const [facultyStats, setFacultyStats] = useState([]);
    const [loading, setLoading] = useState(false);
    const [tasksLoading, setTasksLoading] = useState(false);
    const [selectedFaculty, setSelectedFaculty] = useState(null);
    const [facultyTasks, setFacultyTasks] = useState([]);
    const [selectedDept, setSelectedDept] = useState(null);
    const [activeModalTab, setActiveModalTab] = useState('tasks');
    const [allTasks, setAllTasks] = useState([]);
    const [previewRecords, setPreviewRecords] = useState(null);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const { currentUser } = useAuth();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [usersRes, tasksRes] = await Promise.all([
                fetchWithAuth(`${API_URL}/users`),
                fetchWithAuth(`${API_URL}/tasks`),
            ]);

            const usersData = await usersRes.json();
            const tasksData = await tasksRes.json();

            if (usersData.success) {
                setFacultyStats(usersData.data);
            }
            if (tasksData.success) {
                setAllTasks(tasksData.data);
            }

            // Fetch departments
            const deptRes = await fetchWithAuth(`${API_URL}/departments`);
            const deptData = await deptRes.json();
            if (deptData.success) {
                setDepartments(deptData.data.map(d => d.name));
            } else {
                // Fallback to existing unique departments from stats if API fails
                const uniqueDepts = Array.from(new Set(usersData.data.map(u => u.department).filter(Boolean)));
                setDepartments(uniqueDepts);
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

    const handleSync = async (isCommit = false) => {
        // setIsSyncing(true); // Removed as isSyncing is unused
        try {
            const res = await fetchWithAuth(`${API_URL}/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ preview: !isCommit })
            });
            const data = await res.json();
            if (data.success) {
                if (!isCommit) {
                    setPreviewRecords(data.data);
                    setShowPreviewModal(true);
                } else {
                    alert('Database synchronization complete!');
                    setPreviewRecords(null);
                    setShowPreviewModal(false);
                    fetchData();
                }
            } else {
                alert('Sync failed: ' + data.message);
            }
        } catch (err) {
            console.error('Sync error:', err);
            alert('A network error occurred during sync.');
        } finally {
            // setIsSyncing(false); // Removed as isSyncing is unused
        }
    };

    const departmentData = departments
        .filter(dept => true) // Filter removed, now always true
        .map(dept => {
            const matchingFaculty = facultyStats.filter(f => {
                if (!f.department) return dept === 'Faculty' || dept === 'Other';
                const fDepts = f.department.split('+').map(d => d.trim().toLowerCase());
                const targetDept = dept.toLowerCase();
                return fDepts.includes(targetDept) || (dept === 'Faculty' && fDepts.length === 0);
            });

            const deptFacultyEmails = matchingFaculty.map(f => f.email);
            const deptTasks = allTasks.filter(task => {
                const assignedEmail = task.assignedTo?.email;
                const reps = task.responsibles?.map(r => r.email) || [];
                const allRelatedEmails = [assignedEmail, ...reps].filter(Boolean);
                return allRelatedEmails.some(email => deptFacultyEmails.includes(email));
            });

            // Make sure we have a unique list of tasks by ID
            const uniqueDeptTasksMap = new Map();
            deptTasks.forEach(t => uniqueDeptTasksMap.set(t.id, t));
            const uniqueDeptTasks = Array.from(uniqueDeptTasksMap.values());

            const accurateStats = uniqueDeptTasks.reduce((acc, task) => {
                acc.total += 1;
                if (task.status === 'COMPLETED') acc.completed += 1;
                else if (task.status === 'PENDING') acc.pending += 1;
                else if (task.status === 'OVERDUE') acc.overdue += 1;
                else if (task.status === 'IN_PROGRESS' || task.status === 'IN_REVIEW') acc.inProgress += 1;
                return acc;
            }, { total: 0, completed: 0, pending: 0, overdue: 0, inProgress: 0 });

            // Use matchingFaculty's stats only for workload sum
            const totalWorkloadDays = matchingFaculty.reduce((sum, f) => {
                return sum + (f.stats?.workloadDays || 0);
            }, 0);

            return {
                name: dept,
                facultyCount: matchingFaculty.length,
                stats: { ...accurateStats, workloadDays: totalWorkloadDays },
                completionRate: accurateStats.total > 0 ? Math.round((accurateStats.completed / accurateStats.total) * 100) : 0,
                faculty: matchingFaculty,
                tasks: uniqueDeptTasks
            };
        });

    if (loading) {
        return <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-dim)' }}>
            <div className="loader" style={{ margin: '0 auto 1rem' }} />
            Initializing Insights...
        </div>;
    }

    return (
        <div className="admin-dashboard-container">
            <style>{`
                .admin-dashboard-container { animation: fadeIn 0.4s ease; display: flex; flex-direction: column; gap: 1rem; height: 100%; padding-top: 1rem; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                
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
                
                .btn-sync { background: #10B981; color: white; border: none; padding: 0.8rem 1.5rem; border-radius: 14px; font-weight: 800; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.2); }
                .btn-sync:hover { filter: brightness(1.1); transform: translateY(-1px); }
                .btn-sync.loading { background: var(--text-dim); cursor: wait; transform: none; box-shadow: none; animation: pulse 1.5s infinite; }
                @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.7; } 100% { opacity: 1; } }

                .btn-secondary { background: var(--bg-card); color: var(--text-main); border: 1px solid var(--border-color); padding: 0.8rem 1.5rem; border-radius: 14px; font-weight: 700; cursor: pointer; }
                .btn-secondary:hover { background: var(--bg-dark); border-color: var(--text-dim); }

                .mini-stat { border-left: 1px solid var(--border-color); padding-left: 1.5rem; display: flex; flex-direction: column; justify-content: center; }
                .mini-val { font-size: 1.5rem; font-weight: 950; color: var(--text-main); line-height: 1; }
                .mini-lab { font-size: 0.7rem; font-weight: 800; color: var(--text-dim); text-transform: uppercase; margin-top: 0.2rem; }

                /* Department Grid */
                .dept-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem; }
                .dept-card { background: var(--bg-card); border-radius: 20px; padding: 1.5rem; border: 1px solid var(--border-color); cursor: pointer; transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); display: flex; flex-direction: column; gap: 1rem; position: relative; overflow: hidden; }
                .dept-card:hover { transform: translateY(-5px); border-color: var(--primary); box-shadow: var(--shadow-md); }
                .dept-name { font-size: 1.1rem; font-weight: 900; color: var(--text-main); letter-spacing: -0.02em; }
                .dept-meta { font-size: 0.8rem; color: var(--text-dim); font-weight: 600; }
                .dept-progress-info { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 0.5rem; }
                .dept-rate { font-size: 1.4rem; font-weight: 950; color: var(--primary); }
                
                /* Modal */
                .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 2000; animation: fadeIn 0.3s ease; }
                .modal-content { background: var(--bg-surface); width: 90%; max-width: 650px; border-radius: 32px; border: 1px solid var(--border-color); padding: 2.5rem; box-shadow: var(--shadow-lg); animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1); position: relative; max-height: 90vh; overflow-y: auto; }
                @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                
                .stat-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin: 1.5rem 0; }
                .stat-box { padding: 1.25rem; border-radius: 16px; background: var(--bg-card); border: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 0.4rem; }
                .stat-box.completed { border-left: 4px solid #10B981; }
                .stat-box.pending { border-left: 4px solid #F59E0B; }
                .stat-box.overdue { border-left: 4px solid #EF4444; }
                .stat-box.progress { border-left: 4px solid var(--primary); }
                .stat-label { font-size: 0.75rem; font-weight: 800; color: var(--text-dim); text-transform: uppercase; }
                .stat-value { font-size: 1.75rem; font-weight: 950; color: var(--text-main); }

                /* Filter Bar Styles */
                .filter-bar { display: flex; align-items: center; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 16px; padding: 0.4rem; gap: 0.5rem; margin-bottom: 2rem; width: fit-content; box-shadow: var(--shadow-sm); }
                .filter-item { padding: 0.6rem 1.2rem; border-radius: 12px; font-weight: 750; font-size: 0.9rem; cursor: pointer; transition: all 0.2s; color: var(--text-dim); border: none; background: transparent; display: flex; align-items: center; gap: 0.5rem; white-space: nowrap; }
                .filter-item:hover { color: var(--text-main); background: var(--bg-dark); }
                .filter-item.active { background: #E0E7FF; color: #4F46E5; }
                .body.theme-dark .filter-item.active { background: #312E81; color: #C7D2FE; }
                .filter-sep { width: 1px; height: 20px; background: var(--border-color); margin: 0 0.25rem; }
                
                .dept-dropdown { position: relative; }
                .dept-select-trigger { border: none; background: transparent; color: var(--text-dim); font-weight: 750; display: flex; align-items: center; gap: 0.4rem; padding: 0.6rem 1.2rem; cursor: pointer; font-family: inherit; }
                .dept-select-trigger:hover { color: var(--text-main); }
                .dept-select-trigger.active { color: var(--primary); }

                /* Department Card Enhancements */
                .dept-status-row { display: flex; align-items: center; gap: 0.75rem; margin-top: 0.5rem; }
                .status-indicator-pill { display: flex; align-items: center; gap: 0.4rem; padding: 0.25rem 0.6rem; border-radius: 100px; background: var(--bg-dark); border: 1px solid var(--border-color); }
                .status-indicator-pill .dot { width: 6px; height: 6px; border-radius: 50%; }
                .status-indicator-pill .count { font-size: 0.8rem; font-weight: 800; color: var(--text-main); }
                
                .status-indicator-pill.green .dot { background: #10B981; box-shadow: 0 0 8px rgba(16, 185, 129, 0.4); }
                .status-indicator-pill.orange .dot { background: #F59E0B; box-shadow: 0 0 8px rgba(245, 158, 11, 0.4); }
                .status-indicator-pill.red .dot { background: #EF4444; box-shadow: 0 0 8px rgba(239, 68, 68, 0.4); }
                .total-tasks-badge { font-size: 0.75rem; font-weight: 700; color: var(--text-dim); background: var(--bg-dark); padding: 0.2rem 0.5rem; border-radius: 6px; }
                /* Header Redesign */
                .admin-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
                .admin-header-title { font-size: 1.8rem; font-weight: 800; color: #1e293b; letter-spacing: -0.02em; }
                .admin-header-actions { display: flex; gap: 0.75rem; }
                .header-circle-btn { width: 44px; height: 44px; border-radius: 50%; background: #f1f5f9; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background 0.2s; color: #64748b; }
                .header-circle-btn:hover { background: #e2e8f0; color: #1e293b; }

                /* Department Grid & Cards */
                .dept-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1.5rem; }
                .dept-card { background: #ffffff; border-radius: 24px; padding: 1.5rem; border: 1px solid #f1f5f9; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); display: flex; flex-direction: column; gap: 1.25rem; box-shadow: 0 4px 20px rgba(0,0,0,0.03); position: relative; }
                .dept-card:hover { transform: translateY(-6px); box-shadow: 0 12px 30px rgba(0,0,0,0.08); border-color: #e2e8f0; }
                
                .dept-card-top { display: flex; justify-content: space-between; align-items: flex-start; }
                .dept-card-name { font-size: 1rem; font-weight: 700; color: #334155; line-height: 1.3; max-width: 80%; }
                .dept-card-arrow { width: 32px; height: 32px; border-radius: 50%; border: 1px solid #f1f5f9; display: flex; align-items: center; justify-content: center; color: #94a3b8; transition: all 0.2s; }
                .dept-card:hover .dept-card-arrow { border-color: #6366f1; color: #6366f1; background: #f5f3ff; }

                .dept-card-percentage { font-size: 3.5rem; font-weight: 800; color: #0f172a; margin: 0.5rem 0; letter-spacing: -0.05em; line-height: 1; }
                
                .dept-card-status-line { font-size: 0.75rem; font-weight: 800; letter-spacing: 0.05em; display: flex; align-items: center; gap: 0.5rem; }
                .status-on-track { color: #10b981; }
                .status-review { color: #f59e0b; }
                .status-critical { color: #ef4444; }

                .dept-card-footer { margin-top: auto; padding-top: 1rem; border-top: 1px solid #f8fafc; font-size: 0.8rem; color: #94a3b8; font-weight: 600; }
                .dept-card-workload { color: #334155; font-weight: 700; }

                /* Tasks View & List Improvements */
                .tasks-view { background: #ffffff; border-radius: 32px; padding: 2.5rem; border: 1px solid #f1f5f9; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
                .task-row { background: #f8fafc; border: 1px solid #f1f5f9; transition: all 0.2s; }
                .task-row:hover { background: #ffffff; border-color: #6366f1; transform: scale(1.01); }

                .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15, 23, 42, 0.4); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 2000; animation: fadeIn 0.3s ease; }
                .modal-content { background: #ffffff; width: 95%; max-width: 600px; border-radius: 28px; padding: 2rem; box-shadow: 0 20px 50px rgba(0,0,0,0.1); border: 1px solid #f1f5f9; }

                .stat-box { padding: 1rem; border-radius: 16px; background: #f8fafc; border: 1px solid #f1f5f9; }
                .stat-box.completed { border-left: 4px solid #10b981; }
                .stat-box.overdue { border-left: 4px solid #ef4444; }
                
                .search-item:hover { background: #f1f5f9; }
            `}</style>

            <div className="dashboard-section">
                {!selectedFaculty ? (
                    <>
                        <div className="admin-header">
                            <h2 className="admin-header-title">Analytics</h2>
                            <div className="admin-header-actions">
                                <button className="header-circle-btn" onClick={() => handleSync(false)} title="Sync Preview">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                                </button>
                                <button className="header-circle-btn" onClick={() => fetchData()} title="Refresh Data">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"></path><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                                </button>
                            </div>
                        </div>
                        
                        <div className="dept-grid">
                            {departmentData.map(dept => {
                                const status = dept.completionRate >= 80 ? 'ON TRACK' : dept.completionRate >= 50 ? 'REVIEW NEEDED' : 'CRITICAL';
                                const statusClass = status === 'ON TRACK' ? 'status-on-track' : status === 'REVIEW NEEDED' ? 'status-review' : 'status-critical';
                                // Mock workload based on total tasks for visual fidelity
                                const workloadHrs = dept.stats.workloadDays.toLocaleString();

                                return (
                                    <div key={dept.name} className="dept-card" onClick={() => setSelectedDept(dept)}>
                                        <div className="dept-card-top">
                                            <div className="dept-card-name">{dept.name}</div>
                                            <div className="dept-card-arrow">
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>
                                            </div>
                                        </div>

                                        <div className="dept-card-percentage">{dept.completionRate}%</div>

                                        <div className={`dept-card-status-line ${statusClass}`}>
                                            {status} • {dept.facultyCount} FACULTY
                                        </div>

                                        <div className="dept-card-footer">
                                            Workload: <span className="dept-card-workload">{workloadHrs} days</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                ) : (
                    <div className="tasks-view" style={{ animation: 'fadeIn 0.3s ease' }}>
                        <div className="tasks-header" style={{ position: 'relative', marginBottom: '3rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '2rem' }}>
                            <div className="fac-top" style={{ gap: '2rem', display: 'flex', alignItems: 'center' }}>
                                <img src={selectedFaculty.photoUrl || getAvatarUrl(selectedFaculty.email)} alt={selectedFaculty.name} className="fac-avatar" style={{ width: 90, height: 90, borderRadius: '28px', border: '3px solid #fff', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                                <div style={{ flex: 1 }}>
                                    <h3 style={{ fontSize: '2.5rem', fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: '-0.04em' }}>{selectedFaculty.name}</h3>
                                    <p style={{ color: '#64748b', margin: '0.4rem 0', fontSize: '1.2rem', fontWeight: 500 }}>{selectedFaculty.email}</p>
                                </div>
                            </div>
                            <button className="header-circle-btn" onClick={() => setSelectedFaculty(null)} style={{ position: 'absolute', top: '0', right: '0' }} title="Return to Fleet">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>

                        {tasksLoading ? (
                            <div style={{ textAlign: 'center', padding: '6rem' }}>
                                <div className="loader" style={{ margin: '0 auto 1.5rem' }} />
                                Loading individual payloads...
                            </div>
                        ) : (
                            <div className="task-list">
                                {facultyTasks.length === 0 && <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-dim)' }}>No active tasks found.</div>}
                                {facultyTasks.map(task => (
                                    <div key={task.id} className={`task-row ${task.status === 'OVERDUE' ? 'overdue' : ''}`} style={{ background: 'var(--bg-card)', padding: '1.25rem', borderRadius: '16px', border: '1px solid var(--border-color)', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>{task.title}</div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginTop: '0.5rem' }}>Deadline: {task.deadline ? new Date(task.deadline).toLocaleDateString() : 'None'}</div>
                                        </div>
                                        <span style={{ 
                                            padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 800,
                                            background: task.status === 'COMPLETED' ? 'rgba(16, 185, 129, 0.1)' : task.status === 'OVERDUE' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                            color: task.status === 'COMPLETED' ? '#10B981' : task.status === 'OVERDUE' ? '#EF4444' : '#F59E0B'
                                         }}>
                                            {task.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modals */}
            {selectedDept && (
                <div className="modal-overlay" onClick={() => setSelectedDept(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <h3 style={{ fontSize: '2rem', fontWeight: 950, color: 'var(--text-main)', margin: 0 }}>{selectedDept.name}</h3>
                                <p style={{ color: 'var(--text-dim)', margin: '0.2rem 0' }}>Performance Breakdown</p>
                            </div>
                            <button className="btn-close" onClick={() => setSelectedDept(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '1.5rem' }}>&times;</button>
                        </div>

                        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                            <div className="stat-box" style={{ borderLeft: '4px solid #64748b' }}>
                                <span className="stat-label" style={{ textTransform: 'uppercase' }}>Total Task</span>
                                <span className="stat-value">{selectedDept.stats.total}</span>
                            </div>
                            <div className="stat-box completed">
                                <span className="stat-label" style={{ textTransform: 'uppercase' }}>Complete</span>
                                <span className="stat-value">{selectedDept.stats.completed}</span>
                            </div>
                            <div className="stat-box" style={{ borderLeft: '4px solid #f59e0b', background: 'var(--bg-card)' }}>
                                <span className="stat-label" style={{ textTransform: 'uppercase' }}>Pending</span>
                                <span className="stat-value">{selectedDept.stats.pending}</span>
                            </div>
                        </div>

                        <div style={{ marginTop: '1.5rem' }}>
                            <div style={{ display: 'flex', borderBottom: '2px solid #f1f5f9', marginBottom: '1.5rem', gap: '1rem' }}>
                                <button
                                    onClick={() => setActiveModalTab('tasks')}
                                    style={{ 
                                        background: 'transparent', border: 'none', 
                                        borderBottom: activeModalTab === 'tasks' ? '3px solid #6366f1' : '3px solid transparent', 
                                        padding: '0.75rem 0.5rem', cursor: 'pointer', 
                                        fontWeight: activeModalTab === 'tasks' ? 800 : 600, 
                                        color: activeModalTab === 'tasks' ? '#0f172a' : '#64748b',
                                        fontSize: '0.95rem', transition: 'all 0.2s', marginBottom: '-2px'
                                    }}
                                >
                                    Active Tasks
                                </button>
                                <button
                                    onClick={() => setActiveModalTab('personnel')}
                                    style={{ 
                                        background: 'transparent', border: 'none', 
                                        borderBottom: activeModalTab === 'personnel' ? '3px solid #6366f1' : '3px solid transparent', 
                                        padding: '0.75rem 0.5rem', cursor: 'pointer', 
                                        fontWeight: activeModalTab === 'personnel' ? 800 : 600, 
                                        color: activeModalTab === 'personnel' ? '#0f172a' : '#64748b',
                                        fontSize: '0.95rem', transition: 'all 0.2s', marginBottom: '-2px'
                                    }}
                                >
                                    Faculty Personnel
                                </button>
                            </div>
                            
                            {/* Tasks List View */}
                            {activeModalTab === 'tasks' && (
                            <div style={{ maxHeight: '380px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                                {selectedDept.tasks && selectedDept.tasks.length === 0 && (
                                    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-dim)', background: 'var(--bg-card)', borderRadius: '16px', border: '1px dashed var(--border-color)' }}>
                                        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📝</div>
                                        <div style={{ fontWeight: 600 }}>No active tasks for this department.</div>
                                    </div>
                                )}
                                {selectedDept.tasks && selectedDept.tasks.map(task => (
                                    <div key={task.id} style={{ 
                                        padding: '1.25rem', borderRadius: '16px', background: '#ffffff', 
                                        border: '1px solid #f1f5f9', marginBottom: '0.75rem', 
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        boxShadow: '0 2px 10px rgba(0,0,0,0.02)', transition: 'all 0.2s ease',
                                        cursor: 'default'
                                    }}
                                    className="task-modal-card"
                                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.05)'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#f1f5f9'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.02)'; }}
                                    >
                                        <div style={{ paddingRight: '1rem' }}>
                                            <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '1.05rem', lineHeight: '1.3', marginBottom: '0.3rem' }}>{task.title}</div>
                                            <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                {task.assignedTo?.name ? (
                                                    <>
                                                        <span style={{ display: 'inline-block', width: '20px', height: '20px', borderRadius: '50%', background: '#e2e8f0', color: '#475569', textAlign: 'center', lineHeight: '20px', fontSize: '0.6rem' }}>
                                                            {task.assignedTo.name.charAt(0).toUpperCase()}
                                                        </span>
                                                        {task.assignedTo.name}
                                                    </>
                                                ) : `Deadline: ${task.deadline ? new Date(task.deadline).toLocaleDateString() : 'None'}`}
                                            </div>
                                        </div>
                                        <span style={{ 
                                            padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800, whiteSpace: 'nowrap', letterSpacing: '0.03em', height: 'fit-content',
                                            background: task.status === 'COMPLETED' ? '#ecfdf5' : task.status === 'OVERDUE' ? '#fef2f2' : task.status === 'IN_REVIEW' ? '#eff6ff' : '#fffbeb',
                                            color: task.status === 'COMPLETED' ? '#059669' : task.status === 'OVERDUE' ? '#dc2626' : task.status === 'IN_REVIEW' ? '#2563eb' : '#d97706',
                                            border: `1px solid ${task.status === 'COMPLETED' ? '#a7f3d0' : task.status === 'OVERDUE' ? '#fecaca' : task.status === 'IN_REVIEW' ? '#bfdbfe' : '#fde68a'}`
                                         }}>
                                            {task.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            )}

                            {/* Personnel View */}
                            {activeModalTab === 'personnel' && (
                            <div style={{ maxHeight: '380px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                                {selectedDept.faculty.map(fac => (
                                    <div key={fac.id} className="search-item" style={{ 
                                        padding: '1rem', borderRadius: '16px', background: '#ffffff', 
                                        border: '1px solid #f1f5f9', marginBottom: '0.75rem', 
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer',
                                        boxShadow: '0 2px 10px rgba(0,0,0,0.02)', transition: 'all 0.2s ease' 
                                    }} 
                                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.05)'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#f1f5f9'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.02)'; }}
                                    onClick={() => { setSelectedDept(null); handleSelectFaculty(fac); }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <img src={fac.photoUrl || getAvatarUrl(fac.email)} style={{ width: 44, height: 44, borderRadius: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }} />
                                            <div>
                                                <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '1rem' }}>{fac.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{fac.email}</div>
                                            </div>
                                        </div>
                                        <div style={{ color: '#6366f1', fontWeight: 800, background: '#e0e7ff', padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.8rem' }}>
                                            {fac.stats.total} Tasks
                                        </div>
                                    </div>
                                ))}
                            </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showPreviewModal && (
                <div className="modal-overlay" onClick={() => setShowPreviewModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: 950, marginBottom: '1.5rem' }}>Commit Summary</h3>
                        <div style={{ maxHeight: '40vh', overflowY: 'auto' }}>
                            <table className="leader-table">
                                <thead>
                                    <tr>
                                        <th>Faculty</th>
                                        <th>Changes</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {previewRecords.map((rec, i) => (
                                        <tr key={i}>
                                            <td style={{ fontWeight: 700 }}>{rec.name || rec.title}</td>
                                            <td>{rec.changeCount || 'Pending'} updates</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                            <button className="btn-secondary" onClick={() => setShowPreviewModal(false)}>Cancel</button>
                            <button className="btn-sync" onClick={() => handleSync(true)}>Commit Changes</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
