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
  Faculty: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  Operations: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  ),
  Intelligence: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="2" />
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  ),
  Settings: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  Support: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  Profile: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  Projects: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  ),
  'My Task': (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  ),
  Calendar: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  Workspace: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16v16H4z" />
      <path d="M4 9h16" />
      <path d="M9 4v16" />
    </svg>
  ),
  'AI Chat Bot': (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  Inbox: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  ),
  'Admin Panel': (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
};



export default function App() {
  const { currentUser, devUser, backendUser, backendToken, loginWithGoogle, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [theme, setTheme] = useState('light');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const effectiveUser = devUser || currentUser || backendUser || {
    name: 'UI Developer',
    email: 'dev@facultyflow.com',
    role: 'ADMIN',
    photoURL: 'https://ui-avatars.com/api/?name=UI+Dev'
  };

  const isAdmin = (effectiveUser?.role || '').toUpperCase() === 'ADMIN' || (effectiveUser?.role || '').toUpperCase() === 'HOD';

  // Tab routing map: sidebar label -> component tab name
  const tabRouteMap = {
    'Dashboard': 'Dashboard',
    'Faculty': 'Profile',
    'Operations': 'My Task',
    'Intelligence': 'Admin Panel',
    'Settings': 'Settings',
    'Support': 'Inbox',
    'Projects': 'Projects',
    'My Task': 'My Task',
    'Inbox': 'Inbox',
    'Admin Panel': 'Admin Panel',
    'AI Chat Bot': 'AI Chat Bot',
    'Workspace': 'Workspace',
    'Calendar': 'Calendar',
  };

  const menuItems = [
    { label: 'Dashboard', icon: icons.Dashboard },
    { label: 'Faculty', icon: icons.Faculty },
    { label: 'Operations', icon: icons.Operations },
    ...(isAdmin ? [{ label: 'Intelligence', icon: icons.Intelligence }] : []),
  ];

  const generalItems = [
    { label: 'Settings', icon: icons.Settings },
    { label: 'Support', icon: icons.Support },
  ];

  // Map sidebar active label back for content rendering
  const activeContent = tabRouteMap[activeTab] || activeTab;

  const handleNavClick = (label) => {
    setActiveTab(label);
  };

  useEffect(() => {
    document.body.className = `theme-${theme}`;
  }, [theme]);

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
          <div className="sidebar-logo-icon">
            <img src="/logo-white.svg" alt="FacultyFlow Logo" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
          </div>
          {!sidebarCollapsed && <span className="sidebar-brand">FACULTYFLOW</span>}
        </div>

        {/* MENU section */}
        {!sidebarCollapsed && <div className="side-category">MENU</div>}
        <nav className="nav-menu">
          {menuItems.map((item) => (
            <div
              key={item.label}
              className={`nav-item ${activeTab === item.label ? 'active' : ''}`}
              onClick={() => handleNavClick(item.label)}
              title={sidebarCollapsed ? item.label : ''}
            >
              <span className="nav-icon">{item.icon}</span>
              {!sidebarCollapsed && <span className="nav-label">{item.label}</span>}
            </div>
          ))}
        </nav>

        {/* GENERAL section */}
        {!sidebarCollapsed && <div className="side-category" style={{ marginTop: '1.5rem' }}>GENERAL</div>}
        <nav className="nav-menu">
          {generalItems.map((item) => (
            <div
              key={item.label}
              className={`nav-item ${activeTab === item.label ? 'active' : ''}`}
              onClick={() => handleNavClick(item.label)}
              title={sidebarCollapsed ? item.label : ''}
            >
              <span className="nav-icon">{item.icon}</span>
              {!sidebarCollapsed && <span className="nav-label">{item.label}</span>}
            </div>
          ))}
        </nav>

        <div style={{ flex: 1 }} />

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
          {isAdmin && activeContent === 'Admin Panel' && <AdminDashboard setActiveTab={setActiveTab} />}
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
