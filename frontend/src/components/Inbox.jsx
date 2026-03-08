import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from '../config';

const CATEGORIES = [
    { key: 'all', label: 'All', icon: '📬', color: '#818cf8' },
    { key: 'student_query', label: 'Students', icon: '🎓', color: '#34d399' },
    { key: 'leave_request', label: 'Leave', icon: '🏖️', color: '#f59e0b' },
    { key: 'permission', label: 'Permission', icon: '🔐', color: '#a78bfa' },
    { key: 'faculty_mail', label: 'Faculty', icon: '👥', color: '#60a5fa' },
    { key: 'hod_mail', label: 'HOD / Head', icon: '🏛️', color: '#f87171' },
    { key: 'other', label: 'Other', icon: '📄', color: '#94a3b8' },
];

function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

function getCategoryColor(cat) {
    return CATEGORIES.find(c => c.key === cat)?.color || '#94a3b8';
}

export default function Inbox() {
    const [emails, setEmails] = useState([]);
    const [counts, setCounts] = useState({});
    const [activeCategory, setActiveCategory] = useState('all');
    const [selectedEmail, setSelectedEmail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [syncMsg, setSyncMsg] = useState('');
    const [draftModal, setDraftModal] = useState({ open: false, emailId: null, draft: '', loading: false });

    const getHeaders = () => ({ 
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
    });

    const fetchEmails = useCallback(async (category = 'all') => {
        setLoading(true);
        try {
            const url = category === 'all'
                ? `${API_URL}/inbox`
                : `${API_URL}/inbox?category=${category}`;
            const res = await fetch(url, { headers: getHeaders() });
            const data = await res.json();
            if (data.success) {
                setEmails(data.data);
                setCounts(data.counts || {});
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchEmails(activeCategory);
    }, [activeCategory]);

    const syncGmail = async () => {
        setSyncing(true);
        setSyncMsg('');
        try {
            const res = await fetch(`${API_URL}/inbox/sync`, { method: 'POST', headers: getHeaders() });
            const data = await res.json();
            setSyncMsg(data.message || 'Sync complete');
            fetchEmails(activeCategory);
        } catch (e) {
            setSyncMsg('Sync failed. Check Gmail permissions.');
        } finally {
            setSyncing(false);
        }
    };

    const openEmail = async (email) => {
        setSelectedEmail(email);
        if (!email.isRead) {
            await fetch(`${API_URL}/inbox/${email.id}/read`, { method: 'PATCH', headers: getHeaders() });
            setEmails(prev => prev.map(e => e.id === email.id ? { ...e, isRead: true } : e));
        }
    };

    const getAutoReply = async (emailId) => {
        setDraftModal({ open: true, emailId, draft: '', loading: true });
        try {
            const res = await fetch(`${API_URL}/inbox/${emailId}/auto-reply`, { method: 'POST', headers: getHeaders() });
            const data = await res.json();
            setDraftModal(d => ({ ...d, draft: data.draft || '', loading: false }));
        } catch {
            setDraftModal(d => ({ ...d, draft: 'Unable to generate reply. Please try again.', loading: false }));
        }
    };

    const totalUnread = Object.values(counts).reduce((a, b) => a + b, 0);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                        📬 Smart Inbox
                    </h1>
                    <p style={{ color: 'var(--text-dim)', fontSize: '0.75rem', margin: '0.15rem 0 0' }}>
                        Emails categorized by AI — {totalUnread > 0 ? `${totalUnread} unread` : 'all caught up ✓'}
                    </p>
                </div>
                <button
                    onClick={syncGmail}
                    disabled={syncing}
                    style={{
                        background: syncing ? 'var(--bg-card)' : 'var(--primary)',
                        color: syncing ? 'var(--text-muted)' : 'white',
                        border: 'none', borderRadius: '6px',
                        padding: '0.45rem 1rem', fontWeight: 700, fontSize: '0.78rem',
                        cursor: syncing ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', gap: '0.4rem'
                    }}
                >
                    {syncing ? '⟳ Syncing...' : '⟳ Sync Gmail'}
                </button>
            </div>

            {syncMsg && (
                <div style={{
                    padding: '0.5rem 0.85rem', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 500,
                    background: syncMsg.includes('fail') ? 'rgba(244,63,94,0.1)' : 'rgba(16,185,129,0.1)',
                    color: syncMsg.includes('fail') ? '#f43f5e' : '#10b981',
                    border: `1px solid ${syncMsg.includes('fail') ? 'rgba(244,63,94,0.25)' : 'rgba(16,185,129,0.25)'}`
                }}>
                    {syncMsg}
                </div>
            )}

            {/* Category Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.25rem', WebkitOverflowScrolling: 'touch' }}>
                {CATEGORIES.map(cat => {
                    const catCount = cat.key === 'all'
                        ? totalUnread
                        : (counts[cat.key] || 0);
                    return (
                        <button
                            key={cat.key}
                            onClick={() => setActiveCategory(cat.key)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '0.35rem',
                                padding: '0.4rem 0.85rem', borderRadius: '99px', whiteSpace: 'nowrap',
                                fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer',
                                border: activeCategory === cat.key
                                    ? `1.2px solid ${cat.color}`
                                    : '1.2px solid var(--border-color)',
                                background: activeCategory === cat.key
                                    ? `color-mix(in srgb, ${cat.color} 15%, transparent)`
                                    : 'var(--bg-card)',
                                color: activeCategory === cat.key ? cat.color : 'var(--text-muted)',
                                transition: 'all 0.15s'
                            }}
                        >
                            <span>{cat.icon}</span>
                            {cat.label}
                            {catCount > 0 && (
                                <span style={{
                                    background: cat.color, color: 'white',
                                    borderRadius: '99px', fontSize: '0.6rem', fontWeight: 800,
                                    padding: '0.05rem 0.35rem', minWidth: '16px', textAlign: 'center'
                                }}>{catCount}</span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Email List + Detail View */}
            <div style={{ display: 'grid', gridTemplateColumns: selectedEmail ? '1fr 1.4fr' : '1fr', gap: '1rem' }}>

                {/* Email List */}
                <div style={{
                    background: 'var(--bg-card)', borderRadius: '12px', overflow: 'hidden',
                    border: '1px solid var(--border-color)'
                }}>
                    {loading ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-dim)' }}>Loading emails...</div>
                    ) : emails.length === 0 ? (
                        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-dim)' }}>
                            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
                            <div style={{ fontWeight: 600 }}>No emails in this category</div>
                            <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>Sync your Gmail to see emails here</div>
                        </div>
                    ) : emails.map(email => (
                        <div
                            key={email.id}
                            onClick={() => openEmail(email)}
                            style={{
                                padding: '0.65rem 0.85rem', cursor: 'pointer',
                                borderBottom: '1px solid var(--border-color)',
                                background: selectedEmail?.id === email.id
                                    ? 'rgba(99,102,241,0.08)'
                                    : email.isRead ? 'transparent' : 'rgba(255,255,255,0.02)',
                                transition: 'background 0.15s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                            onMouseLeave={e => e.currentTarget.style.background = selectedEmail?.id === email.id
                                ? 'rgba(99,102,241,0.08)'
                                : email.isRead ? 'transparent' : 'rgba(255,255,255,0.02)'}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.15rem' }}>
                                        {!email.isRead && (
                                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--primary)', flexShrink: 0 }} />
                                        )}
                                        <span style={{
                                            fontSize: '0.78rem', fontWeight: email.isRead ? 400 : 700,
                                            color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                        }}>{email.fromEmail}</span>
                                    </div>
                                    <div style={{
                                        fontSize: '0.8rem', fontWeight: email.isRead ? 500 : 700,
                                        color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                        marginBottom: '0.15rem'
                                    }}>{email.subject}</div>
                                    <div style={{
                                        fontSize: '0.72rem', color: 'var(--text-dim)',
                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                    }}>{email.aiSummary || email.bodySnippet}</div>
                                </div>
                                <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem' }}>
                                    <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>{timeAgo(email.sentAt)}</span>
                                    <span style={{
                                        fontSize: '0.6rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '3px',
                                        background: `color-mix(in srgb, ${getCategoryColor(email.category)} 15%, transparent)`,
                                        color: getCategoryColor(email.category),
                                        textTransform: 'uppercase', letterSpacing: '0.04em'
                                    }}>{email.category.replace('_', ' ')}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Email Detail Pane */}
                {selectedEmail && (
                    <div style={{
                        background: 'var(--bg-card)', borderRadius: '12px',
                        border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column',
                        overflow: 'hidden', maxHeight: '75vh'
                    }}>
                        {/* Email Header */}
                        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.35rem', color: 'var(--text-main)' }}>
                                        {selectedEmail.subject}
                                    </h3>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        <strong>From:</strong> {selectedEmail.fromEmail}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.15rem' }}>
                                        {new Date(selectedEmail.sentAt).toLocaleString()}
                                    </div>
                                </div>
                                <button onClick={() => setSelectedEmail(null)} style={{
                                    background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-muted)',
                                    width: 28, height: 28, borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', flexShrink: 0
                                }}>✕</button>
                            </div>

                            {/* AI Summary Banner */}
                            {selectedEmail.aiSummary && (
                                <div style={{
                                    marginTop: '0.6rem', padding: '0.5rem 0.75rem', borderRadius: '6px',
                                    background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
                                    fontSize: '0.78rem', color: '#818cf8', display: 'flex', alignItems: 'center', gap: '0.4rem'
                                }}>
                                    <span>✨</span>
                                    <span><strong>AI Summary:</strong> {selectedEmail.aiSummary}</span>
                                </div>
                            )}
                        </div>

                        {/* Email Body */}
                        <div style={{
                            padding: '1rem 1.25rem', flex: 1, overflowY: 'auto',
                            fontSize: '0.82rem', color: 'var(--text-main)', lineHeight: 1.6,
                            whiteSpace: 'pre-wrap', wordBreak: 'break-word'
                        }}>
                            {selectedEmail.fullBody || selectedEmail.bodySnippet || 'No message body available.'}
                        </div>

                        {/* Actions */}
                        <div style={{
                            padding: '0.85rem 1.25rem', borderTop: '1px solid var(--border-color)',
                            display: 'flex', gap: '0.6rem', flexWrap: 'wrap'
                        }}>
                            <button
                                onClick={() => getAutoReply(selectedEmail.id)}
                                style={{
                                    background: 'var(--primary)', color: 'white', border: 'none',
                                    borderRadius: '6px', padding: '0.5rem 1.15rem',
                                    fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: '0.4rem'
                                }}
                            >
                                ✨ AI Auto-Reply
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* AI Draft Modal */}
            {draftModal.open && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
                    backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', zIndex: 1000, padding: '1rem'
                }}>
                    <div style={{
                        background: '#0f1320', border: '1px solid var(--border-hover)',
                        borderRadius: '20px', width: '520px', maxWidth: '95vw',
                        boxShadow: 'var(--shadow-lg)'
                    }}>
                        <div style={{
                            padding: '1.25rem 1.75rem', borderBottom: '1px solid var(--border-color)',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}>
                            <h3 style={{ margin: 0, fontWeight: 700, fontSize: '1rem' }}>✨ AI Generated Reply Draft</h3>
                            <button onClick={() => setDraftModal({ open: false, emailId: null, draft: '', loading: false })} style={{
                                background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                                color: 'var(--text-muted)', width: 28, height: 28, borderRadius: '6px', cursor: 'pointer'
                            }}>✕</button>
                        </div>
                        <div style={{ padding: '1.5rem 1.75rem' }}>
                            {draftModal.loading ? (
                                <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '2rem 0' }}>
                                    ✨ Generating with AI...
                                </div>
                            ) : (
                                <textarea
                                    value={draftModal.draft}
                                    onChange={e => setDraftModal(d => ({ ...d, draft: e.target.value }))}
                                    rows={8}
                                    style={{
                                        width: '100%', background: 'rgba(255,255,255,0.04)',
                                        border: '1px solid var(--border-color)', borderRadius: '10px',
                                        padding: '0.85rem 1rem', color: 'var(--text-main)', fontSize: '0.88rem',
                                        lineHeight: 1.7, resize: 'vertical', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box'
                                    }}
                                />
                            )}
                        </div>
                        <div style={{
                            padding: '1rem 1.75rem', borderTop: '1px solid var(--border-color)',
                            display: 'flex', gap: '0.75rem', justifyContent: 'flex-end'
                        }}>
                            <button onClick={() => setDraftModal({ open: false, emailId: null, draft: '', loading: false })} style={{
                                background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)',
                                padding: '0.6rem 1.25rem', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem'
                            }}>Discard</button>
                            <button
                                onClick={async () => {
                                    try {
                                        const res = await fetch(`${API_URL}/inbox/${draftModal.emailId}/send-reply`, {
                                            method: 'POST',
                                            headers: {
                                                ...getHeaders()
                                            },
                                            body: JSON.stringify({ draft: draftModal.draft })
                                        });
                                        const data = await res.json();
                                        if (data.success) {
                                            alert('Auto-reply sent successfully via Gmail!');
                                            setDraftModal({ open: false, emailId: null, draft: '', loading: false });
                                        } else {
                                            alert('Failed to send reply: ' + data.message);
                                        }
                                    } catch (e) {
                                        alert('Error sending reply.');
                                    }
                                }}
                                style={{
                                    background: 'var(--primary)', color: 'white', border: 'none',
                                    padding: '0.6rem 1.5rem', borderRadius: '8px',
                                    fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem'
                                }}
                            >🚀 Send Reply</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
