import React, { useState } from 'react';
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
                // Clear state after short delay
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
        <div className="prompt-mail-root">
            <style>{`
                .pm-root { max-width: 880px; margin: 0 auto; display: flex; flex-direction: column; gap: 1.5rem; }
                .pm-header h2 { font-size: 1.8rem; font-weight: 900; letter-spacing: -0.04em; margin-bottom: 0.25rem; color: var(--text-main); }
                .pm-header p { color: var(--text-dim); font-size: 0.9rem; }
                .pm-card { background: var(--bg-card); border-radius: 24px; padding: 1.5rem 2rem; border: 1px solid var(--border-color); box-shadow: var(--shadow-sm); display: flex; flex-direction: column; gap: 1.25rem; }
                .pm-label { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-dim); font-weight: 700; margin-bottom: 0.4rem; }
                .pm-textarea { width: 100%; min-height: 140px; border-radius: 16px; border: 1px solid var(--border-color); padding: 0.9rem 1rem; font-size: 0.95rem; background: var(--bg-surface); color: var(--text-main); line-height: 1.5; }
                .pm-input-field { width: 100%; border-radius: 12px; border: 1px solid var(--border-color); padding: 0.75rem 1rem; background: var(--bg-surface); color: var(--text-main); font-size: 0.9rem; }
                .pm-row { display: flex; flex-wrap: wrap; gap: 1rem; align-items: flex-end; }
                .pm-send-btn { background: var(--gradient-primary); color: white; border: none; padding: 0.75rem 2.5rem; border-radius: 999px; font-weight: 750; cursor: pointer; box-shadow: var(--primary-glow) 0 6px 18px; font-size: 0.9rem; }
                .pm-back-btn { background: transparent; color: var(--text-dim); border: 1px solid var(--border-color); padding: 0.75rem 1.5rem; border-radius: 999px; font-weight: 600; cursor: pointer; font-size: 0.9rem; }
                .pm-success { background: #10B98115; color: #10B981; padding: 1rem; border-radius: 12px; font-weight: 600; text-align: center; }
                .pm-schedule-bar { display: flex; align-items: center; gap: 10px; padding: 0.75rem 1rem; background: var(--bg-surface); border: 1px solid var(--primary-glow); border-radius: 14px; margin-top: 5px; }
                .pm-recipient-tag { display: inline-block; padding: 4px 10px; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.75rem; margin: 2px; }
            `}</style>

            <div className="pm-header">
                <h2>AI Mail Composer</h2>
                <p>Describe your goal. We'll draft, schedule, and send it properly.</p>
            </div>

            <div className="pm-card">
                {step === 'INPUT' ? (
                    <>
                        <div>
                            <div className="pm-label">What is your email about?</div>
                            <textarea 
                                className="pm-textarea" 
                                placeholder="E.g. Send a reminder for tomorrow's lab at 3pm..."
                                value={prompt} onChange={e => setPrompt(e.target.value)}
                            />
                        </div>
                        <div className="pm-row">
                            <div style={{ flex: 1 }}>
                                <div className="pm-label">Recipients</div>
                                <select className="pm-input-field" value={audienceRole} onChange={e => setAudienceRole(e.target.value)}>
                                    <option value="FACULTY">All Faculty</option>
                                    <option value="HOD">HODs</option>
                                    <option value="STUDENT">Students</option>
                                    <option value="CUSTOM">Custom Emails</option>
                                </select>
                            </div>
                            {audienceRole === 'CUSTOM' && (
                                <div style={{ flex: 2 }}>
                                    <div className="pm-label">Enter Emails</div>
                                    <input className="pm-input-field" placeholder="a@b.com, c@d.com" value={customRecipients} onChange={e => setCustomRecipients(e.target.value)} />
                                </div>
                            )}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                            <button className="pm-send-btn" onClick={handleGenerateDraft} disabled={isProcessing}>
                                {isProcessing ? 'Thinking...' : 'Generate Advanced Draft'}
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                            <div className="pm-label">Subject</div>
                            <input className="pm-input-field" value={draft.subject} onChange={e => setDraft({...draft, subject: e.target.value})} />
                        </div>
                        <div>
                            <div className="pm-label">Email Body</div>
                            <textarea className="pm-textarea" value={draft.body} onChange={e => setDraft({...draft, body: e.target.value})} />
                        </div>
                        <div>
                            <div className="pm-label">Recipients ({draft.recipients.length})</div>
                            <div style={{ maxHeight: '60px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '5px' }}>
                                {draft.recipients.map(r => <span key={r} className="pm-recipient-tag">{r}</span>)}
                            </div>
                        </div>
                        
                        {draft.scheduledAt && (
                            <div>
                                <div className="pm-label">Smarter Scheduling Detected</div>
                                <div className="pm-schedule-bar">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Scheduled for: {new Date(draft.scheduledAt).toLocaleString()}</span>
                                    <button style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--danger)', fontSize: '0.8rem', cursor: 'pointer' }} onClick={() => setDraft({...draft, scheduledAt: null})}>Cancel Schedule</button>
                                </div>
                            </div>
                        )}

                        {successMessage && <div className="pm-success">{successMessage}</div>}
                        {error && <div style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{error}</div>}

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', alignItems: 'center' }}>
                            <button className="pm-back-btn" onClick={() => setStep('INPUT')}>Back to Edit Prompt</button>
                            <button className="pm-send-btn" onClick={handleConfirmSend} disabled={isProcessing}>
                                {isProcessing ? 'Sending...' : draft.scheduledAt ? 'Confirm & Schedule' : 'Confirm & Send Now'}
                            </button>
                        </div>
                    </>
                )}
                {error && step === 'INPUT' && <div style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{error}</div>}
            </div>
        </div>
    );
}


