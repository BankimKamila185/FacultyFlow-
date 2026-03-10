import React, { useState, useEffect } from 'react';
import './index.css';
import { requestFCMToken } from './utils/fcm';
import { API_URL } from './config';
import { getAvatarUrl } from './utils/api';
import { useAuth } from './context/AuthContext';

import Dashboard from './components/Dashboard';
import Tasks from './components/Tasks';
import Workflow from './components/Workflow';
import GoogleCalendar from './components/GoogleCalendar';
import GoogleTools from './components/GoogleTools';
import Notifications from './components/Notifications';
import Inbox from './components/Inbox';
import Settings from './components/Settings';
import UserProfile from './components/UserProfile';
import StudentQueries from './components/StudentQueries';
import PromptEmail from './components/PromptEmail';

// ─── Nav Icons ───────────────────────────────────────────────────────────────
const icons = {
  Dashboard: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  Profile: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  Projects: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  ),
  'My Task': (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  ),
  Calendar: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  'Time Manage': (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  Settings: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  Inbox: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  ),
  Workspace: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16v16H4z" />
      <path d="M4 9h16" />
      <path d="M9 4v16" />
    </svg>
  ),

  'Student Queries': (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  'AI Mail': (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16v16H4z" />
      <polyline points="4 6 12 13 20 6" />
      <path d="M9 18h6" />
    </svg>
  ),
};

function LoginPage({ onLogin }) {
  const { devLogin } = useAuth();
  const [devEmail, setDevEmail] = React.useState('meetd@itm.edu');
  const [devLoading, setDevLoading] = React.useState(false);
  const [devError, setDevError] = React.useState('');

  const handleDevLogin = async () => {
    setDevLoading(true);
    setDevError('');
    try {
      await devLogin(devEmail);
    } catch (e) {
      setDevError(e.message || 'Dev login failed');
    } finally {
      setDevLoading(false);
    }
  };

  const KNOWN_FACULTY = [
    'meetd@itm.edu',
    'harshitad@itm.edu',
    'jasminet@itm.edu',
    'aartip@itm.edu',
    'kalpanas@itm.edu',
    'hardikk@itm.edu',
    'sejalb@itm.edu',
    'pallavim@itm.edu',
    'Swapnilw@itm.edu',
    'poonams@itm.edu',
  ];

  return (
    <div className="login-page">
      <div className="login-bg-grid" />
      <div className="login-glow login-glow-1" />
      <div className="login-glow login-glow-2" />
      <div className="login-glow login-glow-3" />
      
      <div className="login-card">
        <div className="login-header">
          <div className="logo-icon lg floating">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5ZM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className="login-brand">FacultyFlow</h2>
          <p className="login-tagline">Coordinate, Collaborate, Conquer.</p>
        </div>

        <div className="login-body">
          <h1 className="login-title">Welcome</h1>
          <p className="login-sub">Sign in with your Google Workspace account to access your faculty dashboard.</p>
          
          <button className="btn-google-premium" onClick={onLogin}>
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1 .67-2.28 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.67-.35-1.39-.35-2.09s.13-1.42.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Sign in with Google
          </button>

          <div className="login-divider">
            <span>OR DEV ACCESS</span>
          </div>

          <div className="dev-login-box">
            <div className="form-group">
              <label>Select Mock Account</label>
              <select
                value={devEmail}
                onChange={e => setDevEmail(e.target.value)}
                className="dev-select"
              >
                {KNOWN_FACULTY.map(email => (
                  <option key={email} value={email}>{email}</option>
                ))}
              </select>
            </div>
            
            {devError && <p className="login-error">{devError}</p>}
            
            <button
              onClick={handleDevLogin}
              disabled={devLoading}
              className="btn-dev-login"
            >
              {devLoading ? 'Verifying...' : `Continue as ${devEmail.split('@')[0]}`}
            </button>
          </div>
        </div>

        <div className="login-footer">
          <p>&copy; 2026 FacultyFlow. Academic Excellence Reimagined.</p>
        </div>
      </div>
    </div>
  );
}


