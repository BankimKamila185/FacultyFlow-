import React, { useState } from 'react';
import './index.css';

function App() {
  const [activeTab, setActiveTab] = useState('Overview');

  const stats = [
    { title: 'Total Faculty', value: '1,248', change: '+12%', isPositive: true },
    { title: 'Departments', value: '42', change: '+2', isPositive: true },
    { title: 'On Leave', value: '86', change: '-5%', isPositive: false },
  ];

  const facultyData = [
    { id: 'F001', name: 'Dr. Sarah Jenkins', department: 'Computer Science', role: 'Professor', status: 'Active' },
    { id: 'F002', name: 'Prof. Michael Chen', department: 'Physics', role: 'Assoc. Professor', status: 'Active' },
    { id: 'F003', name: 'Dr. Emily Rodriguez', department: 'Mathematics', role: 'Asst. Professor', status: 'Leave' },
    { id: 'F004', name: 'Dr. James Wilson', department: 'Engineering', role: 'Professor', status: 'Active' },
  ];

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="logo-container">
          <div className="logo-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 17L12 22L22 17" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 12L12 17L22 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          FacultyFlow
        </div>

        <nav className="nav-menu">
          {['Overview', 'Directory', 'Departments', 'Leave Requests', 'Settings'].map((item) => (
            <div
              key={item}
              className={`nav-item ${activeTab === item ? 'active' : ''}`}
              onClick={() => setActiveTab(item)}
            >
              {item}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main Dashboard Content */}
      <main className="main-content">
        <header className="header">
          <h1>{activeTab}</h1>
          <div className="user-profile">
            <img
              src="https://api.dicebear.com/7.x/avataaars/svg?seed=Admin"
              alt="Admin User"
              className="avatar"
            />
            <div>
              <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>Admin User</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Superadmin</div>
            </div>
          </div>
        </header>

        {activeTab === 'Overview' && (
          <>
            {/* Stat Cards Grid */}
            <div className="stats-grid">
              {stats.map((stat, i) => (
                <div className="stat-card" key={i}>
                  <div className="stat-title">{stat.title}</div>
                  <div className="stat-value">{stat.value}</div>
                  <div className={`stat-change ${stat.isPositive ? 'positive' : 'negative'}`}>
                    <span>{stat.isPositive ? '↑' : '↓'}</span>
                    {stat.change} this month
                  </div>
                </div>
              ))}
            </div>

            {/* Recent Faculty Table Section */}
            <div className="content-section">
              <div className="section-header">
                <h2 className="section-title">Recent Faculty Directory</h2>
                <button className="btn-primary">+ Add Faculty</button>
              </div>

              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Name</th>
                      <th>Department</th>
                      <th>Role</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facultyData.map((faculty) => (
                      <tr key={faculty.id}>
                        <td>{faculty.id}</td>
                        <td style={{ fontWeight: 500 }}>{faculty.name}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{faculty.department}</td>
                        <td>{faculty.role}</td>
                        <td>
                          <span className={`status-badge ${faculty.status === 'Active' ? 'status-active' : 'status-leave'}`}>
                            {faculty.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Placeholder for other tabs */}
        {activeTab !== 'Overview' && (
          <div className="content-section" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
            <h3>{activeTab} module is under construction</h3>
            <p style={{ marginTop: '0.5rem' }}>This feature will be available in the next release.</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
