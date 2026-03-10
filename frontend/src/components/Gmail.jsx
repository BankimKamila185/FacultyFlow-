import React, { useState } from 'react';
import ApprovalRequests from './ApprovalRequests';
import FacultyCommunication from './FacultyCommunication';

export default function Gmail({ setActiveTab }) {
    const [activeSegment, setActiveSegment] = useState('Approvals');

    const segments = ['Approvals', 'Faculty'];

    return (
        <div className="gmail-container">
            <style>{`
        .gmail-container { display: flex; flex-direction: column; gap: 1.5rem; height: 100%; }
        .gmail-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 1rem; }
        .segment-nav { display: flex; gap: 1.5rem; }
        .segment-tab { cursor: pointer; color: var(--text-muted); font-weight: 500; font-size: 0.95rem; padding-bottom: 1rem; margin-bottom: -1rem; display: flex; align-items: center; gap: 0.5rem; transition: var(--transition); border-bottom: 2px solid transparent; }
        .segment-tab:hover { color: var(--text-main); }
        .segment-tab.active { color: #EA4335; border-bottom-color: #EA4335; }
        
        .gmail-content { flex: 1; padding-top: 1rem; }
        .placeholder-box { background: var(--bg-card); border: 1px dashed var(--border-color); border-radius: var(--radius-lg); padding: 3rem; text-align: center; color: var(--text-muted); }
      `}</style>

            <div className="gmail-header">
                <div className="segment-nav">
                    {segments.map(s => (
                        <div
                            key={s}
                            className={`segment-tab ${activeSegment === s ? 'active' : ''}`}
                            onClick={() => setActiveSegment(s)}
                        >
                            {s === 'Approvals' ? 'Approval Requests' : 'Faculty Communication'}
                        </div>
                    ))}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button 
                        className="btn-primary" 
                        style={{ background: '#EA4335' }}
                        onClick={() => window.open('https://mail.google.com/mail/u/0/#inbox', '_blank')}
                    >
                        Open Gmail
                    </button>
                    <button
                        className="btn-primary"
                        style={{ background: 'var(--primary)' }}
                        onClick={() => setActiveTab && setActiveTab('AI Mail')}
                    >
                        ✨ AI Mail Compose
                    </button>
                </div>
            </div>

            <div className="gmail-content">
                {activeSegment === 'Approvals' && <ApprovalRequests />}
                {activeSegment === 'Faculty' && <FacultyCommunication />}
            </div>
        </div>
    );
}
