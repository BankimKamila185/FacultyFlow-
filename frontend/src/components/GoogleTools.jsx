import React, { useState } from 'react';
import GoogleDocs from './GoogleDocs';
import GoogleSheets from './GoogleSheets';
import GoogleForms from './GoogleForms';
import Gmail from './Gmail';

export default function GoogleTools({ setActiveTab }) {
    const [activeTool, setActiveTool] = useState('Docs');

    return (
        <div className="ws-container">
            <div className="ws-subnav">
                {['Docs', 'Sheets', 'Forms', 'Gmail'].map(tool => (
                    <button
                        key={tool}
                        className={`ws-pill ${activeTool === tool ? 'active' : ''}`}
                        onClick={() => setActiveTool(tool)}
                        style={{ '--pill-color': tool === 'Docs' ? '#4285F4' : tool === 'Sheets' ? '#34A853' : tool === 'Forms' ? '#673AB7' : '#EA4335' }}
                    >
                        {tool}
                    </button>
                ))}
            </div>
            <div className="ws-panel-anim">
                {activeTool === 'Docs' && <GoogleDocs />}
                {activeTool === 'Sheets' && <GoogleSheets />}
                {activeTool === 'Forms' && <GoogleForms />}
                {activeTool === 'Gmail' && <Gmail setActiveTab={setActiveTab} />}
            </div>
        </div>
    );
}
