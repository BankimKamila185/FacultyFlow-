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
import UserProfile from './components/UserProfile';
import AIAssistant from './components/AIAssistant';
import AdminDashboard from './components/AdminDashboard';
import Inbox from './components/Inbox';
import StudentQueries from './components/StudentQueries';
import Settings from './components/Settings';
import Login from './components/Login';

// ─── Nav Icons ───────────────────────────────────────────────────────────────
const icons = {
  Dashboard: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  Analytics: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  Reports: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
      <path d="M22 12A10 10 0 0 0 12 2v10z" />
    </svg>
  ),
  AllTasks: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </svg>
  ),
  Workflows: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  FacultyUsers: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  Sync: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  ),
  AIAssistant: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  Notifications: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  ),
  Settings: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  Inbox: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  ),
  GoogleWorkspace: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="4" />
      <path d="M2 10h20" />
      <path d="M10 2v20" />
    </svg>
  ),
  AddEdit: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  ),
  Assign: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 3h5v5" />
      <path d="M8 21H3v-5" />
      <path d="M21 3l-7 7" />
      <path d="M3 21l7-7" />
    </svg>
  ),
};

const getSidebarConfig = (role, counts) => {
  const configs = {
    ADMIN: {
      OVERVIEW: [
        { label: 'Dashboard', icon: icons.Dashboard },
        { label: 'Analytics', icon: icons.Analytics },
        { label: 'Reports', icon: icons.Reports },
      ],
      TASKS: [
        { label: 'All Tasks', icon: icons.AllTasks, badge: counts.total > 0 ? String(counts.total) : null },
        { label: 'Workflows', icon: icons.Workflows },
        { label: 'Faculty & Users', icon: icons.FacultyUsers },
      ],
      TOOLS: [
        { label: 'Sync', icon: icons.Sync },
        { label: 'AI Assistant', icon: icons.AIAssistant },
        { label: 'Notifications', icon: icons.Notifications, badge: counts.overdue > 0 ? String(counts.overdue) : null, badgeColor: '#EF4444' },
        { label: 'Settings', icon: icons.Settings },
      ],
    },
    OPS_MANAGER: {
      OVERVIEW: [
        { label: 'Dashboard', icon: icons.Dashboard },
        { label: 'Analytics', icon: icons.Analytics },
      ],
      'TASK MANAGEMENT': [
        { label: 'All Tasks', icon: icons.AllTasks, badge: counts.total > 0 ? String(counts.total) : null },
        { label: 'Add / Edit Task', icon: icons.AddEdit, isNew: true },
        { label: 'Workflows', icon: icons.Workflows },
        { label: 'Assign / Reassign', icon: icons.Assign, isNew: true },
      ],
      TOOLS: [
        { label: 'Sync', icon: icons.Sync },
        { label: 'Reports', icon: icons.Reports },
        { label: 'AI Assistant', icon: icons.AIAssistant },
        { label: 'Notifications', icon: icons.Notifications, badge: '4', badgeColor: '#F59E0B' },
        { label: 'Settings', icon: icons.Settings },
      ],
    },
    FACULTY: {
      'MY WORK': [
        { label: 'Dashboard', icon: icons.Dashboard },
        { label: 'My Tasks', icon: icons.AllTasks, badge: counts.total > 0 ? String(counts.total) : null },
        { label: 'Workflows', icon: icons.Workflows },
      ],
      COMMUNICATION: [
        { label: 'Inbox', icon: icons.Inbox, badge: '5', badgeColor: '#F59E0B' },
        { label: 'AI Assistant', icon: icons.AIAssistant },
        { label: 'Notifications', icon: icons.Notifications, badge: counts.overdue > 0 ? String(counts.overdue) : null, badgeColor: '#EF4444' },
      ],
      INTEGRATIONS: [
        { label: 'Google Workspace', icon: icons.GoogleWorkspace },
        { label: 'Settings', icon: icons.Settings },
      ],
    },
  };
  return configs[role] || configs.FACULTY;
};

