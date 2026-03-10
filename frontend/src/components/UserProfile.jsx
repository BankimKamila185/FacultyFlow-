import React, { useState, useEffect } from 'react';
import { API_URL } from '../config';
import { useAuth } from '../context/AuthContext';
import { fetchWithAuth, getAvatarUrl } from '../utils/api';
import './UserProfile.css';

export default function UserProfile({ theme, toggleTheme }) {
    const { currentUser, devUser, backendUser, logout } = useAuth();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({
        name: '',
        bio: '',
        photoUrl: '',
        theme: 'light',
        department: ''
    });
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    const AVATAR_SEEDS = [
        'Felix', 'Aneka', 'Mason', 'Lilly', 'Jack', 'Mia', 
        'Avery', 'Caleb', 'Evelyn', 'Leo', 'Nova', 'Silas'
    ];

    const fetchProfile = async () => {
        try {
            const email = (devUser?.email || currentUser?.email || backendUser?.email || '').toLowerCase();
            if (!email) return;
            const res = await fetchWithAuth(`${API_URL}/users/profile/${email}`);
            const data = await res.json();
            if (data.success) {
                setProfile(data.profile);
                setEditData({
                    name: data.profile.user.name || '',
                    bio: data.profile.user.bio || '',
                    photoUrl: data.profile.user.photoUrl || '',
                    theme: data.profile.user.theme || 'light',
                    department: data.profile.user.department || ''
                });
            }
        } catch (error) {
            console.error("Error fetching profile:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProfile();
    }, [currentUser, devUser, backendUser]);

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setMessage('');
        try {
            const res = await fetchWithAuth(`${API_URL}/users/profile`, {
                method: 'PUT',
                body: JSON.stringify(editData)
            });
            const data = await res.json();
            if (data.success) {
                setMessage('Profile updated successfully!');
                setIsEditing(false);
                fetchProfile();
            } else {
                setMessage(data.message || 'Failed to update profile');
            }
        } catch (error) {
            setMessage('Error updating profile');
        } finally {
            setSaving(false);
        }
    };

    const handleLogout = () => {
        logout();
    };

    if (loading) return <div className="profile-loading">Loading Intel...</div>;

    const renderHeader = (userData) => (
        <div className="profile-header">
            <div className="profile-avatar-wrapper">
                <img 
                    src={userData?.photoUrl || getAvatarUrl(userData?.email)} 
                    alt="Profile" 
                    className="profile-main-avatar"
                />
            </div>
            
            <div className="profile-identity">
                <h1 className="profile-name">{userData?.name || userData?.email?.split('@')[0]}</h1>
                <div className="profile-tags">
                    <span className="profile-role-tag">{userData?.role || 'Guest'}</span>
                    {userData?.department && (
                        <span className="profile-dept-tag">{userData?.department}</span>
                    )}
                </div>
                <p className="profile-email-sub">{userData?.email}</p>
            </div>

            <div className="profile-actions">
                <div className="profile-main-actions">
                    <button className="btn-theme-toggle-profile" onClick={toggleTheme} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
                        {theme === 'light' ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                            </svg>
                        ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="5" />
                                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                            </svg>
                        )}
                    </button>
                    {userData && <button className="btn-edit-profile" onClick={() => setIsEditing(true)}>Edit Profile</button>}
                    <button className="btn-logout-profile" onClick={handleLogout}>Logout</button>
                </div>
            </div>
        </div>
    );

    if (!profile) {
        return (
            <div className="user-profile-container">
                <div className="profile-glass-card">
                {renderHeader({
                    email: devUser?.email || currentUser?.email || backendUser?.email,
                    name: devUser?.name || currentUser?.displayName || backendUser?.name || (devUser?.email || currentUser?.email || backendUser?.email || '').split('@')[0],
                    photoUrl: devUser?.photoUrl || currentUser?.photoURL || backendUser?.photoUrl,
                    role: devUser?.role || backendUser?.role || 'Guest'
                })}
                    <div className="profile-error-state" style={{ 
                        padding: '4rem 2rem', 
                        textAlign: 'center',
                        background: 'rgba(255, 255, 255, 0.05)',
                        borderRadius: '24px',
                        marginTop: '2rem',
                        border: '1px dashed var(--border-color)'
                    }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🛡️</div>
                        <h2 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>User not found in registry</h2>
                        <p style={{ color: 'var(--text-dim)', maxWidth: '400px', margin: '0 auto' }}>
                            Your account hasn't been fully registered in the faculty database. 
                            Please contact the administrator or try logging out and back in with an authorized account.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    const { user, stats, tasksBySprint } = profile;

    return (
        <div className="user-profile-container">
            <div className="profile-glass-card">
                {/* View Mode Header */}
                {renderHeader(user)}

                {message && <div className={`profile-message ${message.includes('success') ? 'success' : 'error'}`}>{message}</div>}

                <div className="profile-bio-section">
                    <h3>About Me</h3>
                    <p className="profile-bio">{user.bio || "No biography provided. Click Edit Profile to add one."}</p>
                </div>

                <div className="profile-stats-grid">
                    <div className="stat-p-card">
                        <span className="stat-v">{stats.total}</span>
                        <span className="stat-l">Assigned</span>
                    </div>
                    <div className="stat-p-card success">
                        <span className="stat-v">{stats.completed}</span>
                        <span className="stat-l">Completed</span>
                    </div>
                    <div className="stat-p-card primary">
                        <span className="stat-v">{stats.inProgress}</span>
                        <span className="stat-l">Active</span>
                    </div>
                    <div className="stat-p-card danger">
                        <span className="stat-v">{stats.pending}</span>
                        <span className="stat-l">Pending</span>
                    </div>
                </div>

                <div className="profile-tasks-section">
                    <h2 className="section-title">Master Assignment Registry</h2>
                    {Object.keys(tasksBySprint).length === 0 ? (
                        <p className="no-tasks">No tasks found in your registry.</p>
                    ) : (
                        Object.entries(tasksBySprint).map(([sprint, tasks]) => (
                            <div key={sprint} className="sprint-group">
                                <h4 className="sprint-title">{sprint}</h4>
                                <div className="sprint-tasks-list">
                                    {tasks.map(task => (
                                        <div key={task.id} className="task-mini-card">
                                            <div className="task-mini-info">
                                                <span className="task-mini-title">{task.title}</span>
                                                <span className="task-mini-meta">{task.subEvent} • {task.myRole}</span>
                                            </div>
                                            <div className={`task-mini-status ${task.status.toLowerCase()}`}>
                                                {task.status}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Premium Full Edit Modal */}
            {isEditing && (
                <div className="edit-modal-overlay" onClick={() => setIsEditing(false)}>
                    <div className="edit-modal-content" onClick={e => e.stopPropagation()}>
                        <div className="edit-modal-header">
                            <div>
                                <h2>Edit Profile</h2>
                                <p>Personalize your faculty presence</p>
                            </div>
                            <button className="btn-close-edit" onClick={() => setIsEditing(false)}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>

                        <div className="edit-modal-body">
                            <div className="edit-section">
                                <label>Profile Identity</label>
                                <div className="edit-input-group">
                                    <input 
                                        type="text" 
                                        value={editData.name} 
                                        onChange={(e) => setEditData({...editData, name: e.target.value})}
                                        placeholder="Full Name"
                                        className="modal-input"
                                    />
                                    <input 
                                        type="text" 
                                        value={editData.department} 
                                        onChange={(e) => setEditData({...editData, department: e.target.value})}
                                        placeholder="Department"
                                        className="modal-input"
                                    />
                                </div>
                            </div>

                            <div className="edit-section">
                                <label>Avatar Selection</label>
                                <div className="modal-avatar-grid">
                                    {AVATAR_SEEDS.map(seed => {
                                        const url = getAvatarUrl(seed);
                                        return (
                                            <div 
                                                key={seed} 
                                                className={`modal-avatar-option ${editData.photoUrl === url ? 'selected' : ''}`}
                                                onClick={() => setEditData({...editData, photoUrl: url})}
                                            >
                                                <img src={url} alt={seed} />
                                                {editData.photoUrl === url && <div className="avatar-check">✓</div>}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="edit-section">
                                <label>About Me</label>
                                <textarea 
                                    value={editData.bio} 
                                    onChange={(e) => setEditData({...editData, bio: e.target.value})}
                                    placeholder="Tell us about your role and expertise..."
                                    className="modal-textarea"
                                />
                            </div>

                            <div className="edit-section">
                                <label>Theme Preference</label>
                                <div className="modal-theme-grid">
                                    {['light', 'dark', 'glass'].map(t => (
                                        <button 
                                            key={t}
                                            className={`modal-theme-btn ${editData.theme === t ? 'active' : ''}`}
                                            onClick={() => setEditData({...editData, theme: t})}
                                        >
                                            <span className={`theme-preview ${t}`}></span>
                                            {t.charAt(0).toUpperCase() + t.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="edit-modal-footer">
                            <button className="btn-modal-cancel" onClick={() => setIsEditing(false)}>Discard Changes</button>
                            <button className="btn-modal-save" onClick={handleSave} disabled={saving}>
                                {saving ? 'Applying...' : 'Save & Close'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
