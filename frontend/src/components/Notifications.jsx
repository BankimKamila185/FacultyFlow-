import React, { useState, useEffect } from 'react';
import { API_URL } from '../config';

export default function Notifications() {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchNotifications = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;
            const res = await fetch(`${API_URL}/notifications`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setNotifications(data.data);
            }
        } catch (err) {
            console.error('Error fetching notifications:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNotifications();
    }, []);

    const markAllAsRead = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/notifications/read-all`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            }
        } catch (err) {
            console.error('Error marking all as read:', err);
        }
    };

    const timeAgo = (dateStr) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        return `${Math.floor(hrs / 24)}d ago`;
    };

    const getIcon = (type) => {
        switch (type) {
            case 'TASK_ASSIGNED': return { icon: '📝', color: 'var(--primary)' };
            case 'DEADLINE_REMINDER': return { icon: '⏰', color: 'var(--danger)' };
            case 'APPROVAL_REQUEST': return { icon: '✅', color: 'var(--success)' };
            case 'SYSTEM_ALERT': return { icon: '⚙️', color: 'var(--text-dim)' };
            default: return { icon: '🔔', color: '#8B5CF6' };
        }
    };

    const unreadCount = notifications.filter(n => !n.isRead).length;

    return (
        <div className="notif-container">
            <style>{`
        .notif-container { max-width: 600px; margin: 0 auto; display: flex; flex-direction: column; gap: 1rem; }
        .notif-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 1rem; }
        
        .notif-list { display: flex; flex-direction: column; gap: 0.6rem; }
        .notif-card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius); padding: 0.85rem 1rem; display: flex; gap: 0.85rem; transition: var(--transition); position: relative; overflow: hidden; }
        .notif-card:hover { background: var(--bg-card-hover); border-color: var(--border-hover); }
        .notif-card.unread::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--primary); }
        
        .notif-icon { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.95rem; flex-shrink: 0; }
        
        .notif-body { flex: 1; }
        .notif-title { font-weight: 600; color: var(--text-main); font-size: 0.82rem; margin-bottom: 0.15rem; display: flex; justify-content: space-between; }
        .notif-time { font-size: 0.68rem; color: var(--text-dim); font-weight: 400; }
        .notif-desc { font-size: 0.75rem; color: var(--text-muted); line-height: 1.4; }
        
        .btn-text { background: transparent; border: none; color: var(--primary); font-size: 0.78rem; font-weight: 600; cursor: pointer; transition: color 0.2s; }
        .btn-text:hover { color: var(--primary-hover); }
        .btn-text:disabled { color: var(--text-muted); cursor: not-allowed; }
      `}</style>

            <div className="notif-header">
                <div>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Notifications</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '0.2rem' }}>
                        {unreadCount > 0 ? `You have ${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}` : 'You are all caught up'}
                    </p>
                </div>
                <button className="btn-text" onClick={markAllAsRead} disabled={unreadCount === 0}>
                    Mark all as read
                </button>
            </div>

            <div className="notif-list">
                {loading ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '2rem' }}>Loading notifications...</div>
                ) : notifications.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '2rem' }}>No notifications found.</div>
                ) : notifications.map(n => {
                    const config = getIcon(n.type);
                    return (
                        <div className={`notif-card ${!n.isRead ? 'unread' : ''}`} key={n.id}>
                            <div className="notif-icon" style={{ background: `color-mix(in srgb, ${config.color} 15%, transparent)` }}>
                                {config.icon}
                            </div>
                            <div className="notif-body">
                                <div className="notif-title">
                                    System Notification
                                    <span className="notif-time">{timeAgo(n.createdAt)}</span>
                                </div>
                                <div className="notif-desc">{n.message}</div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
