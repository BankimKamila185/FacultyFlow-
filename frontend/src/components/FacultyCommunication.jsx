import React, { useState, useEffect } from 'react';
import { API_URL } from '../config';
import { fetchWithAuth } from '../utils/api';

export default function FacultyCommunication() {
    const [queries, setQueries] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchQueries = async () => {
            try {
                const res = await fetchWithAuth(`${API_URL}/inbox?category=faculty_mail,hod_mail`);
                const data = await res.json();
                if (data.success) {
                    setQueries(data.data);
                }
            } catch (err) {
                console.error('Error fetching faculty communications:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchQueries();
    }, []);

    const timeAgo = (dateStr) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        return `${Math.floor(hrs / 24)}d ago`;
    };

    return (
        <div className="sq-container">
            <style>{`
                .sq-container { animation: fadeIn 0.5s ease; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                
                .sq-header { margin-bottom: 2rem; }
                .sq-header h2 { font-size: 1.8rem; font-weight: 900; letter-spacing: -0.03em; color: var(--text-main); margin-bottom: 0.25rem; }
                .sq-header p { color: var(--text-dim); font-size: 1rem; font-weight: 500; }

                .queries-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(400px, 1fr)); gap: 1.5rem; }
                
                .q-card { 
                    background: var(--bg-card); border-radius: 24px; padding: 1.5rem; 
                    border: 1px solid var(--border-color); transition: var(--transition);
                    position: relative; display: flex; flex-direction: column; gap: 1rem;
                    box-shadow: var(--shadow-sm);
                }
                .q-card:hover { transform: translateY(-4px); border-color: var(--primary); box-shadow: var(--shadow); }
                
                .q-top { display: flex; justify-content: space-between; align-items: flex-start; }
                .q-user-info { display: flex; align-items: center; gap: 0.85rem; }
                .q-avatar { 
                    width: 44px; height: 44px; border-radius: 14px; 
                    background: var(--gradient-primary); color: white; 
                    display: flex; align-items: center; justify-content: center; 
                    font-weight: 800; font-size: 1.1rem; box-shadow: 0 4px 12px var(--primary-glow);
                }
                .q-meta { display: flex; flex-direction: column; gap: 0.1rem; }
                .q-email { font-weight: 700; color: var(--text-main); font-size: 0.95rem; letter-spacing: -0.01em; }
                .q-time { font-size: 0.75rem; font-weight: 600; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.05em; }

                .q-status { 
                    padding: 0.35rem 0.75rem; border-radius: 8px; font-size: 0.7rem; font-weight: 800; 
                    text-transform: uppercase; letter-spacing: 0.05em; 
                }
                .status-new { background: rgba(16, 185, 129, 0.1); color: #10B981; }
                .status-read { background: var(--bg-dark); color: var(--text-dim); }

                .q-content { flex: 1; }
                .q-subject { font-weight: 800; color: var(--text-main); font-size: 1.1rem; margin-bottom: 0.5rem; line-height: 1.3; }
                .q-summary { font-size: 0.9rem; color: var(--text-muted); line-height: 1.6; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }

                .q-footer { pt: 1rem; border-top: 1px solid var(--border-color); display: flex; justify-content: flex-end; }
                .btn-vibrant-sm { 
                    background: #10B981; color: white; border: none;
                    padding: 0.6rem 1.25rem; border-radius: 10px; font-size: 0.85rem; font-weight: 750; 
                    cursor: pointer; transition: var(--transition);
                }
            `}</style>

            <div className="sq-header">
                <h2>Faculty Intel</h2>
                <p>Peer communications, department updates, and management notices.</p>
            </div>
            
            <div className="queries-grid">
                {loading ? (
                    <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-dim)', gridColumn: '1/-1' }}>
                        <p style={{ marginTop: '1rem', fontWeight: 600 }}>Syncing faculty inbox...</p>
                    </div>
                ) : queries.length === 0 ? (
                    <div className="placeholder-section" style={{ gridColumn: '1/-1' }}>
                        <div className="placeholder-icon">🧑‍🏫</div>
                        <h3>Private</h3>
                        <p>No recent communications from faculty peers.</p>
                    </div>
                ) : queries.map(q => (
                    <div className="q-card" key={q.id}>
                        <div className="q-top">
                            <div className="q-user-info">
                                <div className="q-avatar" style={{ background: '#10B981' }}>
                                    {q.fromEmail.charAt(0).toUpperCase()}
                                </div>
                                <div className="q-meta">
                                    <span className="q-email">{q.fromEmail}</span>
                                    <span className="q-time">{timeAgo(q.sentAt)}</span>
                                </div>
                            </div>
                            <span className={`q-status ${q.isRead ? 'status-read' : 'status-new'}`}>
                                {q.category === 'hod_mail' ? 'Management' : 'Peer'}
                            </span>
                        </div>

                        <div className="q-content">
                            <div className="q-subject">{q.subject}</div>
                            <p className="q-summary">{q.aiSummary || q.bodySnippet || 'Analyzing content...'}</p>
                        </div>

                        <div className="q-footer">
                            <button className="btn-vibrant-sm">
                                Open Thread
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
