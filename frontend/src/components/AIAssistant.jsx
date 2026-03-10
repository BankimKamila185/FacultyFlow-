import React, { useState, useEffect, useRef } from 'react';
import { API_URL } from '../config';
import { fetchWithAuth } from '../utils/api';

/* ─── SVG icon helpers ─────────────────────────────────────────────────────── */
const SendIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
);
const CopyIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
);
const ExternalIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
    </svg>
);
const UserIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
);
const ClockIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
);

/* ─── Card accent colours per type ────────────────────────────────────────── */
const TYPE_META = {
    EMAIL: { label: 'EMAIL DRAFT', accent: '#EA4335', icon: '📧' },
    SHEET: { label: 'GOOGLE SHEET', accent: '#34A853', icon: '📊' },
    DOC:   { label: 'GOOGLE DOC',   accent: '#4285F4', icon: '📄' },
    FORM:  { label: 'GOOGLE FORM',  accent: '#FBBC05', icon: '📋' },
    SUMMARY: { label: 'EMAIL SUMMARY', accent: '#A855F7', icon: '✉️' },
    TASK:  { label: 'PERSONAL TASK', accent: '#8B5CF6', icon: '✅' },
};

/* ─── Suggestion chips shown on empty state ────────────────────────────────── */
const SUGGESTIONS = [
    'Remind me to submit the progress report by tomorrow 5pm',
    'Create an Excel sheet for student attendance',
    'Create a feedback form for students',
    'Draft a notice document for hackathon',
    'Summarise my recent emails',
    'Set a task to review the new curriculum by Friday',
];

