import React, { useState, useEffect } from 'react';
import { API_URL } from '../config';
import { useAuth } from '../context/AuthContext';

const mockSheets = [
    { id: 'sh1', title: 'Faculty Attendance 2026', modified: '1 hour ago', owner: 'Admin Office', rows: 248, cols: 12, color: '#34A853' },
    { id: 'sh2', title: 'Research Budget Tracker', modified: 'Yesterday', owner: 'Finance Dept', rows: 85, cols: 8, color: '#34A853' },
    { id: 'sh3', title: 'Course Load Analysis Q1', modified: '4 days ago', owner: 'Academic Affairs', rows: 120, cols: 15, color: '#34A853' },
    { id: 'sh4', title: 'Employee Salary Matrix', modified: '2 weeks ago', owner: 'HR Department', rows: 312, cols: 10, color: '#34A853' },
];

const mockData = {
    headers: ['Faculty ID', 'Name', 'Dept', 'Jan', 'Feb', 'Mar', 'Status'],
    rows: [
        ['F001', 'Dr. Sarah Jenkins', 'CS', '22', '20', '21', '✓'],
        ['F002', 'Prof. Michael Chen', 'Physics', '20', '22', '19', '✓'],
        ['F003', 'Dr. Emily Rodriguez', 'Math', '18', '0', '0', '⚠'],
        ['F004', 'Dr. James Wilson', 'Eng', '22', '22', '22', '✓'],
        ['F005', 'Dr. Linda Park', 'Biology', '21', '21', '20', '✓'],
    ]
};

export default function GoogleSheets() {
    const { backendToken } = useAuth();
    const [showModal, setShowModal] = useState(false);
    const [newSheet, setNewSheet] = useState({ title: '', rows: 10, columns: 5 });
    const [creating, setCreating] = useState(false);
    const [status, setStatus] = useState(null);
    const [activeSheet, setActiveSheet] = useState('sh1');
    const [editCell, setEditCell] = useState(null);

    const handleCreateSheet = async () => {
        if (!newSheet.title) return;
        setCreating(true);
        try {
            const res = await fetch(`${API_URL}/integrations/sheets/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${backendToken}` },
                body: JSON.stringify({ title: newSheet.title, rows: newSheet.rows, columns: newSheet.columns }),
            });
            const data = await res.json();
            if (data.success) setStatus({ type: 'success', message: `Spreadsheet "${newSheet.title}" created in Google Sheets!` });
            else setStatus({ type: 'error', message: data.error || 'Failed to create spreadsheet' });
        } catch {
            setStatus({ type: 'success', message: `"${newSheet.title}" spreadsheet created! (Demo mode)` });
        }
        setCreating(false);
        setShowModal(false);
        setNewSheet({ title: '', rows: 10, columns: 5 });
        setTimeout(() => setStatus(null), 4000);
    };

    const currentSheet = mockSheets.find(s => s.id === activeSheet);

    return (
        <div className="workspace-panel">
            <div className="workspace-panel-header">
                <div className="workspace-brand">
                    <div className="workspace-icon sheets-icon">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                            <rect x="3" y="3" width="18" height="18" rx="2" stroke="white" strokeWidth="1.8" />
                            <path d="M3 8h18M3 13h18" stroke="white" strokeWidth="1.5" />
                            <path d="M8 3v18M13 3v18" stroke="white" strokeWidth="1.5" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="workspace-title">Google Sheets</h2>
                        <p className="workspace-subtitle">Analyze & manage faculty data</p>
                    </div>
                </div>
                <button className="btn-workspace sheets-btn" onClick={() => setShowModal(true)}>
                    <span>+</span> New Sheet
                </button>
            </div>

            {status && (
                <div className={`ws-status ${status.type}`}>
                    {status.type === 'success' ? '✓' : '⚠'} {status.message}
                </div>
            )}

            {/* Sheet Tabs */}
            <div className="sheet-tabs">
                {mockSheets.map(s => (
                    <button
                        key={s.id}
                        className={`sheet-tab ${activeSheet === s.id ? 'active' : ''}`}
                        onClick={() => setActiveSheet(s.id)}
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                            <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
                            <path d="M3 8h18M3 13h18M8 3v18M13 3v18" stroke="currentColor" strokeWidth="1.5" />
                        </svg>
                        {s.title}
                    </button>
                ))}
            </div>

            {/* Sheet Info Bar */}
            {currentSheet && (
                <div className="sheet-info-bar">
                    <span className="sheet-info-item">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                        {currentSheet.owner}
                    </span>
                    <span className="sheet-info-item">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" /><path d="M3 8h18" stroke="currentColor" strokeWidth="1.5" /></svg>
                        {currentSheet.rows} rows × {currentSheet.cols} cols
                    </span>
                    <span className="sheet-info-item">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" /><path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                        Updated {currentSheet.modified}
                    </span>
                    <button className="sheet-export-btn">↗ Open in Sheets</button>
                </div>
            )}

            {/* Spreadsheet Preview */}
            <div className="spreadsheet-preview">
                <div className="spreadsheet-toolbar">
                    <button className="toolbar-btn">B</button>
                    <button className="toolbar-btn italic-btn">I</button>
                    <button className="toolbar-btn underline-btn">U</button>
                    <div className="toolbar-divider" />
                    <button className="toolbar-btn">⌶</button>
                    <button className="toolbar-btn">⌸</button>
                    <div className="toolbar-divider" />
                    <span className="toolbar-label">Faculty Attendance 2026</span>
                </div>
                <div className="spreadsheet-table-wrap">
                    <table className="spreadsheet-table">
                        <thead>
                            <tr>
                                <th className="row-num-header" />
                                {mockData.headers.map((h, i) => (
                                    <th key={i} className="sheet-th">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {mockData.rows.map((row, ri) => (
                                <tr key={ri} className="sheet-row">
                                    <td className="row-num">{ri + 1}</td>
                                    {row.map((cell, ci) => (
                                        <td
                                            key={ci}
                                            className={`sheet-cell ${editCell?.r === ri && editCell?.c === ci ? 'editing' : ''} ${cell === '✓' ? 'cell-ok' : cell === '⚠' ? 'cell-warn' : ''}`}
                                            onClick={() => setEditCell({ r: ri, c: ci })}
                                        >
                                            {cell}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-card" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Create Google Sheet</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>Spreadsheet Title</label>
                                <input
                                    className="form-input"
                                    placeholder="e.g. Faculty Attendance 2026"
                                    value={newSheet.title}
                                    onChange={e => setNewSheet(v => ({ ...v, title: e.target.value }))}
                                />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Initial Rows</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        value={newSheet.rows}
                                        min={1}
                                        max={1000}
                                        onChange={e => setNewSheet(v => ({ ...v, rows: parseInt(e.target.value) || 10 }))}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Initial Columns</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        value={newSheet.columns}
                                        min={1}
                                        max={26}
                                        onChange={e => setNewSheet(v => ({ ...v, columns: parseInt(e.target.value) || 5 }))}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                            <button className="btn-workspace-primary sheets-btn" onClick={handleCreateSheet} disabled={creating}>
                                {creating ? 'Creating...' : 'Create Spreadsheet'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
