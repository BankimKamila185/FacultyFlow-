import React, { useState, useEffect } from 'react';
import { API_URL } from '../config';
import { fetchWithAuth, getAvatarUrl } from '../utils/api';

export default function Dashboard({ setActiveTab }) {
    const [workflows, setWorkflows] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [myTasks, setMyTasks] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [inbox, setInbox] = useState([]);
    const [metrics, setMetrics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [modalTitle, setModalTitle] = useState('');
    const [filteredTasks, setFilteredTasks] = useState([]);

    const fetchData = async (showSyncing = false) => {
        if (showSyncing) setSyncing(true);
        try {
            // Start Sync in background if requested
            if (showSyncing) {
                fetchWithAuth(`${API_URL}/sync`, { method: 'POST' }).catch(e => console.error("Sync error:", e));
            }

            const [wfRes, myTasksRes, allTasksRes, notifRes, inboxRes, metricsRes] = await Promise.all([
                fetchWithAuth(`${API_URL}/workflows/progress`),
                fetchWithAuth(`${API_URL}/tasks/my`),
                fetchWithAuth(`${API_URL}/tasks`),
                fetchWithAuth(`${API_URL}/notifications`),
                fetchWithAuth(`${API_URL}/inbox`),
                fetchWithAuth(`${API_URL}/analytics/dashboard`),
            ]);
            
            const [wfData, myTasksData, allTasksData, notifData, inboxData, metricsData] = await Promise.all([
                wfRes.json(),
                myTasksRes.json(),
                allTasksRes.json(),
                notifRes.json(),
                inboxRes.json(),
                metricsRes.json()
            ]);

            if (wfData.success) setWorkflows(wfData.data.slice(0, 4));
            if (myTasksData.success) setMyTasks(myTasksData.data.slice(0, 10));
            if (allTasksData.success) {
                setTasks(allTasksData.data);
            }
            if (inboxData.success) setInbox(inboxData.data.slice(0, 10));
            if (metricsData.success) {
                setMetrics(metricsData.data);
            }

        } catch (error) {
            console.error("Dashboard Fetch Error:", error);
        } finally {
            setLoading(false);
            if (showSyncing) setTimeout(() => setSyncing(false), 2000); // Visual feedback lag
        }
    };

    const isCurrentWeek = (dateStr) => {
        if (!dateStr) return false;
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return false;

        const now = new Date(); // Current date: Mar 17, 2026
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        // Get Monday of current week
        const day = today.getDay(); // 0 (Sun) to 6 (Sat)
        const diffToMonday = today.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(today.setDate(diffToMonday));
        monday.setHours(0, 0, 0, 0);

        // Get Sunday of current week
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);

        return date >= monday && date <= sunday;
    };

    useEffect(() => {
        fetchData(true); // Initial sync + fetch
        const interval = setInterval(() => fetchData(false), 300000);
        return () => clearInterval(interval);
    }, []);

    const stats = {
        total: metrics?.tasks?.total || 0,
        pending: metrics?.tasks?.pending || 0,
        completed: metrics?.tasks?.completed || 0,
        delayed: metrics?.tasks?.delayed || 0,
        inProgress: metrics?.tasks?.inProgress || 0
    };

    const unreadInboxCount = inbox.filter(m => !m.isRead).length;

    return (
        <div style={{ padding: '0 1rem' }}>
            {/* ─── Page Title ───────────────────────────────────────────── */}
            <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div style={{ cursor: 'pointer' }} onClick={() => fetchData(true)}>
                    <h1 className="db-title" style={{ fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        Overview
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
                            <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                        </svg>
                    </h1>
                    <p className="db-subtitle" style={{ fontSize: '0.8rem', opacity: 0.8 }}>Monitor all of your projects and faculty tasks with 100% live accuracy</p>
                </div>
                {syncing && (
                    <div style={{ 
                        display: 'flex', alignItems: 'center', gap: '8px', 
                        color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 700,
                        background: 'var(--primary-glow)', padding: '6px 12px', borderRadius: '99px'
                    }}>
                        <div className="sync-spinner" style={{ 
                            width: '12px', height: '12px', border: '2px solid currentColor', 
                            borderTopColor: 'transparent', borderRadius: '50%',
                            animation: 'spin 1s linear infinite'
                        }} />
                        Syncing Live Data...
                    </div>
                )}
            </div>

            {/* ─── Overview Stats Row ────────────────────────────────────────── */}
            <div className="over-stats" style={{ 
                marginBottom: '2rem', 
                display: 'grid', 
                gridTemplateColumns: 'repeat(5, 1fr)', 
                gap: '0.75rem',
                overflowX: 'auto',
                paddingBottom: '0.5rem'
            }}>
                {[
                    { label: 'Total Task', key: 'TOTAL', value: stats.total, color: 'var(--primary)', icon: <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>, badge: 'LIVE' },
                    { label: 'Pending', key: 'PENDING', value: stats.pending, color: '#F59E0B', icon: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></> },
                    { label: 'In Progress', key: 'IN_PROGRESS', value: stats.inProgress, color: '#3B82F6', icon: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/> },
                    { label: 'Completed', key: 'COMPLETED', value: stats.completed, color: '#10B981', icon: <polyline points="20 6 9 17 4 12"/> },
                    { label: 'Overdue', key: 'OVERDUE', value: stats.delayed, color: '#EF4444', icon: <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></> }
                ].map((item, idx) => (
                    <div key={idx} className="over-card" 
                        onClick={() => {
                            setModalTitle(`${item.label} Tasks`);
                            let filtered = [];
                            if (item.key === 'TOTAL') filtered = tasks;
                            else filtered = tasks.filter(t => t.status === item.key);
                            setFilteredTasks(filtered);
                            setShowModal(true);
                        }}
                        style={{ 
                            padding: '1rem 1.25rem', 
                            borderRadius: '20px', 
                            flexDirection: 'column', 
                            alignItems: 'flex-start',
                            gap: '0.5rem',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-color)',
                            boxShadow: 'var(--shadow-sm)',
                            minWidth: '160px',
                            cursor: 'pointer',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-5px)';
                            e.currentTarget.style.borderColor = item.color;
                            e.currentTarget.style.boxShadow = `0 10px 20px ${item.color}15`;
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.borderColor = 'var(--border-color)';
                            e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                            <div style={{ 
                                background: `${item.color}15`, 
                                color: item.color, 
                                padding: '0.5rem', 
                                borderRadius: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    {item.icon}
                                </svg>
                            </div>
                            {item.badge && (
                                <span style={{ fontSize: '0.6rem', fontWeight: 800, color: item.color, background: `${item.color}15`, padding: '2px 8px', borderRadius: '6px' }}>
                                    {item.badge}
                                </span>
                            )}
                        </div>
                        <div>
                            <div className="over-label" style={{ fontSize: '0.75rem', opacity: 0.8, marginBottom: '2px' }}>{item.label}</div>
                            <div className="over-value" style={{ fontSize: '1.5rem', lineHeight: 1 }}>{item.value}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ─── Main Content Grid ─────────────────────────────────────────── */}
            <div className="db-grid" style={{ gap: '2.5rem' }}>
                <div className="db-main-col">
                    {/* Recently Task Section */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>Recent Activity</h2>
                        </div>
                        <div className="recent-task-grid" style={{ gap: '1.25rem' }}>
                            {(() => {
                                const now = new Date();
                                const sortedTasks = [...myTasks]
                                    .filter(t => t.status !== 'COMPLETED')
                                    .sort((a, b) => {
                                        const dateA = a.deadline ? new Date(a.deadline) : new Date(8640000000000000);
                                        const dateB = b.deadline ? new Date(b.deadline) : new Date(8640000000000000);
                                        return dateA - dateB;
                                    })
                                    .slice(0, 2);

                                if (sortedTasks.length === 0 && myTasks.length > 0) {
                                    return myTasks.slice(0, 2).map((task) => (
                                        <React.Fragment key={task.id}>
                                            {renderTaskCard(task, true)}
                                        </React.Fragment>
                                    ));
                                }

                                return sortedTasks.map((task) => (
                                    <React.Fragment key={task.id}>
                                        {renderTaskCard(task)}
                                    </React.Fragment>
                                ));

                                function renderTaskCard(task, isCompletedFallback = false) {
                                    const deadline = task.deadline ? new Date(task.deadline) : null;
                                    const diffHours = deadline ? (deadline - now) / (1000 * 60 * 60) : Infinity;
                                    const isUrgent = diffHours >= 0 && diffHours <= 48;
                                    let pct = 0;
                                    if (task.status === 'COMPLETED') pct = 100;
                                    else if (task.status === 'IN_PROGRESS') pct = 50;
                                    
                                    return (
                                            <div className="rt-card" style={{ borderTop: `6px solid ${isUrgent ? '#EF4444' : '#F59E0B'}`, background: 'var(--bg-card)', padding: '1.25rem' }}>
                                                <div className="rt-header" style={{ marginBottom: '1rem' }}>
                                                    <span style={{ 
                                                        fontSize: '0.75rem', fontWeight: 800, padding: '0.35rem 0.75rem', 
                                                        borderRadius: '8px', background: isUrgent ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-dark)',
                                                        color: isUrgent ? '#EF4444' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem'
                                                    }}>
                                                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor' }} />
                                                        {isUrgent ? 'Urgent Priority' : isCompletedFallback ? 'Finalized' : 'Regular'}
                                                    </span>
                                                    <span style={{ color: 'var(--text-dim)', fontSize: '1.2rem', cursor: 'pointer' }}>⋯</span>
                                                </div>
                                                <div>
                                                    <h3 className="rt-title" style={{ fontSize: '1.05rem' }}>{task.title}</h3>
                                                    <p className="rt-desc" style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
                                                        {task.description || `Automatic tracking for ${task.title}. Due ${deadline ? deadline.toLocaleDateString() : 'soon'}.`}
                                                    </p>
                                                </div>
                                                <div style={{ marginTop: '1rem' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 800, marginBottom: '0.5rem' }}>
                                                        <span style={{ color: 'var(--text-muted)' }}>Status Concentration</span>
                                                        <span style={{ color: 'var(--primary)' }}>{pct}%</span>
                                                    </div>
                                                    <div className="prog-container" style={{ height: '6px' }}>
                                                        <div className="prog-bar" style={{ width: `${pct}%`, background: isUrgent ? '#EF4444' : '#10B981', boxShadow: '0 0 10px rgba(16, 185, 129, 0.2)' }}></div>
                                                    </div>
                                                </div>
                                                <div className="rt-footer" style={{ marginTop: '1rem' }}>
                                                    <div className="avatar-stack">
                                                        <img src={getAvatarUrl(task.assignedTo?.email || task.assignedTo?.name || task.id)} className="as-img" style={{ width: '24px', height: '24px' }} title={task.assignedTo?.name || 'Faculty'} />
                                                        <img src={getAvatarUrl(task.title)} className="as-img" style={{ width: '24px', height: '24px', marginLeft: '-8px' }} title="Stakeholder" />
                                                    </div>
                                                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-dim)' }}>
                                                        {deadline ? `Target: ${deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'Rolling Basis'}
                                                    </div>
                                                </div>
                                        </div>
                                    );
                                }
                            })()}
                        </div>

                    </div>
                </div>

                <div className="db-side-col">
                    {/* Mail Inbox Section */}
                    <div className="sched-card" style={{ padding: '0.5rem', borderRadius: '20px' }}>
                        <div className="sched-header" style={{ padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)' }}>Mail Inbox</h3>
                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                                {unreadInboxCount > 0 && (
                                    <span style={{ cursor: 'pointer', color: 'var(--text-dim)', fontSize: '0.75rem', fontWeight: 700, background: 'var(--bg-dark)', padding: '0.3rem 0.6rem', borderRadius: '8px' }}>
                                        {unreadInboxCount} New
                                    </span>
                                )}
                                <span style={{ cursor: 'pointer', color: 'var(--text-dim)', fontSize: '1.2rem' }}>⋯</span>
                            </div>
                        </div>
                        
                        <div style={{ padding: '0 1rem 1.5rem 1rem' }}>
                            {loading ? (
                                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-dim)' }}>Syncing mails...</div>
                            ) : inbox.length === 0 ? (
                                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-dim)' }}>No recent transmissions.</div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {inbox.map((mail) => (
                                        <div key={mail.id} style={{ 
                                            padding: '0.85rem', borderRadius: '14px', background: 'var(--bg-dark)', 
                                            border: '1px solid var(--border-color)', display: 'flex', gap: '0.75rem', cursor: 'pointer',
                                            transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                            boxShadow: 'var(--shadow-sm)'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                                        onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                                        >
                                            <img src={getAvatarUrl(mail.fromName)} style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--bg-card)' }} />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.2rem' }}>
                                                    <span style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mail.fromName}</span>
                                                    <span style={{ 
                                                        fontSize: '0.6rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em',
                                                        padding: '0.15rem 0.45rem', borderRadius: '5px', 
                                                        background: mail.category === 'student_query' ? 'rgba(37, 99, 235, 0.1)' : 'var(--bg-surface)',
                                                        color: mail.category === 'student_query' ? '#60A5FA' : 'var(--text-dim)'
                                                    }}>
                                                        {mail.category === 'student_query' ? 'Query' : 'Notice'}
                                                    </span>
                                                </div>
                                                <div style={{ 
                                                    fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, 
                                                    overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxDirection: 'vertical'
                                                }}>
                                                    {mail.subject}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── List Task Table ───────────────────────────────────────────── */}
            <div className="db-table-section" style={{ marginTop: '2rem', borderRadius: '24px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                <div className="dt-header" style={{ padding: '1.25rem 1.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>Weekly Task Registry</h2>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 600, marginTop: '2px' }}>Showing intel for the current week (Mon - Sun)</p>
                    </div>
                    <button 
                        onClick={() => setActiveTab('My Task')}
                        style={{ 
                            padding: '0.5rem 1rem', borderRadius: '10px', 
                            border: '1px solid var(--border-color)', background: 'var(--bg-card)',
                            fontSize: '0.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem',
                            boxShadow: 'var(--shadow-sm)', cursor: 'pointer', transition: 'all 0.3s ease',
                            color: 'var(--text-main)'
                        }} className="filter-btn">
                         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg> Filter
                    </button>
                </div>
                <div className="dt-wrapper">
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ background: 'var(--bg-surface)', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)' }}>
                            <tr>
                                <th style={{ padding: '0.75rem 0.75rem 0.75rem 1.75rem', textAlign: 'left', fontSize: '0.6rem', fontWeight: 900, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Core Task Context</th>
                                <th style={{ padding: '0.75rem 0.75rem', textAlign: 'left', fontSize: '0.6rem', fontWeight: 900, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Cycle Start</th>
                                <th style={{ padding: '0.75rem 0.75rem', textAlign: 'left', fontSize: '0.6rem', fontWeight: 900, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Deadline</th>
                                <th style={{ padding: '0.75rem 0.75rem', textAlign: 'left', fontSize: '0.6rem', fontWeight: 900, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Activity Scope</th>
                                <th style={{ padding: '0.75rem 0.75rem', textAlign: 'left', fontSize: '0.6rem', fontWeight: 900, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Responsible team</th>
                                <th style={{ padding: '0.75rem 1.75rem 0.75rem 0.75rem', textAlign: 'left', fontSize: '0.6rem', fontWeight: 900, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>Priority Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '10rem', color: 'var(--text-muted)', fontSize: '1.1rem', fontWeight: 700 }}>Sourcing intel...</td></tr>
                            ) : tasks.filter(t => isCurrentWeek(t.deadline) || isCurrentWeek(t.startDate)).length === 0 ? (
                                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '10rem', color: 'var(--text-muted)', fontSize: '1.1rem', fontWeight: 700 }}>Registry is currently clear for this week.</td></tr>
                            ) : tasks.filter(t => isCurrentWeek(t.deadline) || isCurrentWeek(t.startDate)).map((task, idx) => {
                                const isDone = task.status === 'COMPLETED';
                                let pct = 0;
                                if (isDone) pct = 100;
                                else if (task.status === 'IN_PROGRESS') pct = 50;
                                const priority = task.priority?.toUpperCase() || 'MEDIUM';
                                const priorityColor = priority === 'HIGH' ? '#EF4444' : (priority === 'LOW' ? '#10B981' : '#F59E0B');
                                return (
                                    <tr key={task.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '1rem 0.75rem 1rem 1.75rem' }}>
                                            <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-main)', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</div>
                                        </td>
                                        <td style={{ padding: '1rem 0.75rem', color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600, lineHeight: 1.4 }}>
                                            {task.startDate ? new Date(task.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Dec 15, 2025'}
                                        </td>
                                        <td style={{ padding: '1rem 0.75rem', color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600, lineHeight: 1.4 }}>
                                            {task.deadline ? new Date(task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Dec 30, 2025'}
                                        </td>
                                        <td style={{ padding: '1rem 0.75rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <div style={{ width: '70px', height: '6px', background: 'var(--bg-dark)', borderRadius: '100px', overflow: 'hidden' }}>
                                                    <div style={{ width: `${pct}%`, height: '100%', background: isDone ? '#10B981' : '#3B82F6', borderRadius: '100px' }}></div>
                                                </div>
                                                <span style={{ fontSize: '0.78rem', fontWeight: 900, color: 'var(--text-main)' }}>{pct}%</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem 0.75rem' }}>
                                            <div className="avatar-stack">
                                                <img src={getAvatarUrl(task.assignedTo?.email || task.id)} className="as-img" style={{ width: '24px', height: '24px', border: '1.5px solid var(--bg-card)' }} title={task.assignedTo?.name || 'Faculty'} />
                                                <img src={getAvatarUrl(task.title)} className="as-img" style={{ width: '24px', height: '24px', border: '1.5px solid var(--bg-card)', marginLeft: '-10px' }} title="Stakeholder" />
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem 1.75rem 1rem 0.75rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: priorityColor }}></div>
                                                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: priorityColor }}>
                                                    {priority.charAt(0) + priority.slice(1).toLowerCase()}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ─── Task List Modal ─────────────────────────────────────────── */}
            {showModal && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.3)', backdropFilter: 'blur(8px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '2rem'
                }} onClick={() => setShowModal(false)}>
                    <div style={{
                        background: '#ffffff', width: '100%', maxWidth: '720px', borderRadius: '24px',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden',
                        display: 'flex', flexDirection: 'column', maxHeight: '85vh', animation: 'modalSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '1.75rem 2rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff' }}>
                            <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', margin: 0 }}>{modalTitle}</h2>
                            <button onClick={() => setShowModal(false)} style={{
                                background: '#f8fafc', border: 'none', color: '#64748b', width: '36px', height: '36px',
                                borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'
                            }} onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#0f172a'; }}
                               onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#64748b'; }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                        </div>
                        <div style={{ overflowY: 'auto', padding: '1.5rem 2rem', background: '#f8fafc' }}>
                            {filteredTasks.length === 0 ? (
                                <div style={{ padding: '4rem', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>No tasks found in this category.</div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                                    {filteredTasks.map(task => {
                                        const isCompleted = task.status === 'COMPLETED';
                                        return (
                                        <div key={task.id} style={{
                                            padding: '1.25rem 1.5rem', borderRadius: '16px', background: '#ffffff', 
                                            border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            transition: 'all 0.2s ease', cursor: 'default'
                                        }}
                                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(0,0,0,0.05)'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                                        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.02)'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
                                        >
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '1.05rem', marginBottom: '8px', letterSpacing: '-0.01em' }}>{task.title}</div>
                                                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '0.8rem', fontWeight: 700 }}>
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                                        {task.deadline ? new Date(task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No specific date'}
                                                    </div>
                                                    <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#cbd5e1' }}></div>
                                                    <div style={{ color: '#0f172a', fontSize: '0.8rem', fontWeight: 800 }}>{task.assignedTo?.name || 'Unassigned'}</div>
                                                </div>
                                            </div>
                                            <div style={{
                                                padding: '0.35rem 0.85rem', borderRadius: '99px',
                                                background: isCompleted ? '#ecfdf5' : '#fff7ed', border: `1px solid ${isCompleted ? '#d1fae5' : '#ffedd5'}`,
                                                color: isCompleted ? '#059669' : '#d97706', fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.05em'
                                            }}>
                                                {task.status.replace('_', ' ')}
                                            </div>
                                        </div>
                                    )})}
                                </div>
                            )}
                        </div>
                        <div style={{ padding: '1.25rem 2rem', borderTop: '1px solid #f1f5f9', background: '#ffffff', display: 'flex', justifyContent: 'flex-end' }}>
                            <button onClick={() => setShowModal(false)} style={{
                                padding: '0.7rem 1.75rem', background: '#0f172a', color: 'white', border: 'none',
                                borderRadius: '99px', fontSize: '0.9rem', fontWeight: 800, cursor: 'pointer', 
                                boxShadow: '0 4px 12px rgba(15, 23, 42, 0.2)', transition: 'all 0.2s', letterSpacing: '0.02em'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(15, 23, 42, 0.3)'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(15, 23, 42, 0.2)'; }}
                            >Close Window</button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                @keyframes modalSlideUp {
                    from { opacity: 0; transform: translateY(40px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>
        </div>
    );
}
