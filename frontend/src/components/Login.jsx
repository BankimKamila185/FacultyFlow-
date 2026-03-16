import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import './Login.css';

const Login = ({ onLogin }) => {
  const { devLogin } = useAuth();
  const [devEmail, setDevEmail] = useState('meetd@itm.edu');
  const [devLoading, setDevLoading] = useState(false);
  const [devError, setDevError] = useState('');
  const [showDevAccess, setShowDevAccess] = useState(false);

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
    <div className="login-page-container hybrid-payoneer">
      <div className="login-card-wrapper">
        {/* Decorative Image Card */}
        <div className="decorative-card">
          <div className="gradient-content">
            {/* The vibrant gradient/image is handled in CSS */}
          </div>
        </div>

        {/* Login Form Section */}
        <div className="form-card">
          {/* Absolute Top-Right Logo */}
          <div className="login-brand-logo-absolute">
            <div className="brand-icon-badge">
              <img src="/logo.svg" alt="FacultyFlow Logo" className="app-logo-img" />
            </div>
          </div>

          <div className="login-content-inner">
            <div className="payoneer-form-header">
              <h1>Welcome to FacultyFlow</h1>
            </div>

            <div className="payoneer-actions-container google-focus">
              <button className="btn-google-login" onClick={onLogin}>
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="google-icon" />
                Sign in with Google
              </button>
            </div>

            <div className="login-footer-minimal-hybrid">
              <p>By continuing you agree to our <span className="link-text-minimal">Terms & Conditions</span></p>
              <p className="dev-toggle" onClick={() => setShowDevAccess(!showDevAccess)}>Developer Access</p>
            </div>

            {showDevAccess && (
              <div className="dev-access-popover-minimal">
                <h3>Developer Access</h3>
                <select
                  value={devEmail}
                  onChange={(e) => setDevEmail(e.target.value)}
                  className="dev-select-input-minimal"
                >
                  {KNOWN_FACULTY.map(email => (
                    <option key={email} value={email}>{email}</option>
                  ))}
                </select>
                <button
                  onClick={handleDevLogin}
                  className="btn-dev-action-minimal"
                  disabled={devLoading}
                >
                  {devLoading ? 'Joining...' : 'Login as Mock User'}
                </button>
                {devError && <p className="dev-error-text-minimal">{devError}</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
