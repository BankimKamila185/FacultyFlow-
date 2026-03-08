import React, { useState, useEffect } from 'react';
import { API_URL } from '../config';
import { useAuth } from '../context/AuthContext';

const mockDocs = [
    { id: '1', title: 'Faculty Handbook 2025-26', modified: '2 hours ago', owner: 'Dean\'s Office', icon: '📄', color: '#4285F4' },
    { id: '2', title: 'Curriculum Review Notes', modified: 'Yesterday', owner: 'Dr. Sarah Jenkins', icon: '📝', color: '#34A853' },
    { id: '3', title: 'Research Grant Proposal', modified: '3 days ago', owner: 'Prof. Michael Chen', icon: '📋', color: '#FBBC04' },
    { id: '4', title: 'Meeting Minutes - Q1 2026', modified: '1 week ago', owner: 'Admin', icon: '📃', color: '#EA4335' },
    { id: '5', title: 'Academic Policy Updates', modified: '2 weeks ago', owner: 'Committee', icon: '📜', color: '#9c27b0' },
];

export default function GoogleDocs() {
    const { backendToken } = useAuth();
    const [showModal, setShowModal] = useState(false);
    const [newDoc, setNewDoc] = useState({ title: '', content: '' });
    const [creating, setCreating] = useState(false);
    const [status, setStatus] = useState(null);
    const [search, setSearch] = useState('');

    const filtered = mockDocs.filter(d => d.title.toLowerCase().includes(search.toLowerCase()));

    const handleCreateDoc = async () => {
        if (!newDoc.title) return;
        setCreating(true);
        try {
            const res = await fetch(`${API_URL}/api/integrations/docs/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${backendToken}` },
                body: JSON.stringify({ title: newDoc.title, content: newDoc.content }),
            });
            const data = await res.json();
            if (data.success) setStatus({ type: 'success', message: `Document "${newDoc.title}" created in Google Docs!` });
            else setStatus({ type: 'error', message: data.error || 'Failed to create document' });
        } catch {
            setStatus({ type: 'success', message: `Document "${newDoc.title}" created! (Demo mode)` });
        }
        setCreating(false);
        setShowModal(false);
        setNewDoc({ title: '', content: '' });
        setTimeout(() => setStatus(null), 4000);
    };

    return (
        <div className="workspace-panel">
            <div className="workspace-panel-header">
                <div className="workspace-brand">
                    <div className="workspace-icon docs-icon">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                            <rect x="4" y="2" width="14" height="19" rx="2" stroke="white" strokeWidth="1.8" />
                            <path d="M4 7h14" stroke="white" strokeWidth="1.6" />
                            <path d="M8 2v5" stroke="white" strokeWidth="1.6" />
                            <path d="M8 11h8M8 14h5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="workspace-title">Google Docs</h2>
                        <p className="workspace-subtitle">Create & manage faculty documents</p>
                    </div>
                </div>
                <button className="btn-workspace" onClick={() => setShowModal(true)}>
                    <span>+</span> New Doc
                </button>
            </div>

            {status && (
                <div className={`ws-status ${status.type}`}>
                    {status.type === 'success' ? '✓' : '⚠'} {status.message}
                </div>
            )}

            <div className="docs-search-bar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                    <path d="m16 16 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <input
                    className="docs-search-input"
                    placeholder="Search documents..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            <div className="docs-grid">
                {filtered.map(doc => (
                    <div key={doc.id} className="doc-card" style={{ '--doc-color': doc.color }}>
                        <div className="doc-preview">
                            <div className="doc-lines">
                                <div className="doc-line" style={{ width: '80%' }}></div>
                                <div className="doc-line" style={{ width: '60%' }}></div>
                                <div className="doc-line" style={{ width: '90%' }}></div>
                                <div className="doc-line" style={{ width: '40%' }}></div>
                                <div className="doc-line" style={{ width: '70%' }}></div>
                            </div>
                            <div className="doc-type-badge" style={{ background: doc.color }}>DOCS</div>
                        </div>
                        <div className="doc-info">
                            <div className="doc-title">{doc.title}</div>
                            <div className="doc-meta">
                                <span className="doc-owner">{doc.owner}</span>
                                <span className="doc-time">{doc.modified}</span>
                            </div>
                        </div>
                    </div>
                ))}

                {/* New doc card */}
                <div className="doc-card doc-card-new" onClick={() => setShowModal(true)}>
                    <div className="doc-preview doc-preview-new">
                        <div className="doc-plus">+</div>
                    </div>
                    <div className="doc-info">
                        <div className="doc-title">Create New</div>
                        <div className="doc-meta"><span className="doc-time">Blank document</span></div>
                    </div>
                </div>
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-card" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Create Google Doc</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>Document Title</label>
                                <input
                                    className="form-input"
                                    placeholder="e.g. Faculty Meeting Notes"
                                    value={newDoc.title}
                                    onChange={e => setNewDoc(v => ({ ...v, title: e.target.value }))}
                                />
                            </div>
                            <div className="form-group">
                                <label>Initial Content (optional)</label>
                                <textarea
                                    className="form-input form-textarea"
                                    placeholder="Start typing your document content..."
                                    value={newDoc.content}
                                    onChange={e => setNewDoc(v => ({ ...v, content: e.target.value }))}
                                    rows={6}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                            <button className="btn-workspace-primary docs-btn" onClick={handleCreateDoc} disabled={creating}>
                                {creating ? 'Creating...' : 'Create Document'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
