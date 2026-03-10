import React, { useState, useEffect } from 'react';
import { API_URL } from '../config';
import { fetchWithAuth } from '../utils/api';

export default function PromptEmail() {
    const [prompt, setPrompt] = useState('');
    const [audienceRole, setAudienceRole] = useState('FACULTY');
    const [customRecipients, setCustomRecipients] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState('');
    
    // Step-related state
    const [step, setStep] = useState('INPUT'); // 'INPUT' or 'REVIEW'
    const [draft, setDraft] = useState({
        subject: '',
        body: '',
        recipients: [],
        scheduledAt: null
    });
    const [successMessage, setSuccessMessage] = useState('');

    const handleGenerateDraft = async () => {
        setError('');
        setIsProcessing(true);

        if (!prompt.trim()) {
            setError('Please describe what kind of email you want to send.');
            setIsProcessing(false);
            return;
        }

        let recipients = undefined;
        if (audienceRole === 'CUSTOM') {
            const parsed = customRecipients.split(',').map(e => e.trim()).filter(Boolean);
            if (!parsed.length) {
                setError('Please enter at least one email address.');
                setIsProcessing(false);
                return;
            }
            recipients = parsed;
        }

        try {
            const res = await fetchWithAuth(`${API_URL}/ai/draft-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    audienceRole: audienceRole === 'CUSTOM' ? undefined : audienceRole,
                    recipients
                })
            });
            const data = await res.json();
            if (data.success) {
                setDraft(data.data);
                // Auto-sync the dropdown if AI detected a better audience and we were on default
                if (data.data.detectedAudience && audienceRole === 'FACULTY' && !recipients) {
                    setAudienceRole(data.data.detectedAudience);
                }
                setStep('REVIEW');
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

    const handleConfirmSend = async () => {
        setError('');
        setIsProcessing(true);
        try {
            const res = await fetchWithAuth(`${API_URL}/ai/confirm-send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(draft)
            });
            const data = await res.json();
            if (data.success) {
                setSuccessMessage(data.message);
                setTimeout(() => {
                    setStep('INPUT');
                    setPrompt('');
                    setDraft({ subject: '', body: '', recipients: [], scheduledAt: null });
                    setSuccessMessage('');
                }, 3000);
            } else {
                setError(data.message || 'Failed to send.');
            }
        } catch (e) {
            setError('Error confirming send.');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="pm-container">
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
                
                .pm-container { 
                    max-width: 900px; 
                    margin: 0 auto; 
                    font-family: 'Inter', system-ui, sans-serif;
                    padding: 2rem 1rem;
                }
                
                .pm-header { margin-bottom: 2.5rem; text-align: center; }
                .pm-header h2 { 
                    font-size: 2.5rem; 
                    font-weight: 900; 
                    letter-spacing: -0.05em; 
                    background: linear-gradient(135deg, var(--text-main) 0%, var(--text-dim) 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    margin-bottom: 0.5rem;
                }
                .pm-header p { color: var(--text-dim); font-size: 1.1rem; font-weight: 500; opacity: 0.8; }
                
                .pm-glass-card {
                    background: rgba(255, 255, 255, 0.03);
                    backdrop-filter: blur(12px);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 32px;
                    padding: 2.5rem;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.2);
                    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                }
                
                .pm-group { margin-bottom: 1.5rem; }
                .pm-label { 
                    display: block; 
                    font-size: 0.75rem; 
                    font-weight: 800; 
                    text-transform: uppercase; 
                    letter-spacing: 0.1em; 
                    color: var(--primary-glow); 
                    margin-bottom: 0.75rem;
                    opacity: 0.9;
                }
                
                .pm-textarea { 
                    width: 100%; 
                    min-height: 160px; 
                    background: rgba(0,0,0,0.2); 
                    border: 1px solid var(--border-color); 
                    border-radius: 20px; 
                    padding: 1.25rem; 
                    color: var(--text-main); 
                    font-size: 1rem; 
                    line-height: 1.6;
                    transition: border-color 0.3s;
                    resize: none;
                }
                .pm-textarea:focus { border-color: var(--primary-glow); outline: none; }
                
                .pm-input { 
                    width: 100%; 
                    background: rgba(0,0,0,0.2); 
                    border: 1px solid var(--border-color); 
                    border-radius: 14px; 
                    padding: 0.85rem 1.25rem; 
                    color: var(--text-main); 
                    font-size: 0.95rem;
                }
                
                .pm-badge-row { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-top: 0.5rem; }
                .pm-badge { 
                    padding: 0.5rem 1rem; 
                    border-radius: 99px; 
                    background: var(--bg-surface); 
                    border: 1px solid var(--border-color); 
                    font-size: 0.8rem; 
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                
                .pm-schedule-toast {
                    background: linear-gradient(90deg, #6366f1 0%, #a855f7 100%);
                    color: white;
                    padding: 1rem 1.5rem;
                    border-radius: 20px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-top: 1rem;
                    box-shadow: 0 10px 20px rgba(99, 102, 241, 0.3);
                }
                
                .pm-action-bar { display: flex; justify-content: space-between; align-items: center; margin-top: 2rem; }
                
                .pm-primary-btn { 
                    background: var(--gradient-primary); 
                    color: white; 
                    border: none; 
                    padding: 1rem 2.5rem; 
                    border-radius: 99px; 
                    font-weight: 800; 
                    font-size: 1rem;
                    cursor: pointer;
                    box-shadow: 0 8px 16px rgba(0,0,0,0.3), var(--primary-glow) 0 4px 12px;
                    transition: transform 0.2s;
                }
                .pm-primary-btn:hover { transform: translateY(-2px); }
                .pm-primary-btn:active { transform: translateY(0); }
                .pm-primary-btn:disabled { opacity: 0.6; cursor: not-allowed; }
                
                .pm-ghost-btn { 
                    background: transparent; 
                    border: 1px solid var(--border-color); 
                    color: var(--text-dim); 
                    padding: 0.85rem 1.5rem; 
                    border-radius: 99px; 
                    font-weight: 600;
                    cursor: pointer;
                }
                
                .pm-shimmer {
                    animation: shimmer 2s infinite;
                    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent);
                    background-size: 200% 100%;
                }
                @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
            `}</style>

            <div className="pm-header">
                <h2>AI Mail Composer</h2>
                <p>Professional drafting. Smart scheduling. Instant delivery.</p>
            </div>

            <div className="pm-glass-card">
                {step === 'INPUT' ? (
                    <div className="fade-in">
                        <div className="pm-group">
                            <label className="pm-label">What's the message?</label>
                            <textarea 
                                className="pm-textarea" 
                                placeholder="E.g. Tell students the project deadline is extended to Friday 5pm..."
                                value={prompt} onChange={e => setPrompt(e.target.value)}
                            />
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                            <div className="pm-group">
                                <label className="pm-label">Send To</label>
                                <select className="pm-input" value={audienceRole} onChange={e => setAudienceRole(e.target.value)}>
                                    <option value="FACULTY">Faculty Group</option>
                                    <option value="HOD">Department Heads</option>
                                    <option value="STUDENT">Student List</option>
                                    <option value="CUSTOM">Specific Emails</option>
                                </select>
                            </div>
                            
                            {audienceRole === 'CUSTOM' && (
                                <div className="pm-group">
                                    <label className="pm-label">Recipient List</label>
                                    <input className="pm-input" placeholder="comma separated emails..." value={customRecipients} onChange={e => setCustomRecipients(e.target.value)} />
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                            <button className="pm-primary-btn" onClick={handleGenerateDraft} disabled={isProcessing}>
                                {isProcessing ? (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div className="spinner-small" /> Drafting with AI...
                                    </span>
                                ) : 'Generate Professional Email'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="fade-in">
                        <div className="pm-group">
                            <label className="pm-label">Subject Line</label>
                            <input className="pm-input" value={draft.subject} onChange={e => setDraft({...draft, subject: e.target.value})} />
                        </div>
                        
                        <div className="pm-group">
                            <label className="pm-label">Drafted Content</label>
                            <textarea 
                                className="pm-textarea" 
                                style={{ minHeight: '220px' }}
                                value={draft.body} onChange={e => setDraft({...draft, body: e.target.value})} 
                            />
                        </div>

                        <div className="pm-group">
                            <label className="pm-label">Audience Snapshot</label>
                            <div className="pm-badge-row">
                                <div className="pm-badge">
                                    <span style={{ opacity: 0.6 }}>Role:</span> {audienceRole}
                                </div>
                                <div className="pm-badge">
                                    <span style={{ opacity: 0.6 }}>Recipients:</span> {draft.recipients.length}
                                </div>
                                {draft.recipients.length > 0 && (
                                    <div className="pm-badge" style={{ borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981' }} /> Verified
                                    </div>
                                )}
                            </div>
                        </div>

                        {draft.scheduledAt && (
                            <div className="pm-schedule-toast sh-shimmer">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', opacity: 0.8 }}>Smart Schedule Detected</div>
                                    <div style={{ fontSize: '1rem', fontWeight: 800 }}>{new Date(draft.scheduledAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</div>
                                </div>
                                <button 
                                    style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '0.4rem 0.8rem', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer' }}
                                    onClick={() => setDraft({...draft, scheduledAt: null})}
                                >
                                    Cancel
                                </button>
                            </div>
                        )}

                        {successMessage && (
                            <div style={{ background: '#10B98120', color: '#10B981', padding: '1rem', borderRadius: '16px', marginTop: '1.5rem', fontWeight: 700, textAlign: 'center', border: '1px solid #10B98140' }}>
                                ✨ {successMessage}
                            </div>
                        )}
                        
                        {error && <div style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '1rem', fontWeight: 600 }}>⚠️ {error}</div>}

                        <div className="pm-action-bar">
                            <button className="pm-ghost-btn" onClick={() => setStep('INPUT')}>Back to Draft</button>
                            <button className="pm-primary-btn" onClick={handleConfirmSend} disabled={isProcessing}>
                                {isProcessing ? 'Sending...' : draft.scheduledAt ? 'Confirm & Schedule' : 'Send Immediately'}
                            </button>
                        </div>
                    </div>
                )}
                {error && step === 'INPUT' && <div style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '1rem', fontWeight: 600 }}>⚠️ {error}</div>}
            </div>
        </div>
    );
}


