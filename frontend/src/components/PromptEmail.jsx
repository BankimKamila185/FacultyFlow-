import React, { useState } from 'react';
import { API_URL } from '../config';
import { fetchWithAuth } from '../utils/api';

export default function PromptEmail() {
    const [prompt, setPrompt] = useState('');
    const [audienceRole, setAudienceRole] = useState('FACULTY');
    const [customRecipients, setCustomRecipients] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    const handleSend = async () => {
        setError('');
        setResult(null);

        if (!prompt.trim()) {
            setError('Please describe what kind of email you want to send.');
            return;
        }

        let recipients = undefined;
        if (audienceRole === 'CUSTOM') {
            const parsed = customRecipients
                .split(',')
                .map(e => e.trim())
                .filter(Boolean);
            if (!parsed.length) {
                setError('Please enter at least one email address.');
                return;
            }
            recipients = parsed;
        }

        setIsSending(true);
        try {
            const res = await fetchWithAuth(`${API_URL}/ai/prompt-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    audienceRole: audienceRole === 'CUSTOM' ? undefined : audienceRole,
                    recipients
                })
            });
            const data = await res.json();
            if (!data.success) {
                setError(data.message || 'Failed to send email.');
            } else {
                setResult(data.data);
            }
        } catch (e) {
            console.error('Prompt-email error', e);
            setError('Something went wrong while sending the email.');
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="prompt-mail-root">
            <style>{`
                .prompt-mail-root {
                    max-width: 880px;
                    margin: 0 auto;
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }
                .pm-header h2 {
                    font-size: 1.8rem;
                    font-weight: 900;
                    letter-spacing: -0.04em;
                    margin-bottom: 0.25rem;
                    color: var(--text-main);
                }
                .pm-header p {
                    color: var(--text-dim);
                    font-size: 0.9rem;
                }
                .pm-card {
                    background: var(--bg-card);
                    border-radius: 24px;
                    padding: 1.5rem 1.75rem;
                    border: 1px solid var(--border-color);
                    box-shadow: var(--shadow-sm);
                    display: flex;
                    flex-direction: column;
                    gap: 1.25rem;
                }
                .pm-label {
                    font-size: 0.8rem;
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                    color: var(--text-dim);
                    font-weight: 700;
                    margin-bottom: 0.4rem;
                }
                .pm-textarea {
                    width: 100%;
                    min-height: 140px;
                    border-radius: 16px;
                    border: 1px solid var(--border-color);
                    padding: 0.9rem 1rem;
                    font-size: 0.9rem;
                    resize: vertical;
                    background: var(--bg-surface);
                    color: var(--text-main);
                }
                .pm-row {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 1rem;
                    align-items: flex-end;
                }
                .pm-select,
                .pm-input {
                    border-radius: 14px;
                    border: 1px solid var(--border-color);
                    padding: 0.6rem 0.9rem;
                    background: var(--bg-surface);
                    color: var(--text-main);
                    font-size: 0.85rem;
                }
                .pm-select {
                    min-width: 180px;
                }
                .pm-input {
                    flex: 1;
                }
                .pm-actions {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 0.75rem;
                }
                .pm-hint {
                    font-size: 0.78rem;
                    color: var(--text-muted);
                }
                .pm-send-btn {
                    background: var(--gradient-primary);
                    color: white;
                    border: none;
                    padding: 0.7rem 1.8rem;
                    border-radius: 999px;
                    font-size: 0.9rem;
                    font-weight: 750;
                    cursor: pointer;
                    box-shadow: var(--primary-glow) 0 6px 18px;
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                .pm-send-btn:disabled {
                    opacity: 0.7;
                    cursor: not-allowed;
                    box-shadow: none;
                }
                .pm-error {
                    color: var(--danger);
                    font-size: 0.8rem;
                }
                .pm-preview {
                    margin-top: 0.5rem;
                    border-top: 1px dashed var(--border-color);
                    padding-top: 1rem;
                    font-size: 0.85rem;
                }
                .pm-preview h4 {
                    font-size: 0.9rem;
                    font-weight: 800;
                    margin-bottom: 0.35rem;
                }
                .pm-preview pre {
                    white-space: pre-wrap;
                    background: var(--bg-surface);
                    padding: 0.75rem 0.9rem;
                    border-radius: 12px;
                    border: 1px solid var(--border-color);
                    font-size: 0.82rem;
                }
            `}</style>

            <div className="pm-header">
                <h2>AI Mail Composer</h2>
                <p>
                    Describe the email you want to send and who it should go to.
                    We&apos;ll draft and send it automatically from your institution Gmail.
                </p>
            </div>

            <div className="pm-card">
                <div>
                    <div className="pm-label">Email Instruction</div>
                    <textarea
                        className="pm-textarea"
                        placeholder='E.g. "Send a gentle reminder to all students about tomorrow&apos;s lab submission deadline."'
                        value={prompt}
                        onChange={e => setPrompt(e.target.value)}
                    />
                </div>

                <div>
                    <div className="pm-label">Recipients</div>
                    <div className="pm-row">
                        <select
                            className="pm-select"
                            value={audienceRole}
                            onChange={e => setAudienceRole(e.target.value)}
                        >
                            <option value="FACULTY">All Faculty</option>
                            <option value="HOD">HOD / Department Heads</option>
                            <option value="STUDENT">Students (role = STUDENT)</option>
                            <option value="CUSTOM">Custom email list</option>
                        </select>

                        {audienceRole === 'CUSTOM' && (
                            <input
                                className="pm-input"
                                placeholder="Enter email addresses, separated by commas"
                                value={customRecipients}
                                onChange={e => setCustomRecipients(e.target.value)}
                            />
                        )}
                    </div>
                </div>

                {error && <div className="pm-error">{error}</div>}

                <div className="pm-actions">
                    <div className="pm-hint">
                        Tip: Keep your instruction specific – mention course, section, topic or tone if needed.
                    </div>
                    <button
                        className="pm-send-btn"
                        onClick={handleSend}
                        disabled={isSending}
                    >
                        {isSending ? 'Sending...' : 'Generate & Send'}
                    </button>
                </div>

                {result && (
                    <div className="pm-preview">
                        <h4>Last email snapshot</h4>
                        <div style={{ marginBottom: '0.35rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Subject: <strong>{result.subject}</strong> &mdash; Sent to {result.recipients?.length || 0} recipient(s)
                        </div>
                        <pre>{result.body}</pre>
                    </div>
                )}
            </div>
        </div>
    );
}