export default function App() {
  const { currentUser, devUser, backendUser, backendToken, setDevUser, setBackendToken, loginWithGoogle, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState('light');
  const isDesktop = !!window.require; // Detection for Electron

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  
  // Toast Notification System
  const [toast, setToast] = useState(null);

  useEffect(() => {
    // Explicitly request permission on mount for macOS
    if (typeof Notification !== 'undefined') {
      Notification.requestPermission().then(perm => {
        console.log('[NOTIFY] Permission status:', perm);
      });
    }
  }, []);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const notifyUser = (title, body) => {
    console.log(`[NOTIFY] ${title}: ${body}`);
    
    // 1. In-App Toast (Guaranteed Visibility)
    showToast(`${title}: ${body}`);

    // 2. Electron Native Notification
    if (window.require) {
      try {
        const { ipcRenderer } = window.require('electron');
        ipcRenderer.invoke('send-notification', { title, body })
          .then(res => console.log('[IPC] Result:', res))
          .catch(err => console.error('[IPC] Error:', err));
      } catch (e) {
        console.warn('[IPC] Bridge failed, falling back to Web Notification');
      }
    }

    // 3. Browser Web Notification (Layer 2 Fallback)
    if (Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/vite.svg' });
    }
  };
  
  // The effective user is prioritized: 
  // 1. Explicitly chosen Mock Context (devUser)
  // 2. Firebase Authenticated User (currentUser)
  // 3. Backend Authenticated User (backendUser - from dev-login or cookie session)
  const effectiveUser = devUser || currentUser || backendUser;

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetchWithAuth(`${API_URL}/search?q=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        if (data.success) {
          setSearchResults(data.data);
        }
      } catch (err) {
        console.error('Search error', err);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  // FCM Integration
  useEffect(() => {
    const setupFCM = async () => {
      if (effectiveUser && backendToken) {
        console.log('[FCM] User detected, requesting token...');
        const token = await requestFCMToken(backendToken);
        if (token) {
          console.log('[FCM] Token registered successfully');
        }
      }
    };
    setupFCM();
  }, [effectiveUser, backendToken]);

  // Foreground notification handler
  useEffect(() => {
    // Dynamically import to ensure compatibility with web/electron split
    const setupMessaging = async () => {
      try {
        const { onMessage } = await import('firebase/messaging');
        const { messaging } = await import('./config/firebase');
        
        if (messaging) {
          const unsubscribe = onMessage(messaging, (payload) => {
            console.log('[FCM] Foreground message received:', payload);
            notifyUser(payload.notification.title, payload.notification.body);
          });
          return unsubscribe;
        }
      } catch (err) {
        console.warn('[FCM] Messaging setup failed or not supported in this environment', err);
      }
    };
    
    let unsubscribe;
    setupMessaging().then(unsub => { unsubscribe = unsub; });
    
    return () => { if (unsubscribe) unsubscribe(); };
  }, []);

  useEffect(() => {
    document.body.className = `theme-${theme}`;
  }, [theme]);

  const toggleTheme = () => {
    setTheme(t => t === 'light' ? 'dark' : 'light');
  };

  // ── Auth Guard ──
  // We show LoginPage if:
  // - No backend token (cookie) is detected
  // - AND we haven't resolved a backendUser OR devUser OR currentUser
  if (!backendToken && !effectiveUser) {
    return <LoginPage onLogin={loginWithGoogle} />;
  }

  const navItems = [
    'Dashboard',
    'Projects',
    'My Task',
    'Inbox',
    'Student Queries',
    'AI Mail',
    'Workspace',
    'Calendar',
    'Settings'
  ];

  return (
    <div className={`app-container ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* ── Toast Overlay ── */}
      {toast && (
        <div className={`toast-notification ${toast.type}`}>
          <div className="toast-icon">🔔</div>
          <div className="toast-content">{toast.message}</div>
          <button className="toast-close" onClick={() => setToast(null)}>&times;</button>
        </div>
      )}

      {/* ── Sidebar ── */}
      <aside className={`sidebar ${isDesktop ? 'desktop-mac' : ''}`}>
        <div className="logo-container">
          <div className="logo-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5ZM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          {!sidebarCollapsed && <span>FacultyFlow</span>}
        </div>

        <nav className="nav-menu">
          {navItems.map((item) => (
            <div
              key={item}
              className={`nav-item ${activeTab === item ? 'active' : ''}`}
              onClick={() => setActiveTab(item)}
              title={item}
            >
              <span className="nav-icon">{icons[item]}</span>
              {!sidebarCollapsed && <span className="nav-label">{item}</span>}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button 
            className="collapse-btn" 
            style={{ marginBottom: '1rem', background: 'var(--grad-primary)', color: 'white' }}
            onClick={() => {
              notifyUser('FacultyFlow Alert', 'Your macOS notifications and in-app alerts are active! 🚀');
            }}
          >
            🔔 {!sidebarCollapsed && "Test Mac Alert"}
          </button>
          {!sidebarCollapsed ? (
            <div className="user-profile" onClick={() => setActiveTab('Profile')} title="View Profile">
              <img
                src={effectiveUser.photoURL || getAvatarUrl(effectiveUser.email)}
                alt="User"
                className="avatar"
              />
              <div className="user-info">
                <div className="user-name">{effectiveUser.name || effectiveUser.displayName || effectiveUser.email.split('@')[0]}</div>
                <div className="user-email">{effectiveUser.email}</div>
              </div>
              <button 
                className="sidebar-logout-btn" 
                onClick={(e) => {
                  e.stopPropagation();
                  logout();
                }}
                title="Logout"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
              </button>
            </div>
          ) : (
            <button 
              className="sidebar-logout-btn collapsed-logout" 
              onClick={() => logout()}
              title="Logout"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
            </button>
          )}
          <button className="collapse-btn" onClick={() => setSidebarCollapsed(v => !v)} title={sidebarCollapsed ? 'Expand' : 'Collapse'}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ transform: sidebarCollapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }}>
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="main-content" style={{ background: 'var(--bg-dark)' }}>
        <header className="header" style={{ 
          height: '100px', 
          background: 'transparent', 
          display: 'flex', 
          alignItems: 'center', 
          padding: '0 3.5rem', 
          position: 'sticky',
          top: 0,
          zIndex: 1000,
          justifyContent: 'space-between'
        }}>
          {/* Search Pod */}
          <div className="header-search-pod" style={{ 
            flex: '0 1 500px', 
            background: 'var(--bg-card)', 
            borderRadius: '100px', 
            height: '60px',
            display: 'flex',
            alignItems: 'center',
            padding: '0 1.5rem',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-sm)',
            position: 'relative'
          }}>
            <span style={{ marginRight: '1rem', color: 'var(--text-dim)', fontSize: '1.2rem' }}>🔍</span>
            <input 
              type="text" 
              placeholder="Search resources, tasks..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                fontSize: '1rem',
                fontWeight: 500,
                outline: 'none',
                color: 'var(--text-main)'
              }}
            />
            <div style={{
              background: 'var(--bg-dark)', border: '1px solid var(--border-color)',
              borderRadius: '8px', padding: '0.3rem 0.6rem',
              fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)',
              pointerEvents: 'none',
              marginLeft: '1rem'
            }}>⌘ K</div>

            {searchQuery && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 15px)', left: 0, width: '100%',
                background: 'white', border: '1px solid var(--border-color)',
                borderRadius: '24px', boxShadow: 'var(--shadow-lg)', zIndex: 1100,
                maxHeight: '400px', overflowY: 'auto', padding: '1.25rem'
              }}>
                {isSearching ? (
                  <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '1rem', fontWeight: 600 }}>Analyzing registry...</div>
                ) : searchResults ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {searchResults.tasks?.length > 0 && (
                      <div>
                        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>Recent Tasks</div>
                        {searchResults.tasks.map(t => (
                          <div key={`task-${t.id}`} style={{ padding: '0.8rem 1rem', borderRadius: '12px', cursor: 'pointer', marginBottom: '0.3rem' }} className="search-item">
                            <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)' }}>{t.title}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.status}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {(!searchResults.tasks?.length && !searchResults.users?.length && !searchResults.workflows?.length) && (
                      <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '1.5rem 0' }}>No matches found.</div>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* Actions Pods */}
          <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <button className="btn-notify" style={{ 
              width: '60px', height: '60px', borderRadius: '20px', 
              background: 'var(--bg-card)', border: '1px solid var(--border-color)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)', cursor: 'pointer', transition: 'var(--transition)',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </button>
            <div style={{ 
              display: 'flex', alignItems: 'center', gap: '1rem', 
              background: 'var(--bg-card)', padding: '0.6rem 1.5rem 0.6rem 1rem', 
              borderRadius: '100px', border: '1px solid var(--border-color)',
              cursor: 'pointer', transition: 'var(--transition)',
              boxShadow: 'var(--shadow-sm)'
            }} onClick={() => setActiveTab('Profile')} className="header-profile">
              <img
                src={effectiveUser.photoURL || effectiveUser.photoUrl || getAvatarUrl(effectiveUser.email)}
                alt="User"
                style={{ width: '42px', height: '42px', borderRadius: '50%', border: '1px solid var(--border-color)' }}
              />
              <div style={{ textAlign: 'left', lineHeight: '1.2' }}>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)' }}>{effectiveUser.name || effectiveUser.email.split('@')[0]}</div>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Faculty Intel</div>
              </div>
            </div>
          </div>
        </header>

        <div className="tab-content" style={{ 
          margin: '0 2rem 2rem 2rem',
          padding: '1.5rem', 
          height: 'calc(100vh - 120px)', 
          overflowY: 'auto',
          background: 'var(--bg-surface)',
          borderRadius: '40px',
          boxShadow: theme === 'light' ? '0 20px 50px rgba(0,0,0,0.05)' : '0 20px 50px rgba(0,0,0,0.3)',
          border: '1px solid var(--border-color)',
          transition: 'background 0.3s ease, border-color 0.3s ease'
        }}>
          {activeTab === 'Dashboard' && <Dashboard setActiveTab={setActiveTab} />}
          {activeTab === 'Profile' && <UserProfile theme={theme} toggleTheme={toggleTheme} />}
          {activeTab === 'My Task' && <Tasks />}
          {activeTab === 'Projects' && <Workflow />}
          {activeTab === 'Inbox' && <Inbox />}
          {activeTab === 'Student Queries' && <StudentQueries />}
          {activeTab === 'AI Mail' && <PromptEmail />}
          {activeTab === 'Workspace' && <GoogleTools />}
          {activeTab === 'Calendar' && <GoogleCalendar />}

          {activeTab === 'Notifications' && <Notifications />}
          {activeTab === 'Settings' && <Settings />}
        </div>
      </main>
    </div>
  );
}
