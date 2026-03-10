import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';
import { fetchWithAuth } from '../utils/api';

// Mocks removed for live integration

export default function GoogleForms() {
    const { backendToken } = useAuth();
    const [forms, setForms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [newForm, setNewForm] = useState({ title: '', description: '' });
    const [creating, setCreating] = useState(false);
    const [status, setStatus] = useState(null);
    const [search, setSearch] = useState('');

    const fetchForms = async () => {
        try {
            const res = await fetchWithAuth(`${API_URL}/integrations/forms`);
            const data = await res.json();
            if (data.success) {
                setForms(data.data.map(f => ({
                    ...f,
                    color: '#673AB7',
                    responses: '?' 
                })));
            }
        } catch (err) {
            console.error("Error fetching forms:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchForms();
    }, []);

    const filtered = forms.filter(f => f.title.toLowerCase().includes(search.toLowerCase()));

    const handleCreateForm = async () => {
        if (!newForm.title) return;
        setCreating(true);
        try {
            const res = await fetchWithAuth(`${API_URL}/integrations/forms/create`, {
                method: 'POST',
                body: JSON.stringify({ title: newForm.title, description: newForm.description }),
            });
            const data = await res.json();
            if (data.success) {
                setStatus({ type: 'success', message: `Form "${newForm.title}" launched!` });
                fetchForms();
            } else setStatus({ type: 'error', message: data.error || 'Failed to create form' });
        } catch {
            setStatus({ type: 'error', message: "Connection failed." });
        }
        setCreating(false);
        setShowModal(false);
        setNewForm({ title: '', description: '' });
        setTimeout(() => setStatus(null), 4000);
    };

    return (
        <div className="workspace-panel">
            <div className="workspace-panel-header">
                <div className="workspace-brand">
                    <div className="workspace-icon" style={{ background: '#673AB7' }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                            <rect x="4" y="2" width="16" height="20" rx="3" stroke="white" strokeWidth="2" />
                            <path d="M8 8h1M8 12h1M8 16h1" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                            <path d="M11 8h5M11 12h5M11 16h5" stroke="white" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="workspace-title">Google Forms</h2>
                        <p className="workspace-subtitle">Gather faculty data & student responses</p>
                    </div>
                </div>
                <button className="btn-workspace" style={{ background: '#673AB7' }} onClick={() => setShowModal(true)}>
                    <span>+</span> New Form
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
                    placeholder="Search forms..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            <div className="docs-grid">
                {filtered.map(form => (
                    <div key={form.id} className="doc-card" style={{ '--doc-color': form.color }}>
                        <div className="doc-preview" style={{ background: '#F3E5F5' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: form.color, opacity: 0.1 }}></div>
                                </div>
                                <div className="doc-line" style={{ width: '60%', margin: '0 auto', background: form.color, opacity: 0.2 }}></div>
                            </div>
                            <div className="doc-type-badge" style={{ background: form.color }}>FORMS</div>
                        </div>
                        <div className="doc-info">
                            <div className="doc-title">{form.title}</div>
                            <div className="doc-meta">
                                <span className="doc-owner">{form.responses} Responses</span>
                                <span className="doc-time" style={{ color: form.status === 'Active' ? '#10B981' : '#EF4444', fontWeight: 700 }}>{form.status}</span>
                            </div>
                        </div>
                    </div>
                ))}

                <div className="doc-card doc-card-new" onClick={() => setShowModal(true)}>
                    <div className="doc-preview doc-preview-new">
                        <div className="doc-plus" style={{ color: '#673AB7' }}>+</div>
                    </div>
                    <div className="doc-info">
                        <div className="doc-title">Create Survey</div>
                        <div className="doc-meta"><span className="doc-time">Start from blank</span></div>
                    </div>
                </div>
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-card" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Create Google Form</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>Form Title</label>
                                <input
                                    className="form-input"
                                    placeholder="e.g. Research Ethics Survey"
                                    value={newForm.title}
                                    onChange={e => setNewForm(v => ({ ...v, title: e.target.value }))}
                                />
                            </div>
                            <div className="form-group">
                                <label>Description</label>
                                <textarea
                                    className="form-input form-textarea"
                                    placeholder="Tell your respondents what this form is about..."
                                    value={newForm.description}
                                    onChange={e => setNewForm(v => ({ ...v, description: e.target.value }))}
                                    rows={4}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                            <button className="btn-workspace-primary" style={{ background: '#673AB7' }} onClick={handleCreateForm} disabled={creating}>
                                {creating ? 'Creating...' : 'Launch Form'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
