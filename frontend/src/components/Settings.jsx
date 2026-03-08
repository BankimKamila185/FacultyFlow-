import React, { useState, useEffect } from 'react';
import { API_URL } from '../config';
import { useAuth } from '../context/AuthContext';

export default function Settings() {
    const { currentUser } = useAuth();
    const [sheetUrl, setSheetUrl] = useState('');
    const [saving, setSaving] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (currentUser?.sheetUrl) {
            setSheetUrl(currentUser.sheetUrl);
        }
    }, [currentUser]);

    const handleSaveUrl = async () => {
        setSaving(true);
        setMessage('Saving URL...');
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/sync/sheet-url`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({ sheetUrl })
            });
            const data = await res.json();
            if (data.success) {
                setMessage('✅ Sheet URL saved successfully');
            } else {
                setMessage(`❌ Error: ${data.message}`);
            }
        } catch (error) {
            setMessage(`❌ Error: ${error.message}`);
        } finally {
            setSaving(false);
        }
    };

    const handleSync = async () => {
        setSyncing(true);
        setMessage('Syncing...');
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/sync`, {
                method: 'POST',
                headers: {
                    'Authorization': token ? `Bearer ${token}` : ''
                }
            });
            const data = await res.json();
            if (data.success) {
                setMessage(`✅ ${data.message}`);
            } else {
                setMessage(`❌ Error: ${data.message || data.error}`);
            }
        } catch (error) {
            setMessage(`❌ Network Error: ${error.message}`);
        } finally {
            setSyncing(false);
        }
    };

    return (
        <div className="content-section placeholder-section">
            <h3 style={{ marginBottom: '1.5rem', fontSize: '1.25rem' }}>System Settings</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '600px' }}>
                
                {/* ─── Google Sheet Configuration ────────────────────────── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <label style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-main)' }}>Master Google Sheet URL</label>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                        Provide the "Export as CSV" link for your Google Sheet. It should look like: <br/>
                        <code style={{ fontSize: '0.7rem', opacity: 0.7 }}>...d/SPREADSHEET_ID/export?format=csv</code>
                    </p>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input 
                            type="text" 
                            value={sheetUrl}
                            onChange={(e) => setSheetUrl(e.target.value)}
                            placeholder="https://docs.google.com/spreadsheets/d/.../export?format=csv"
                            style={{ 
                                flex: 1, 
                                padding: '0.6rem 1rem', 
                                borderRadius: '0.5rem', 
                                border: '1px solid var(--border-color)', 
                                background: 'var(--bg-main)',
                                color: 'var(--text-main)',
                                fontSize: '0.85rem'
                            }}
                        />
                        <button 
                            className="primary-button"
                            onClick={handleSaveUrl}
                            disabled={saving}
                            style={{ 
                                padding: '0.6rem 1.2rem', 
                                background: 'var(--primary)', 
                                color: 'white', 
                                border: 'none', 
                                borderRadius: '0.5rem', 
                                fontWeight: '600', 
                                cursor: 'pointer',
                                opacity: saving ? 0.7 : 1
                            }}
                        >
                            {saving ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </div>

                <hr style={{ width: '100%', border: 'none', borderTop: '1px solid var(--border-color)', margin: '0.5rem 0' }} />

                {/* ─── Sync Trigger ───────────────────────────────────────── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <label style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-main)' }}>Task Synchronization</label>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        Fetch latest tasks and updates from the configured Google Sheet.
                    </p>

                    <button
                        className="primary-button"
                        onClick={handleSync}
                        disabled={syncing}
                        style={{
                            padding: '0.6rem 1.2rem',
                            background: syncing ? 'var(--text-muted)' : '#10B981', // Emerald for success vibe
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.5rem',
                            fontWeight: '600',
                            cursor: syncing ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            width: 'fit-content'
                        }}
                    >
                        {syncing ? 'Syncing...' : '🔄 Sync Google Sheets Data'}
                    </button>
                </div>

                {message && (
                    <div style={{ 
                        padding: '1rem', 
                        background: 'var(--bg-card)', 
                        borderRadius: '0.5rem', 
                        border: '1px solid var(--border-color)',
                        fontSize: '0.85rem',
                        color: 'var(--text-main)'
                    }}>
                        {message}
                    </div>
                )}
            </div>
        </div>
    );
}