export default function AIAssistant() {
    const [messages, setMessages] = useState([]);
    const [currentPrompt, setCurrentPrompt] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const messagesEndRef = useRef(null);
    const textareaRef = useRef(null);

    const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    useEffect(() => { scrollToBottom(); }, [messages, isProcessing]);

    /* Auto-resize textarea */
    const handleTextareaInput = (e) => {
        setCurrentPrompt(e.target.value);
        e.target.style.height = 'auto';
        e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
    };

    /* ── Main send handler ─────────────────────────────────────────────────── */
    const handleSend = async (promptOverride) => {
        const text = (promptOverride || currentPrompt).trim();
        if (!text) return;

        setError('');
        setCurrentPrompt('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';

        setMessages(prev => [...prev, { type: 'USER', content: text }]);
        setIsProcessing(true);

        try {
            const res = await fetchWithAuth(`${API_URL}/ai/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: text }),
            });
            const json = await res.json();

            if (json.success) {
                setMessages(prev => [...prev, {
                    type: 'AI',
                    data: json.data,
                    id: Date.now(),
                    sent: false,
                }]);
            } else {
                setError(json.message || 'Something went wrong.');
            }
        } catch (e) {
            console.error(e);
            setError('Network error. Please try again.');
        } finally {
            setIsProcessing(false);
        }
    };

    /* ── Email confirm-send ────────────────────────────────────────────────── */
    const handleConfirmSend = async (msgId, data) => {
        setError('');
        if (!data.recipients?.length) {
            setError('No recipients found. The audience could not be matched to any users in the system.');
            return;
        }
        setIsProcessing(true);
        try {
            const res = await fetchWithAuth(`${API_URL}/ai/confirm-send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subject: data.subject,
                    body: data.body,
                    recipients: data.recipients,
                    scheduledAt: data.scheduledAt,
                }),
            });
            const json = await res.json();
            if (json.success) {
                setMessages(prev => prev.map(m => m.id === msgId ? { ...m, sent: true } : m));
                setSuccessMessage(json.message || 'Email sent!');
                setTimeout(() => setSuccessMessage(''), 4000);
            } else {
                setError(json.message || 'Failed to send.');
            }
        } catch (e) {
            setError('Error sending email.');
        } finally {
            setIsProcessing(false);
        }
    };

    const copyText = (text) => navigator.clipboard.writeText(text);

    /* ── Render helpers ──────────────────────────────────────────────────────  */
    const getDisplayBody = (body) => {
        if (!body) return '';
        const lines = String(body).split('\n');
        if (lines[0].trim().toLowerCase().startsWith('subject:')) {
            return lines.slice(1).join('\n').replace(/^\s+/, '');
        }
        return body;
    };

    /* ─── EMAIL card ──────────────────────────────────────────────────────── */
    const EmailCard = ({ msg }) => {
        const { data, id, sent } = msg;
        return (
            <div className="ai-card" style={{ borderTopColor: TYPE_META.EMAIL.accent }}>
                <div className="ai-card-header">
                    <span className="card-type-label" style={{ color: TYPE_META.EMAIL.accent }}>
                        {TYPE_META.EMAIL.icon} {TYPE_META.EMAIL.label}
                    </span>
                    <div className="card-actions">
                        <button className="icon-btn" title="Copy email content"
                            onClick={() => copyText(`Subject: ${data.subject}\n\n${getDisplayBody(data.body)}`)}>
                            <CopyIcon />
                        </button>
                        {!sent && (data.recipients?.length > 0) && (
                            <button className="icon-btn send-icon-btn" title="Send now"
                                onClick={() => handleConfirmSend(id, data)}>
                                <SendIcon />
                            </button>
                        )}
                    </div>
                </div>
                <div className="ai-card-content">
                    <div className="email-subject">Subject: {data.subject}</div>
                    <div className="email-body">{getDisplayBody(data.body)}</div>
                </div>
                <div className="ai-card-footer">
                    <div className="meta-row">
                        <span className="meta-item">
                            <UserIcon /> {data.recipients?.length || 0} {data.detectedAudience || 'recipients'}
                        </span>
                        {data.scheduledAt && !sent && (
                            <span className="meta-item" style={{ color: '#A855F7' }}>
                                <ClockIcon />
                                Scheduled: {new Date(data.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        )}
                    </div>
                    {sent && <span className="status-badge sent">✓ Sent</span>}
                    {data.scheduledAt && !sent && <span className="status-badge scheduled">🕐 Scheduled</span>}
                    {!sent && !data.scheduledAt && data.recipients?.length > 0 && (
                        <span className="status-badge draft">Draft — tap ✈ to send</span>
                    )}
                </div>
            </div>
        );
    };

    /* ─── SHEET / DOC / FORM card ────────────────────────────────────────── */
    const ArtifactCard = ({ msg }) => {
        const { data } = msg;
        const meta = TYPE_META[data.type] || TYPE_META.DOC;
        return (
            <div className="ai-card" style={{ borderTopColor: meta.accent }}>
                <div className="ai-card-header">
                    <span className="card-type-label" style={{ color: meta.accent }}>
                        {meta.icon} {meta.label}
                    </span>
                    {data.url && (
                        <div className="card-actions">
                            <button className="icon-btn" title="Copy link" onClick={() => copyText(data.url)}>
                                <CopyIcon />
                            </button>
                        </div>
                    )}
                </div>
                <div className="ai-card-content">
                    <div className="artifact-title">{data.title}</div>
                    {data.error ? (
                        <div className="artifact-error">⚠️ {data.error}</div>
                    ) : (
                        <div className="artifact-actions-row">
                            {data.url && (
                                <a href={data.url} target="_blank" rel="noreferrer" className="artifact-open-btn" style={{ background: meta.accent }}>
                                    <ExternalIcon /> Open {data.type === 'SHEET' ? 'Spreadsheet' : data.type === 'DOC' ? 'Document' : 'Form'}
                                </a>
                            )}
                            {data.editUrl && (
                                <a href={data.editUrl} target="_blank" rel="noreferrer" className="artifact-open-btn outlined">
                                    Edit Form
                                </a>
                            )}
                        </div>
                    )}
                </div>
                <div className="ai-card-footer">
                    <div className="meta-row">
                        {data.recipients?.length > 0 && (
                            <span className="meta-item"><UserIcon /> Shared with {data.recipients.length} {data.detectedAudience || 'users'}</span>
                        )}
                        {data.error && <span className="meta-item" style={{ color: '#EF4444' }}>Not authorized</span>}
                    </div>
                    {!data.error && data.url && <span className="status-badge created" style={{ background: `${meta.accent}22`, color: meta.accent }}>✓ Created</span>}
                </div>
            </div>
        );
    };

    /* ─── SUMMARY card ────────────────────────────────────────────────────── */
    const SummaryCard = ({ msg }) => {
        const { data } = msg;
        const meta = TYPE_META.SUMMARY;
        return (
            <div className="ai-card" style={{ borderTopColor: meta.accent }}>
                <div className="ai-card-header">
                    <span className="card-type-label" style={{ color: meta.accent }}>
                        {meta.icon} {meta.label}
                    </span>
                    <div className="card-actions">
                        <button className="icon-btn" title="Copy summary" onClick={() => copyText(data.summary)}>
                            <CopyIcon />
                        </button>
                    </div>
                </div>
                <div className="ai-card-content">
                    <div className="summary-text">{data.summary}</div>
                </div>
            </div>
        );
    };

    /* ─── TASK card ────────────────────────────────────────────────────────── */
    const TaskCard = ({ msg }) => {
        const { data } = msg;
        const meta = TYPE_META.TASK;
        return (
            <div className="ai-card" style={{ borderTopColor: meta.accent }}>
                <div className="ai-card-header">
                    <span className="card-type-label" style={{ color: meta.accent }}>
                        {meta.icon} {meta.label}
                    </span>
                </div>
                <div className="ai-card-content">
                    <div className="artifact-title">{data.title}</div>
                    <div className="meta-item" style={{ marginBottom: '0.5rem' }}>
                        <ClockIcon /> Status: {data.status}
                    </div>
                    {data.deadline && (
                        <div className="meta-item">
                            <ClockIcon /> Deadline: {new Date(data.deadline).toLocaleDateString()}
                        </div>
                    )}
                </div>
                <div className="ai-card-footer">
                    <span className="status-badge created" style={{ background: `${meta.accent}22`, color: meta.accent }}>✓ Task Created</span>
                </div>
            </div>
        );
    };

    /* ─── CHAT bubble (General Inquiry) ────────────────────────────────────── */
    const ChatBubble = ({ msg }) => {
        return (
            <div className="ai-chat-bubble">
                <div className="ai-chat-content">
                    {msg.data?.response}
                </div>
            </div>
        );
    };

    /* ─── Main render ─────────────────────────────────────────────────────── */
    return (
        <div className="ai-assistant-container">
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

                .ai-assistant-container {
                    max-width: 800px;
                    margin: 0 auto;
                    font-family: 'Inter', system-ui, sans-serif;
                    height: calc(100vh - 140px);
                    display: flex;
                    flex-direction: column;
                }

                /* ── Messages ── */
                .messages-flow {
                    flex: 1;
                    overflow-y: auto;
                    padding: 1rem 0 2rem;
                    display: flex;
                    flex-direction: column;
                    gap: 1.25rem;
                }
                .messages-flow::-webkit-scrollbar { width: 5px; }
                .messages-flow::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 10px; }

                /* ── Empty state ── */
                .empty-state {
                    margin: auto;
                    text-align: center;
                    padding: 2rem 1rem;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 1.5rem;
                }
                .empty-title { font-size: 1.6rem; font-weight: 800; color: var(--text-main); letter-spacing: -0.03em; margin: 0; }
                .empty-sub { font-size: 0.9rem; color: var(--text-muted); margin: -0.5rem 0 0; }
                .suggestion-chips { display: flex; flex-wrap: wrap; gap: 0.6rem; justify-content: center; max-width: 600px; }
                .suggestion-chip {
                    background: var(--bg-card);
                    border: 1px solid var(--border-color);
                    border-radius: 99px;
                    padding: 0.5rem 1rem;
                    font-size: 0.8rem;
                    font-weight: 500;
                    color: var(--text-muted);
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .suggestion-chip:hover { border-color: #6366F1; color: #6366F1; transform: translateY(-1px); }

                /* ── User bubble ── */
                .user-message {
                    align-self: flex-end;
                    max-width: 78%;
                    background: #2D2D35;
                    color: #E3E3E3;
                    padding: 0.85rem 1.25rem;
                    border-radius: 22px 22px 4px 22px;
                    font-size: 0.95rem;
                    line-height: 1.55;
                    box-shadow: 0 2px 12px rgba(0,0,0,0.15);
                }

                /* ── AI Chat bubble (General) ── */
                .ai-chat-bubble {
                    align-self: flex-start;
                    max-width: 85%;
                    background: rgba(255, 255, 255, 0.04);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    color: #D1D1D1;
                    padding: 1rem 1.5rem;
                    border-radius: 4px 22px 22px 22px;
                    font-size: 1rem;
                    line-height: 1.6;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                    animation: fadeSlideUp 0.3s ease;
                }

                /* ── AI card shell ── */
                .ai-card {
                    align-self: flex-start;
                    width: 100%;
                    background: var(--bg-card, #1E1E1E);
                    border: 1px solid rgba(255,255,255,0.07);
                    border-top: 3px solid #6366F1;
                    border-radius: 18px;
                    overflow: hidden;
                    box-shadow: 0 8px 30px rgba(0,0,0,0.25);
                    animation: fadeSlideUp 0.3s ease;
                }
                @keyframes fadeSlideUp {
                    from { opacity: 0; transform: translateY(10px); }
                    to   { opacity: 1; transform: translateY(0); }
                }

                .ai-card-header {
                    padding: 0.65rem 1.1rem;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: rgba(255,255,255,0.02);
                }
                .card-type-label {
                    font-size: 0.72rem;
                    font-weight: 800;
                    letter-spacing: 0.07em;
                    text-transform: uppercase;
                }
                .card-actions { display: flex; gap: 8px; }
                .icon-btn {
                    background: transparent;
                    border: none;
                    color: #8E8EA0;
                    cursor: pointer;
                    padding: 5px;
                    border-radius: 6px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                }
                .icon-btn:hover { background: rgba(255,255,255,0.1); color: #FFF; }
                .send-icon-btn:hover { background: rgba(234,67,53,0.15); color: #EA4335; }

                .ai-card-content { padding: 1.1rem 1.25rem; }
                .email-subject { font-size: 1rem; font-weight: 700; color: var(--text-main, #FFF); margin-bottom: 0.75rem; }
                .email-body {
                    font-size: 0.9rem;
                    line-height: 1.65;
                    white-space: pre-wrap;
                    color: #B0B0C0;
                    padding-bottom: 0.75rem;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                }

                /* ── Artifact card ── */
                .artifact-title { font-size: 1rem; font-weight: 700; color: var(--text-main, #FFF); margin-bottom: 1rem; }
                .artifact-error { color: #EF4444; font-size: 0.85rem; font-weight: 500; line-height: 1.5; }
                .artifact-actions-row { display: flex; gap: 0.75rem; flex-wrap: wrap; }
                .artifact-open-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 0.55rem 1.1rem;
                    border-radius: 10px;
                    font-size: 0.85rem;
                    font-weight: 700;
                    color: #FFF;
                    text-decoration: none;
                    transition: opacity 0.2s, transform 0.15s;
                }
                .artifact-open-btn:hover { opacity: 0.85; transform: translateY(-1px); }
                .artifact-open-btn.outlined {
                    background: transparent !important;
                    border: 1px solid rgba(255,255,255,0.15);
                    color: #DDD;
                }

                /* ── Summary ── */
                .summary-text {
                    font-size: 0.9rem;
                    line-height: 1.7;
                    color: #C0C0D0;
                    white-space: pre-wrap;
                }

                /* ── Card footer ── */
                .ai-card-footer {
                    padding: 0.65rem 1.25rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: rgba(0,0,0,0.08);
                }
                .meta-row { display: flex; gap: 1rem; align-items: center; }
                .meta-item { display: flex; align-items: center; gap: 5px; font-size: 0.75rem; font-weight: 600; color: #666; }
                .status-badge {
                    font-size: 0.7rem;
                    font-weight: 700;
                    padding: 3px 10px;
                    border-radius: 99px;
                }
                .status-badge.sent { background: rgba(16,185,129,0.12); color: #10B981; }
                .status-badge.scheduled { background: rgba(168,85,247,0.12); color: #A855F7; }
                .status-badge.draft { background: rgba(255,255,255,0.05); color: #888; }
                .status-badge.created { }

                /* ── Loading ── */
                .loader-card {
                    padding: 1rem 1.25rem;
                    background: var(--bg-card, #1E1E1E);
                    border-radius: 18px;
                    align-self: flex-start;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    color: #666;
                    font-size: 0.88rem;
                    font-weight: 500;
                    border: 1px solid rgba(255,255,255,0.06);
                }
                .dot-pulse { display: flex; gap: 5px; }
                .dot-pulse span {
                    width: 7px; height: 7px; border-radius: 50%;
                    background: #6366F1;
                    animation: pulse 1.2s ease-in-out infinite;
                }
                .dot-pulse span:nth-child(2) { animation-delay: 0.2s; }
                .dot-pulse span:nth-child(3) { animation-delay: 0.4s; }
                @keyframes pulse {
                    0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
                    40% { opacity: 1; transform: scale(1.1); }
                }

                /* ── Input area ── */
                .chat-input-wrapper { padding: 0.75rem 0 0; }
                .error-bar {
                    color: #EF4444;
                    font-size: 0.8rem;
                    font-weight: 600;
                    margin-bottom: 8px;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .input-box {
                    background: var(--bg-card, #2D2D35);
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 18px;
                    padding: 0.85rem 0.85rem 0.85rem 1.2rem;
                    display: flex;
                    gap: 10px;
                    align-items: flex-end;
                    box-shadow: 0 -4px 30px rgba(0,0,0,0.15);
                    transition: border-color 0.2s;
                }
                .input-box:focus-within { border-color: #6366F1; }
                .chat-textarea {
                    flex: 1;
                    background: transparent;
                    border: none;
                    color: var(--text-main, #EEE);
                    font-size: 0.95rem;
                    resize: none;
                    min-height: 24px;
                    max-height: 200px;
                    outline: none;
                    padding: 2px 0;
                    line-height: 1.5;
                    font-family: inherit;
                }
                .chat-textarea::placeholder { color: #555; }
                .send-btn {
                    background: #6366F1;
                    color: #FFF;
                    width: 38px;
                    height: 38px;
                    border-radius: 12px;
                    border: none;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: background 0.2s, transform 0.1s;
                    flex-shrink: 0;
                }
                .send-btn:hover:not(:disabled) { background: #5558e0; transform: scale(1.05); }
                .send-btn:disabled { background: #333; opacity: 0.5; cursor: not-allowed; }

                /* ── Toast ── */
                .chat-toast {
                    position: fixed;
                    bottom: 90px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: linear-gradient(135deg, #10B981, #059669);
                    color: white;
                    padding: 0.7rem 1.5rem;
                    border-radius: 99px;
                    font-weight: 700;
                    font-size: 0.88rem;
                    box-shadow: 0 8px 20px rgba(16,185,129,0.3);
                    z-index: 2000;
                    animation: toastIn 0.3s ease;
                }
                @keyframes toastIn {
                    from { opacity: 0; transform: translateX(-50%) translateY(10px); }
                    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
                }
            `}</style>

            {/* ── Messages area ── */}
            <div className="messages-flow">
                {messages.length === 0 && (
                    <div className="empty-state">
                        <div>
                            <h2 className="empty-title">✨ AI Chat Bot</h2>
                            <p className="empty-sub">I'm your universal assistant. Ask me anything a to z.</p>
                        </div>
                        <div className="suggestion-chips">
                            {SUGGESTIONS.map((s, i) => (
                                <button key={i} className="suggestion-chip" onClick={() => handleSend(s)}>
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map((msg, idx) => (
                    <React.Fragment key={idx}>
                        {msg.type === 'USER' ? (
                            <div className="user-message">{msg.content}</div>
                        ) : msg.data?.type === 'EMAIL' ? (
                            <EmailCard msg={msg} />
                        ) : msg.data?.type === 'SUMMARY' ? (
                            <SummaryCard msg={msg} />
                        ) : msg.data?.type === 'CHAT' ? (
                            <ChatBubble msg={msg} />
                        ) : msg.data?.type === 'TASK' ? (
                            <TaskCard msg={msg} />
                        ) : (
                            <ArtifactCard msg={msg} />
                        )}
                    </React.Fragment>
                ))}

                {isProcessing && (
                    <div className="loader-card">
                        <div className="dot-pulse">
                            <span /><span /><span />
                        </div>
                        <span>Thinking...</span>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* ── Input area ── */}
            <div className="chat-input-wrapper">
                {error && (
                    <div className="error-bar">⚠️ {error}</div>
                )}
                <div className="input-box">
                    <textarea
                        ref={textareaRef}
                        className="chat-textarea"
                        rows={1}
                        placeholder="e.g. remind me to submit report, create attendance sheet…"
                        value={currentPrompt}
                        onChange={handleTextareaInput}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                    />
                    <button
                        className="send-btn"
                        onClick={() => handleSend()}
                        disabled={isProcessing || !currentPrompt.trim()}
                    >
                        <SendIcon />
                    </button>
                </div>
            </div>

            {successMessage && <div className="chat-toast">✨ {successMessage}</div>}
        </div>
    );
}
