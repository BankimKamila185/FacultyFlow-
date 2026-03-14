import React, { useState, useEffect } from 'react';
import { API_URL } from '../config';
import { fetchWithAuth, getAvatarUrl } from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function AdminDashboard({ setActiveTab }) {
    const [departments, setDepartments] = useState([]);
    const [facultyStats, setFacultyStats] = useState([]);
    const [globalMetrics, setGlobalMetrics] = useState(null);
    const [loading, setLoading] = useState(false);
    const [tasksLoading, setTasksLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSyncing, setIsSyncing] = useState(false);
    const [selectedFaculty, setSelectedFaculty] = useState(null);
    const [facultyTasks, setFacultyTasks] = useState([]);
    const [selectedDept, setSelectedDept] = useState(null);
    const [previewRecords, setPreviewRecords] = useState(null);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [activeSemester, setActiveSemester] = useState('even'); // 'even' or 'odd'
    const [selectedDeptFilter, setSelectedDeptFilter] = useState('All');
    const { currentUser } = useAuth();

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

    const handleSync = async (isCommit = false) => {
        setIsSyncing(true);
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
            setIsSyncing(false);
        }
    };

    const handleNudgeAll = async () => {
        try {
            const res = await fetchWithAuth(`${API_URL}/users/nudge-all-delayed`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                alert('Successfully nudged all delayed faculty members.');
            } else {
                alert('Failed to nudge: ' + data.message);
            }
        } catch (err) {
            console.error('Error nudging all:', err);
            alert('An error occurred while nudging.');
        }
    };

    const handleViewSheet = () => {
        const url = currentUser?.sheetUrl || 'https://docs.google.com/spreadsheets/d/1tKxwemxRO9HWpYwkuS98Ey8EGiRjHO5QszI4R0zWFF0/edit';
        window.open(url, '_blank');
    };

    const departmentData = departments
        .filter(dept => selectedDeptFilter === 'All' || dept === selectedDeptFilter)
        .map(dept => {
        const matchingFaculty = facultyStats.filter(f => 
            (f.department?.trim().toLowerCase() === dept.toLowerCase()) ||
            (dept === 'Faculty' && (!f.department || f.department.trim() === ''))
        );
        
        const stats = matchingFaculty.reduce((acc, f) => {
            acc.total += (f.stats?.total || 0);
            acc.completed += (f.stats?.completed || 0);
            acc.pending += (f.stats?.pending || 0);
            acc.overdue += (f.stats?.overdue || 0);
            acc.inProgress += (f.stats?.inProgress || 0);
            return acc;
        }, { total: 0, completed: 0, pending: 0, overdue: 0, inProgress: 0 });

        return {
            name: dept,
            facultyCount: matchingFaculty.length,
            stats,
            completionRate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
            faculty: matchingFaculty
        };
    });

    const sortedByCompletion = [...facultyStats]
        .filter(f => selectedDeptFilter === 'All' || f.department === selectedDeptFilter)
        .sort((a, b) => {
        const rateA = a.stats?.total > 0 ? (a.stats.completed / a.stats.total) : 0;
        const rateB = b.stats?.total > 0 ? (b.stats.completed / b.stats.total) : 0;
        return rateB - rateA;
    });

    const filteredFaculty = facultyStats.filter(fac => 
        (selectedDeptFilter === 'All' || fac.department === selectedDeptFilter) &&
        (fac.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
         fac.email?.toLowerCase().includes(searchQuery.toLowerCase()))
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
            `}</style>

            <div className="admin-header">
                <div>
                    <h2>Admin Intelligence</h2>
                    <p>Strategic oversight of faculty operations and departmental flow.</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="btn-secondary" onClick={handleViewSheet} title="Open Source Spreadsheet">
                        Source Data
                    </button>
                    <button 
                        className={`btn-sync ${isSyncing ? 'loading' : ''}`} 
                        onClick={handleSync}
                        disabled={isSyncing}
                    >
                        {isSyncing ? 'Syncing...' : 'Sync Master Data'}
                    </button>
                   <button className="btn-vibrant" onClick={() => setActiveTab('Projects')}>
                        Portfolio View
                    </button>
                </div>
            </div>

            <div className="filter-bar">
                <button 
                    className={`filter-item ${activeSemester === 'even' ? 'active' : ''}`}
                    onClick={() => setActiveSemester('even')}
                >
                    Semester 2, 4, 6
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                <button 
                    className={`filter-item ${activeSemester === 'odd' ? 'active' : ''}`}
                    onClick={() => setActiveSemester('odd')}
                >
                    Semester 1, 3, 5, 7
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                <div className="filter-sep" />
                <div className="dept-dropdown">
                    <select 
                        className={`dept-select-trigger ${selectedDeptFilter !== 'All' ? 'active' : ''}`}
                        value={selectedDeptFilter}
                        onChange={(e) => setSelectedDeptFilter(e.target.value)}
                        style={{ outline: 'none' }}
                    >
                        <option value="All">Department list</option>
                        {departments.map(dept => (
                            <option key={dept} value={dept}>{dept}</option>
                        ))}
                    </select>
                </div>
            </div>

            {!selectedFaculty ? (
                activeSemester === 'odd' ? (
                    <div style={{ padding: '6rem', textAlign: 'center', background: 'var(--bg-card)', borderRadius: '32px', border: '1px dashed var(--border-color)', margin: '2rem 1.5rem' }}>
                        <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>📅</div>
                        <h3 style={{ fontSize: '1.8rem', fontWeight: 950, color: 'var(--text-main)', marginBottom: '0.5rem' }}>Odd Semester Data (1, 3, 5, 7)</h3>
                        <p style={{ color: 'var(--text-dim)', fontSize: '1.1rem', maxWidth: '500px', margin: '0 auto' }}>
                            Data for the odd semester has not been synchronized yet. Please switch back to Semester 2, 4, 6 or sync from the source spreadsheet.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="dashboard-section">
                            <div className="section-header">
                                <h3 className="section-title">Departmental Intelligence</h3>
                            </div>
                            <div className="dept-grid">
                                {departmentData.map(dept => (
                                    <div key={dept.name} className="dept-card" onClick={() => setSelectedDept(dept)}>
                                        <div>
                                            <div className="dept-name">{dept.name}</div>
                                            <div className="dept-meta">{dept.facultyCount} Active Members</div>
                                        </div>
                                        <div className="dept-progress-info">
                                            <div>
                                                <div className="metric-lab" style={{ fontSize: '0.65rem' }}>Process Status</div>
                                                <div className="dept-rate">{dept.completionRate}%</div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div className="metric-lab" style={{ fontSize: '0.65rem' }}>Workload</div>
                                                <div style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--text-main)' }}>{dept.stats.total} Tasks</div>
                                            </div>
                                        </div>
                                        <div className="progress-container" style={{ height: '6px' }}>
                                            <div className="progress-bar" style={{ width: `${dept.completionRate}%` }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
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
                )
            ) : (
                <div className="tasks-view">
                    <div className="tasks-header">
                        <div className="fac-top" style={{ gap: '1.75rem' }}>
                            <img src={selectedFaculty.photoUrl || getAvatarUrl(selectedFaculty.email)} alt={selectedFaculty.name} className="fac-avatar" style={{width: 80, height: 80, borderRadius: '24px', border: '2px solid var(--border-color)'}} />
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <h3 style={{ fontSize: '2.4rem', fontWeight: 950, color: 'var(--text-main)', margin: 0, letterSpacing: '-0.04em' }}>{selectedFaculty.name}</h3>
                                        <p style={{ color: 'var(--text-dim)', margin: '0.25rem 0 0.75rem 0', fontSize: '1.15rem', fontWeight: 600 }}>{selectedFaculty.email}</p>
                                    </div>
                                    <div style={{ display: 'flex', gap: '1rem' }}>
                                        <div className="mini-stat">
                                            <div className="mini-val">{selectedFaculty.stats?.total || 0}</div>
                                            <div className="mini-lab">Tasks</div>
                                        </div>
                                        <div className="mini-stat" style={{ borderColor: 'var(--primary-light)' }}>
                                            <div className="mini-val" style={{ color: 'var(--primary)' }}>
                                                {selectedFaculty.stats?.total > 0 ? Math.round((selectedFaculty.stats.completed / selectedFaculty.stats.total) * 100) : 0}%
                                            </div>
                                            <div className="mini-lab">Success</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <button className="btn-close" onClick={() => setSelectedFaculty(null)} style={{ padding: '0.8rem 1.75rem', borderRadius: '14px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', fontWeight: 700 }}>Return to Fleet</button>
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

            {/* Department Detail Modal */}
            {selectedDept && (
                <div className="modal-overlay" onClick={() => setSelectedDept(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <h3 style={{ fontSize: '2.2rem', fontWeight: 950, color: 'var(--text-main)', margin: 0, letterSpacing: '-0.04em' }}>{selectedDept.name}</h3>
                                <p style={{ color: 'var(--text-dim)', margin: '0.2rem 0 0', fontWeight: 700, fontSize: '1.1rem' }}>Aggregate Intelligence Summary</p>
                            </div>
                            <button className="btn-close" onClick={() => setSelectedDept(null)} style={{ fontSize: '1.5rem', background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>&times;</button>
                        </div>

                        <div className="stat-grid">
                            <div className="stat-box completed">
                                <span className="stat-label">Resolved</span>
                                <span className="stat-value">{selectedDept.stats.completed}</span>
                            </div>
                            <div className="stat-box progress">
                                <span className="stat-label">In-Flight</span>
                                <span className="stat-value">{selectedDept.stats.inProgress}</span>
                            </div>
                            <div className="stat-box pending">
                                <span className="stat-label">Pending</span>
                                <span className="stat-value">{selectedDept.stats.pending}</span>
                            </div>
                            <div className="stat-box overdue">
                                <span className="stat-label">Critical / Delay</span>
                                <span className="stat-value">{selectedDept.stats.overdue}</span>
                            </div>
                        </div>

                        <div style={{ marginTop: '2rem' }}>
                            <h4 style={{ fontSize: '0.8rem', fontWeight: 900, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '0.1em' }}>Assigned Personnel ({selectedDept.faculty.length})</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {selectedDept.faculty.map(fac => (
                                    <div key={fac.id} className="search-item" style={{ padding: '0.75rem 1rem', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onClick={() => { setSelectedDept(null); handleSelectFaculty(fac); }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <img src={fac.photoUrl || getAvatarUrl(fac.email)} style={{ width: 32, height: 32, borderRadius: '8px' }} />
                                            <div>
                                                <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>{fac.name}</div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{fac.email}</div>
                                            </div>
                                        </div>
                                        <div style={{ fontWeight: 950, color: 'var(--primary)' }}>{fac.stats.total} Tasks</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div style={{ marginTop: '2.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                            <button className="btn-vibrant" onClick={() => setSelectedDept(null)}>Dismiss Overlay</button>
                        </div>
                    </div>
                </div>
            )}
            {/* Preview Sync Modal */}
            {showPreviewModal && (
                <div className="modal-overlay" onClick={() => setShowPreviewModal(false)}>
                    <div className="modal-content" style={{ maxWidth: '900px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                            <div>
                                <h3 style={{ fontSize: '1.8rem', fontWeight: 950, color: 'var(--text-main)', margin: 0 }}>Sync Preview</h3>
                                <p style={{ color: 'var(--text-dim)', fontWeight: 600 }}>Reviewing {previewRecords?.length} tasks from spreadsheet</p>
                            </div>
                            <button className="btn-close" onClick={() => setShowPreviewModal(false)} style={{ fontSize: '1.5rem', background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>&times;</button>
                        </div>

                        <div style={{ maxHeight: '50vh', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '0.5rem' }}>
                            <table className="leader-table">
                                <thead>
                                    <tr>
                                        <th>Sprint / Event</th>
                                        <th>Task Title</th>
                                        <th>Responsible</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {previewRecords?.map((rec, idx) => (
                                        <tr key={idx}>
                                            <td style={{ fontSize: '0.8rem' }}>
                                                <div style={{ fontWeight: 800 }}>{rec.sprintName}</div>
                                                <div style={{ color: 'var(--text-dim)' }}>{rec.subEvent}</div>
                                            </td>
                                            <td style={{ fontWeight: 600 }}>{rec.title}</td>
                                            <td style={{ fontSize: '0.85rem' }}>
                                                <div>{rec.primaryEmail}</div>
                                                <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>{rec.responsibleTeam}</div>
                                            </td>
                                            <td>
                                                <span className={`t-status ${rec.status}`} style={{
                                                    background: rec.status === 'COMPLETED' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                                                    color: rec.status === 'COMPLETED' ? '#10B981' : '#F59E0B',
                                                    padding: '0.2rem 0.5rem',
                                                    borderRadius: '6px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 800
                                                }}>
                                                    {rec.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                            <button className="btn-secondary" onClick={() => setShowPreviewModal(false)}>Cancel</button>
                            <button 
                                className={`btn-sync ${isSyncing ? 'loading' : ''}`} 
                                onClick={() => handleSync(true)}
                                disabled={isSyncing}
                            >
                                {isSyncing ? 'Committing...' : 'Commit to Firestore'}
                            </button>
                        </div>
                        
                        <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-dim)', textAlign: 'right' }}>
                             ⚠️ Committing will consume Firestore write quota.
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}