export default function App() {
  const { currentUser, devUser, backendUser, backendToken, loginWithGoogle, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [theme, setTheme] = useState('light');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState(null);
  const [counts, setCounts] = useState({ total: 0, overdue: 0, inbox: 0 });

  const effectiveUser = devUser || backendUser || currentUser;

  useEffect(() => {
    if (!backendToken) return;
    const fetchCounts = async () => {
      try {
        const res = await fetch(`${API_URL}/analytics/dashboard`, {
          headers: { 'Authorization': `Bearer ${backendToken}` }
        });
        const data = await res.json();
        if (data.success) {
          setCounts({
            total: data.data.tasks.total || 0,
            overdue: data.data.tasks.overdue || 0,
            inbox: 5 
          });
        }
      } catch (err) {
        console.error("Failed to fetch counts:", err);
      }
    };
    fetchCounts();
    const interval = setInterval(fetchCounts, 60000);
    return () => clearInterval(interval);
  }, [backendToken]);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    document.body.className = `theme-${theme}`;
  }, [theme]);

  if (!backendToken) {
    return <Login onLogin={loginWithGoogle} />;
  }

  const isAdmin = ['ADMIN', 'HOD', 'OPS_MANAGER'].includes((effectiveUser?.role || '').toUpperCase());

  // Tab routing map: sidebar label -> component tab name
  const tabRouteMap = {
    'Dashboard': 'Dashboard',
    'Analytics': 'Admin Panel',
    'Faculty': 'Profile',
    'Faculty & Users': 'Profile',
    'Operations': 'My Task',
    'All Tasks': 'My Task',
    'My Tasks': 'My Task',
    'Intelligence': 'Admin Panel',
    'Settings': 'Settings',
    'Support': 'Inbox',
    'Inbox': 'Inbox',
    'Workflows': 'Projects',
    'AI Assistant': 'AI Chat Bot',
    'Google Workspace': 'Workspace',
    'Calendar': 'Calendar',
  };

  // Map sidebar active label back for content rendering
  const activeContent = tabRouteMap[activeTab] || activeTab;

  const handleNavClick = (label) => {
    setActiveTab(label);
  };


  return (
    <div className={`app-container ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Toast Overlay */}
      {toast && (
        <div className={`toast-notification ${toast.type}`}>
          <div className="toast-icon">🔔</div>
          <div className="toast-content">{toast.message}</div>
          <button className="toast-close" onClick={() => setToast(null)}>&times;</button>
        </div>
      )}

      {/* ── Sidebar ── */}
      <aside className="sidebar" style={{ width: sidebarCollapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)' }}>

        {/* Logo */}
        <div className="sidebar-logo">
          <img src="/logo.svg" alt="FacultyFlow Logo" className="sidebar-logo-img" style={{ width: '42px', height: '42px', borderRadius: '12px' }} />
          {!sidebarCollapsed && <span className="sidebar-brand">FacultyFlow</span>}
        </div>

        {/* Profile Card removed */}

        <div className="sidebar-scrollable">
          {Object.entries(getSidebarConfig(effectiveUser?.role?.toUpperCase() || 'FACULTY', counts)).map(([category, items]) => (
            <React.Fragment key={category}>
              {!sidebarCollapsed && <div className="side-category">{category}</div>}
              <nav className="nav-menu">
                {items.map((item) => (
                  <div
                    key={item.label}
                    className={`nav-item ${activeTab === item.label ? 'active' : ''}`}
                    onClick={() => handleNavClick(item.label)}
                    title={sidebarCollapsed ? item.label : ''}
                  >
                    <span className="nav-icon">{item.icon}</span>
                    {!sidebarCollapsed && <span className="nav-label">{item.label}</span>}
                    {item.badge && !sidebarCollapsed && (
                      <span className="nav-badge" style={{ backgroundColor: item.badgeColor || '#EF4444', color: 'white' }}>
                        {item.badge}
                      </span>
                    )}
                  </div>
                ))}
              </nav>
            </React.Fragment>
          ))}
        </div>


        {/* Spacer removed */}

        {/* Collapse toggle */}
        <button className="collapse-btn" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            style={{ transform: sidebarCollapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }}>
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      </aside>

      {/* ── Main Content ── */}
      <main className="main-content" style={{ marginLeft: sidebarCollapsed ? 'calc(var(--sidebar-collapsed) + 1.75rem)' : 'calc(var(--sidebar-width) + 1.75rem)' }}>

        {/* Header */}
        <header className="header">
          <div className="header-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: 'var(--text-dim)' }}>
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Quick search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="search-hint">⌘ K</div>
          </div>

          <div className="header-actions">
            {/* Notification bell */}
            <div className="header-bell" title="Notifications">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <span className="header-bell-dot" />
            </div>

            {/* Profile card */}
            <div className="header-profile-card" onClick={() => handleNavClick('Faculty')}>
              <img
                src={effectiveUser.photoURL || effectiveUser.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(effectiveUser.name || 'User')}&background=000000&color=fff`}
                alt="Profile"
                className="header-profile-avatar"
              />
              <div className="header-profile-info">
                <div className="header-profile-name">{effectiveUser.name || 'User'}</div>
                <div className="header-profile-role">{(effectiveUser?.role || 'FACULTY').toUpperCase()}</div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-dim)', flexShrink: 0 }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>
        </header>

        {/* Tab Content */}
        <div className="tab-content-wrapper">
          {activeContent === 'Dashboard' && <Dashboard setActiveTab={setActiveTab} />}
          {activeContent === 'Projects' && <Workflow />}
          {activeContent === 'My Task' && <Tasks />}
          {activeContent === 'Inbox' && <Inbox setActiveTab={setActiveTab} />}
          {isAdmin && activeContent === 'Admin Panel' && <AdminDashboard />}
          {activeContent === 'AI Chat Bot' && <AIAssistant />}
          {activeContent === 'Workspace' && <GoogleTools setActiveTab={setActiveTab} />}
          {activeContent === 'Calendar' && <GoogleCalendar />}
          {activeContent === 'Settings' && <Settings />}
          {activeContent === 'Profile' && <UserProfile theme={theme} toggleTheme={() => setTheme(t => t === 'light' ? 'dark' : 'light')} />}
        </div>
      </main>
    </div>
  );
}
