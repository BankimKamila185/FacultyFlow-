import React, { useState, useEffect } from 'react';
import { API_URL } from '../config';
import { fetchWithAuth } from '../utils/api';

export default function PromptEmail() {
    const [prompt, setPrompt] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState('');
    
    // Step-related state
    const [step, setStep] = useState('INPUT'); // 'INPUT' or 'REVIEW'
    const [audienceRole, setAudienceRole] = useState('FACULTY');
    const [customRecipients, setCustomRecipients] = useState('');
    
    const [draft, setDraft] = useState({
        subject: '',
        body: '',
        recipients: [],
        scheduledAt: null
    });
    const [successMessage, setSuccessMessage] = useState('');

    // Re-fetch recipients when audience role changes in REVIEW step
    useEffect(() => {
        if (step === 'REVIEW' && audienceRole !== 'CUSTOM') {
             fetchRecipients(audienceRole);
        }
    }, [audienceRole, step]);

    const fetchRecipients = async (role) => {
        try {
            const res = await fetchWithAuth(`${API_URL}/ai/draft-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: 'Lookup only', audienceRole: role })
            });
            const data = await res.json();
            if (data.success) {
                setDraft(prev => ({ ...prev, recipients: data.data.recipients }));
            }
        } catch (e) { console.error("Recipient fetch fail", e); }
    };

    const handleGenerateDraft = async () => {
        setError('');
        setIsProcessing(true);

        if (!prompt.trim()) {
            setError('Please describe what you want to send.');
            setIsProcessing(false);
            return;
        }

        try {
            const res = await fetchWithAuth(`${API_URL}/ai/draft-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });
            const data = await res.json();
            if (data.success) {
                setDraft(data.data);
                if (data.data.detectedAudience) {
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
        
        let finalRecipients = draft.recipients;
        if (audienceRole === 'CUSTOM') {
            finalRecipients = customRecipients.split(',').map(e => e.trim()).filter(Boolean);
            if (!finalRecipients.length) {
                setError('Please enter custom email addresses.');
                setIsProcessing(false);
                return;
            }
        }

        try {
            const res = await fetchWithAuth(`${API_URL}/ai/confirm-send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...draft, recipients: finalRecipients })
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
                
                .pm-container { max-width: 900px; margin: 0 auto; font-family: 'Inter', system-ui, sans-serif; padding: 2rem 1rem; }
                .pm-header { margin-bottom: 2.5rem; text-align: center; }
                .pm-header h2 { font-size: 2.5rem; font-weight: 900; letter-spacing: -0.05em; background: linear-gradient(135deg, var(--text-main) 0%, var(--text-dim) 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 0.5rem; }
                .pm-header p { color: var(--text-dim); font-size: 1.1rem; font-weight: 500; opacity: 0.8; }
                .pm-glass-card { background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 32px; padding: 2.5rem; box-shadow: 0 20px 40px rgba(0,0,0,0.2); }
                .pm-group { margin-bottom: 1.5rem; }
                .pm-label { display: block; font-size: 0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: var(--primary-glow); margin-bottom: 0.75rem; opacity: 0.9; }
                .pm-textarea { width: 100%; min-height: 160px; background: rgba(0,0,0,0.2); border: 1px solid var(--border-color); border-radius: 20px; padding: 1.25rem; color: var(--text-main); font-size: 1rem; line-height: 1.6; resize: none; }
                .pm-input { width: 100%; background: rgba(0,0,0,0.2); border: 1px solid var(--border-color); border-radius: 14px; padding: 0.85rem 1.25rem; color: var(--text-main); font-size: 0.95rem; }
                .pm-schedule-toast { background: linear-gradient(90deg, #6366f1 0%, #a855f7 100%); color: white; padding: 1rem 1.5rem; border-radius: 20px; display: flex; align-items: center; gap: 12px; margin-top: 1rem; }
                .pm-action-bar { display: flex; justify-content: space-between; align-items: center; margin-top: 2rem; }
                .pm-primary-btn { background: var(--gradient-primary); color: white; border: none; padding: 1rem 2.5rem; border-radius: 99px; font-weight: 800; font-size: 1rem; cursor: pointer; box-shadow: 0 8px 16px rgba(0,0,0,0.3), var(--primary-glow) 0 4px 12px; }
                .pm-ghost-btn { background: transparent; border: 1px solid var(--border-color); color: var(--text-dim); padding: 0.85rem 1.5rem; border-radius: 99px; font-weight: 600; cursor: pointer; }
                .spinner-small { width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.8s linear infinite; }
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>

            <div className="pm-header">
                <h2>AI Mail Composer</h2>
                <p>Just type your goal. We'll handle the rest.</p>
            </div>

            <div className="pm-glass-card">
                {step === 'INPUT' ? (
                    <div>
                        <div className="pm-group">
                            <label className="pm-label">Your Instruction</label>
                            <textarea 
                                className="pm-textarea" 
                                style={{ minHeight: '200px' }}
                                placeholder="E.g. Send a reminder to all students about Friday's quiz tomorrow morning..."
                                value={prompt} onChange={e => setPrompt(e.target.value)}
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button className="pm-primary-btn" onClick={handleGenerateDraft} disabled={isProcessing}>
                                {isProcessing ? <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div className="spinner-small" /> Analyzing...</span> : 'Draft & Identify Audience'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div>
                        <div className="pm-group">
                            <label className="pm-label">Subject</label>
                            <input className="pm-input" value={draft.subject} onChange={e => setDraft({...draft, subject: e.target.value})} />
                        </div>
                        <div className="pm-group">
                            <label className="pm-label">Professional Draft</label>
                            <textarea className="pm-textarea" style={{ minHeight: '200px' }} value={draft.body} onChange={e => setDraft({...draft, body: e.target.value})} />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                            <div className="pm-group">
                                <label className="pm-label">Send To (AI Detected)</label>
                                <select className="pm-input" value={audienceRole} onChange={e => setAudienceRole(e.target.value)}>
                                    <option value="FACULTY">Faculty</option>
                                    <option value="HOD">HODs</option>
                                    <option value="STUDENT">Students</option>
                                    <option value="CUSTOM">Custom Emails</option>
                                </select>
                            </div>
                            <div className="pm-group">
                                <label className="pm-label">Recipient Stats</label>
                                <div style={{ fontSize: '0.9rem', color: draft.recipients.length ? '#10B981' : '#ef4444', fontWeight: 700, padding: '0.75rem 1rem', background: 'rgba(0,0,0,0.1)', borderRadius: '12px' }}>
                                    {draft.recipients.length} Recipient(s) Found
                                </div>
                            </div>
                        </div>

                        {audienceRole === 'CUSTOM' && (
                            <div className="pm-group">
                                <label className="pm-label">Enter Email List</label>
                                <input className="pm-input" placeholder="a@b.com, c@d.com..." value={customRecipients} onChange={e => setCustomRecipients(e.target.value)} />
                            </div>
                        )}

                        {draft.scheduledAt && (
                            <div className="pm-schedule-toast">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, opacity: 0.8 }}>Automatically Scheduled</div>
                                    <div style={{ fontSize: '1rem', fontWeight: 800 }}>{new Date(draft.scheduledAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</div>
                                </div>
                                <button style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '0.4rem 0.8rem', borderRadius: '10px', fontSize: '0.75rem', cursor: 'pointer' }} onClick={() => setDraft({...draft, scheduledAt: null})}>Cancel</button>
                            </div>
                        )}

                        {successMessage && <div style={{ background: '#10B98120', color: '#10B981', padding: '1rem', borderRadius: '16px', marginTop: '1.5rem', fontWeight: 700, textAlign: 'center' }}>✨ {successMessage}</div>}
                        {error && <div style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '1rem', fontWeight: 600 }}>⚠️ {error}</div>}

                        <div className="pm-action-bar">
                            <button className="pm-ghost-btn" onClick={() => setStep('INPUT')}>Edit Prompt</button>
                            <button className="pm-primary-btn" onClick={handleConfirmSend} disabled={isProcessing}>
                                {isProcessing ? 'Processing...' : draft.scheduledAt ? 'Confirm Schedule' : 'Send Now'}
                            </button>
                        </div>
                    </div>
                )}
                {error && step === 'INPUT' && <div style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '1rem', fontWeight: 600 }}>⚠️ {error}</div>}
            </div>
        </div>
    );
}



