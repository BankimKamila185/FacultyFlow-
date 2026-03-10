import React, { useState, useEffect, useRef } from 'react';
import { API_URL } from '../config';
import { fetchWithAuth } from '../utils/api';

export default function PromptEmail() {
    const [messages, setMessages] = useState([]);
    const [currentPrompt, setCurrentPrompt] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    
    // For auto-scrolling
    const messagesEndRef = useRef(null);
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isProcessing]);

    const handleGenerateDraft = async () => {
        if (!currentPrompt.trim()) return;

        setError('');
        const userPrompt = currentPrompt;
        setCurrentPrompt('');
        
        // Add user message to history
        setMessages(prev => [...prev, { type: 'USER', content: userPrompt }]);
        setIsProcessing(true);

        try {
            const res = await fetchWithAuth(`${API_URL}/ai/draft-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: userPrompt })
            });
            const data = await res.json();
            
            if (data.success) {
                // Add AI response to history
                setMessages(prev => [...prev, { 
                    type: 'AI', 
                    data: data.data,
                    id: Date.now() 
                }]);
            } else {
                setError(data.message || 'Draft generation failed.');
            }
        } catch (e) {
            console.error(e);
            setError('Something went wrong.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleConfirmSend = async (msgId, draftData) => {
        setError('');

        if (!draftData.subject || !draftData.body) {
            setError('Draft is missing a subject or body. Please edit the text and try again.');
            return;
        }

        if (!draftData.recipients || draftData.recipients.length === 0) {
            const audienceLabel = (draftData.detectedAudience || '').toLowerCase();
            const audienceText = audienceLabel ? `${audienceLabel} users` : 'matching users';
            setError(`No recipients found for this email. Make sure there are ${audienceText} in the system.`);
            return;
        }

        setIsProcessing(true);
        
        try {
            const res = await fetchWithAuth(`${API_URL}/ai/confirm-send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(draftData)
            });
            const data = await res.json();
            if (data.success) {
                setSuccessMessage(data.message);
                // Mark this specific message as sent
                setMessages(prev => prev.map(m => m.id === msgId ? { ...m, sent: true } : m));
                setTimeout(() => setSuccessMessage(''), 3000);
            } else {
                setError(data.message || 'Failed to send.');
            }
        } catch (e) {
            setError('Error confirming send.');
        } finally {
            setIsProcessing(false);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        // Simple visual feedback could be added here
    };

    const getDisplayBody = (body) => {
        if (!body) return '';
        const lines = String(body).split('\n');
        if (lines[0].trim().toLowerCase().startsWith('subject:')) {
            return lines.slice(1).join('\n').replace(/^\s+/, '');
        }
        return body;
    };

    return (
        <div className="chat-container">
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
                
                .chat-container { 
                    max-width: 800px; 
                    margin: 0 auto; 
                    font-family: 'Inter', system-ui, sans-serif; 
                    height: calc(100vh - 120px);
                    display: flex;
                    flex-direction: column;
                    padding: 1rem;
                }

                /* Messages Area */
                .messages-flow {
                    flex: 1;
                    overflow-y: auto;
                    padding-bottom: 2rem;
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }
                .messages-flow::-webkit-scrollbar { width: 6px; }
                .messages-flow::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }

                /* User Bubble */
                .user-message {
                    align-self: flex-end;
                    max-width: 80%;
                    background: #2D2D30;
                    color: #E3E3E3;
                    padding: 1rem 1.25rem;
                    border-radius: 24px 24px 4px 24px;
                    font-size: 0.95rem;
                    line-height: 1.5;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                }

                /* AI Response Card */
                .ai-card {
                    align-self: flex-start;
                    width: 100%;
                    background: #1E1E1E;
                    border: 1px solid rgba(255,255,255,0.08);
                    border-radius: 20px;
                    overflow: hidden;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                }
                .ai-card-header {
                    padding: 0.75rem 1.25rem;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: rgba(255,255,255,0.02);
                }
                .ai-card-header .title { font-size: 0.8rem; font-weight: 700; color: #8E8EA0; text-transform: uppercase; letter-spacing: 0.05em; }
                .ai-card-actions { display: flex; gap: 12px; }
                .icon-btn { 
                    background: transparent; 
                    border: none; 
                    color: #8E8EA0; 
                    cursor: pointer; 
                    padding: 4px;
                    border-radius: 6px;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .icon-btn:hover { background: rgba(255,255,255,0.1); color: #FFF; }
                
                .ai-card-content { padding: 1.25rem; color: #D1D1D1; }
                .email-subject { font-size: 1.1rem; font-weight: 700; color: #FFF; margin-bottom: 1rem; }
                .email-body { 
                    font-size: 0.95rem; 
                    line-height: 1.6; 
                    white-space: pre-wrap; 
                    color: #BBB;
                    padding-bottom: 1rem;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                }

                .ai-card-footer {
                    padding: 0.75rem 1.25rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: rgba(0,0,0,0.1);
                }
                .meta-item { display: flex; align-items: center; gap: 6px; font-size: 0.75rem; font-weight: 600; color: #666; }
                .status-badge { 
                    background: rgba(16, 185, 129, 0.1); 
                    color: #10B981; 
                    padding: 4px 10px; 
                    border-radius: 99px; 
                    font-size: 0.7rem; 
                    font-weight: 700; 
                }

                /* Input Area */
                .chat-input-wrapper {
                    padding: 1rem 0;
                    position: relative;
                }
                .input-box {
                    background: #2D2D30;
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 16px;
                    padding: 1rem;
                    display: flex;
                    gap: 12px;
                    align-items: flex-end;
                    box-shadow: 0 -10px 40px rgba(0,0,0,0.2);
                }
                .chat-textarea {
                    flex: 1;
                    background: transparent;
                    border: none;
                    color: white;
                    font-size: 1rem;
                    resize: none;
                    max-height: 200px;
                    outline: none;
                    padding: 4px 0;
                }
                .send-btn {
                    background: #FFF;
                    color: #000;
                    width: 36px;
                    height: 36px;
                    border-radius: 10px;
                    border: none;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: opacity 0.2s;
                }
                .send-btn:disabled { opacity: 0.3; cursor: not-allowed; }

                /* Loading State */
                .loader-card { padding: 1.25rem; background: #1E1E1E; border-radius: 20px; align-self: flex-start; display: flex; align-items: center; gap: 12px; color: #666; font-size: 0.9rem; }
                .dot-flashing {
                    position: relative; width: 6px; height: 6px; border-radius: 5px; background-color: #666; color: #666;
                    animation: dot-flashing 1s infinite linear alternate; animation-delay: 0.5s;
                }
                .dot-flashing::before, .dot-flashing::after {
                    content: ""; display: inline-block; position: absolute; top: 0;
                }
                .dot-flashing::before {
                    left: -12px; width: 6px; height: 6px; border-radius: 5px; background-color: #666; color: #666;
                    animation: dot-flashing 1s infinite linear alternate; animation-delay: 0s;
                }
                .dot-flashing::after {
                    left: 12px; width: 6px; height: 6px; border-radius: 5px; background-color: #666; color: #666;
                    animation: dot-flashing 1s infinite linear alternate; animation-delay: 1s;
                }
                @keyframes dot-flashing { 0% { background-color: #666; } 50%, 100% { background-color: #333; } }

                .toast { position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%); background: #10B981; color: white; padding: 0.75rem 1.5rem; border-radius: 99px; font-weight: 700; font-size: 0.9rem; box-shadow: 0 10px 20px rgba(0,0,0,0.2); z-index: 1000; }
            `}</style>

            <div className="messages-flow">
                {messages.length === 0 && (
                    <div style={{ marginTop: 'auto', textAlign: 'center', color: '#666', marginBottom: '2rem' }}>
                        <h2 style={{ color: '#FFF', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>AI Mail Assistant</h2>
                        <p style={{ fontSize: '0.9rem' }}>Type a prompt to generate professional emails instantly.</p>
                    </div>
                )}
                
                {messages.map((msg, idx) => (
                    <React.Fragment key={idx}>
                        {msg.type === 'USER' ? (
                            <div className="user-message">{msg.content}</div>
                        ) : (
                            <div className="ai-card">
                                <div className="ai-card-header">
                                    <span className="title">Email</span>
                                    <div className="ai-card-actions">
                                        <button className="icon-btn" title="Copy Content" onClick={() => copyToClipboard(msg.data.body)}>
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                        </button>
                                        {!msg.sent && (msg.data.recipients?.length || 0) > 0 && (
                                            <button className="icon-btn" title="Send Now" onClick={() => handleConfirmSend(msg.id, msg.data)}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="ai-card-content">
                                    <div className="email-subject">Subject: {msg.data.subject}</div>
                                    <div className="email-body">{getDisplayBody(msg.data.body)}</div>
                                </div>
                                <div className="ai-card-footer">
                                    <div className="meta-item">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                                        {msg.data.recipients?.length || 0} {msg.data.detectedAudience || 'Recipients'}
                                    </div>
                                    {msg.sent && <div className="status-badge">Email Sent</div>}
                                    {msg.data.scheduledAt && !msg.sent && (
                                        <div className="meta-item" style={{ color: '#A855F7' }}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                            Scheduled: {new Date(msg.data.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </React.Fragment>
                ))}

                {isProcessing && (
                    <div className="loader-card">
                        <div className="dot-flashing" />
                        <span>Generating your email...</span>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-wrapper">
                {error && <div style={{ color: '#ef4444', fontSize: '0.8rem', marginBottom: '8px', fontWeight: 600 }}>⚠️ {error}</div>}
                <div className="input-box">
                    <textarea 
                        className="chat-textarea"
                        placeholder="e.g. send remember to student tomorrow is a town hall at 11am to 1pm"
                        rows="1"
                        value={currentPrompt}
                        onChange={(e) => setCurrentPrompt(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleGenerateDraft();
                            }
                        }}
                    />
                    <button className="send-btn" onClick={handleGenerateDraft} disabled={isProcessing || !currentPrompt.trim()}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    </button>
                </div>
            </div>

            {successMessage && <div className="toast">✨ {successMessage}</div>}
        </div>
    );
}



