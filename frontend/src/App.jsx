import React, { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { request } from './api';

function loadUser() {
  const stored = localStorage.getItem('user');
  if (!stored) return null;

  try {
    return JSON.parse(stored);
  } catch {
    localStorage.removeItem('user');
    return null;
  }
}

function saveUser(user) {
  localStorage.setItem('user', JSON.stringify(user));
}

function logout() {
  localStorage.removeItem('user');
}

function getPageMeta(pathname, role) {
  if (pathname === '/dashboard') return { title: 'Staff Dashboard', subtitle: 'Medicine lookup, stock visibility, and fast store operations.' };
  if (pathname === '/attendance') return { title: 'Attendance', subtitle: 'Track your check-in and check-out activity.' };
  if (pathname === '/profile') return { title: 'Profile', subtitle: 'Update staff contact details used by the store.' };
  if (pathname === '/scanner') return { title: 'Scanner', subtitle: 'Prepare barcode and quick search workflows.' };
  if (pathname === '/billing') return { title: 'Billing', subtitle: 'Create invoices and manage cart totals.' };
  if (pathname === '/admin') return { title: 'Admin Dashboard', subtitle: 'Inventory, staff, and store performance overview.' };
  if (pathname === '/analytics') return { title: 'Analytics', subtitle: 'Business snapshot from store records and operations.' };
  if (pathname === '/admin-attendance') return { title: 'Attendance Control', subtitle: 'Mark staff attendance and review recent records.' };
  return role === 'admin'
    ? { title: 'Admin Dashboard', subtitle: 'Manage the pharmacy with a polished command center.' }
    : { title: 'Staff Dashboard', subtitle: 'Everything a pharmacy staff member needs in one place.' };
}

function RequireAuth({ user, children }) {
  if (!user) return <Navigate to="/" replace />;
  return children;
}

function RequireRole({ user, role, children }) {
  if (!user) return <Navigate to="/" replace />;
  if (user.role !== role) return <Navigate to={role === 'admin' ? '/admin' : '/dashboard'} replace />;
  return children;
}

function Shell({ user, onLogout, children }) {
  const location = useLocation();
  const pageMeta = getPageMeta(location.pathname, user?.role);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">PF</span>
          <div>
            <div className="brand-title">PharmaFlow</div>
            <div className="brand-subtitle">Pharmacy ops suite</div>
          </div>
        </div>

        {user ? (
          <nav className="nav-links">
            {user.role === 'admin' ? (
              <>
                <NavLink to="/admin" end className={({ isActive }) => (isActive ? 'active' : '')}>Admin</NavLink>
                <NavLink to="/analytics" className={({ isActive }) => (isActive ? 'active' : '')}>Analytics</NavLink>
                <NavLink to="/admin-attendance" className={({ isActive }) => (isActive ? 'active' : '')}>Attendance</NavLink>
                <NavLink to="/billing" className={({ isActive }) => (isActive ? 'active' : '')}>Billing</NavLink>
              </>
            ) : (
              <>
                <NavLink to="/dashboard" end className={({ isActive }) => (isActive ? 'active' : '')}>Dashboard</NavLink>
                <NavLink to="/attendance" className={({ isActive }) => (isActive ? 'active' : '')}>Attendance</NavLink>
                <NavLink to="/profile" className={({ isActive }) => (isActive ? 'active' : '')}>Profile</NavLink>
                <NavLink to="/scanner" className={({ isActive }) => (isActive ? 'active' : '')}>Scanner</NavLink>
                <NavLink to="/billing" className={({ isActive }) => (isActive ? 'active' : '')}>Billing</NavLink>
              </>
            )}
            <button className="nav-button" onClick={onLogout}>Logout</button>
          </nav>
        ) : (
          <nav className="nav-links">
            <Link to="/">Login</Link>
          </nav>
        )}
      </aside>

      <main className="main-panel">
        {user ? (
          <header className="topbar card">
            <div>
              <p className="eyebrow">PharmaFlow medical store</p>
              <h1>{pageMeta.title}</h1>
              <p className="dashboard-text">{pageMeta.subtitle}</p>
            </div>
            <div className="topbar-actions">
              <button className="secondary-button" onClick={onLogout}>Logout</button>
            </div>
          </header>
        ) : null}

        {children}
      </main>
    </div>
  );
}

function LoginPage({ onLogin }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('signin');
  const [signInData, setSignInData] = useState({ username: '', password: '', accountType: 'staff', rememberMe: false });
  const [signUpData, setSignUpData] = useState({ fullName: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotStep, setForgotStep] = useState('request');
  const [forgotData, setForgotData] = useState({ username: '', otp: '', newPassword: '', confirmPassword: '' });

  useEffect(() => {
    const remembered = localStorage.getItem('rememberedUsername');
    if (remembered) {
      setSignInData((prev) => ({ ...prev, username: remembered, rememberMe: true }));
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(timer);
  }, [toast]);

  function showToastMessage(type, text) {
    setToast({ type, text });
  }

  function handleTabChange(tab) {
    setActiveTab(tab);
    setToast(null);
  }

  function handleSignInChange(event) {
    const { name, value, type, checked } = event.target;
    setSignInData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  }

  function handleSignUpChange(event) {
    const { name, value } = event.target;
    setSignUpData((prev) => ({ ...prev, [name]: value }));
  }

  function handleForgotChange(event) {
    const { name, value } = event.target;
    setForgotData((prev) => ({ ...prev, [name]: value }));
  }

  function openForgotPassword() {
    setForgotMode(true);
    setForgotStep('request');
    setForgotData((prev) => ({ ...prev, username: signInData.username.trim() }));
    setToast(null);
  }

  function closeForgotPassword(preserveToast = false) {
    setForgotMode(false);
    setForgotStep('request');
    if (!preserveToast) setToast(null);
  }

  async function requestPasswordReset(event) {
    event.preventDefault();
    if (!forgotData.username.trim()) {
      showToastMessage('error', 'Enter your email or username first.');
      return;
    }

    try {
      setLoading(true);
      const data = await request('/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ username: forgotData.username.trim() })
      });
      setForgotStep('reset');
      showToastMessage(data.otp ? 'info' : 'success', data.otp ? `OTP: ${data.otp}` : (data.message || 'Check your email or phone for the OTP.'));
    } catch (error) {
      showToastMessage('error', error.message || 'Unable to start password reset.');
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword(event) {
    event.preventDefault();
    if (!forgotData.otp || !forgotData.newPassword || !forgotData.confirmPassword) {
      showToastMessage('error', 'Enter the OTP and complete both password fields.');
      return;
    }
    if (forgotData.newPassword !== forgotData.confirmPassword) {
      showToastMessage('error', 'Passwords do not match.');
      return;
    }
    if (forgotData.newPassword.length < 8) {
      showToastMessage('error', 'Password must be at least 8 characters.');
      return;
    }

    try {
      setLoading(true);
      const data = await request('/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          username: forgotData.username.trim(),
          otp: forgotData.otp.trim(),
          newPassword: forgotData.newPassword
        })
      });
      showToastMessage('success', data.message || 'Password updated. Please sign in.');
      setSignInData((prev) => ({ ...prev, username: forgotData.username.trim(), password: '' }));
      closeForgotPassword(true);
    } catch (error) {
      showToastMessage('error', error.message || 'Unable to reset password.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSignIn(event) {
    event.preventDefault();
    setToast(null);

    const { username, password, rememberMe } = signInData;
    if (!username.trim() || !password) {
      showToastMessage('error', 'Please enter your email/username and password.');
      return;
    }

    try {
      setLoading(true);
      const data = await request('/login', {
        method: 'POST',
        body: JSON.stringify({ username: username.trim(), password, role: signInData.accountType })
      });

      if (!data || !data.role) {
        showToastMessage('error', data?.message || 'Invalid login credentials.');
        return;
      }

      if (rememberMe) {
        localStorage.setItem('rememberedUsername', username.trim());
      } else {
        localStorage.removeItem('rememberedUsername');
      }

      saveUser(data);
      onLogin(data);
      navigate(data.role === 'admin' ? '/admin' : '/dashboard');
    } catch (error) {
      showToastMessage('error', error.message || 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp(event) {
    event.preventDefault();
    setToast(null);

    const { fullName, email, phone, password, confirmPassword } = signUpData;

    if (!fullName.trim() || !email.trim() || !password || !confirmPassword) {
      showToastMessage('error', 'Please complete all required sign up fields.');
      return;
    }

    if (!/^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email.trim())) {
      showToastMessage('error', 'Enter a valid email address.');
      return;
    }

    if (password !== confirmPassword) {
      showToastMessage('error', 'Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      showToastMessage('error', 'Password must be at least 8 characters.');
      return;
    }

    try {
      setLoading(true);
      await request('/register', {
        method: 'POST',
        body: JSON.stringify({
          username: email.trim(),
          password,
          name: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          role: 'staff'
        })
      });

      showToastMessage('success', 'Account created successfully. Please sign in.');
      setActiveTab('signin');
      setSignInData((prev) => ({ ...prev, username: email.trim() }));
      setSignUpData({ fullName: '', email: '', phone: '', password: '', confirmPassword: '' });
    } catch (error) {
      showToastMessage('error', error.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-landing">
      <div className="auth-landing__overlay" />
      <div className="floating-icon icon-pill" aria-hidden="true">
        <svg viewBox="0 0 48 48" fill="none"><path d="M34.5 13.5L26 22m0 0L17.5 13.5M26 22l8.5 8.5M26 22L17.5 30.5" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/><path opacity=".25" d="M9.5 12.5c-5.5 5.5-5.5 14.4 0 19.9s14.4 5.5 19.9 0 5.5-14.4 0-19.9-14.4-5.5-19.9 0Z" fill="white"/></svg>
      </div>
      <div className="floating-icon icon-cross" aria-hidden="true">
        <svg viewBox="0 0 48 48" fill="none"><path d="M24 12v24M12 24h24" stroke="white" strokeWidth="4" strokeLinecap="round"/></svg>
      </div>
      <div className="floating-icon icon-prescription" aria-hidden="true">
        <svg viewBox="0 0 48 48" fill="none"><path d="M32 12H16a4 4 0 0 0-4 4v16a4 4 0 0 0 4 4h16a4 4 0 0 0 4-4V16a4 4 0 0 0-4-4Z" stroke="white" strokeWidth="3"/><path d="M20 20h8M20 26h8M20 32h8" stroke="white" strokeWidth="3" strokeLinecap="round"/></svg>
      </div>
      <div className="floating-icon icon-stethoscope" aria-hidden="true">
        <svg viewBox="0 0 48 48" fill="none"><path d="M18 20a6 6 0 0 1 12 0v8" stroke="white" strokeWidth="3" strokeLinecap="round"/><path d="M18 28a10 10 0 0 1-10 10v4a4 4 0 0 0 8 0v-4a6 6 0 0 1 12 0v4a4 4 0 0 0 8 0v-4a10 10 0 0 1-10-10" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </div>

      <div className="auth-landing__content">
        <section className="hero-panel">
          <div className="brand-logo">PF</div>
          <p className="eyebrow hero-eyebrow">PharmaFlow</p>
          <h1>Healthcare pharmacy operations, reimagined.</h1>
          <p className="hero-copy">Power your pharmacy with secure inventory, billing, patient workflows, and rapid analytics — all in a premium healthcare interface.</p>
        </section>

        <section className="auth-card card-glass">
          <div className="card-header">
            <div>
              <div className="auth-logo">PF</div>
              <div>
                <p className="eyebrow">Welcome Back</p>
                <h2>Secure access to your pharmacy suite.</h2>
              </div>
            </div>
          </div>

          <div className="auth-tabs" role="tablist" aria-label="Authentication tabs">
            <button className={`auth-tab ${activeTab === 'signin' ? 'active' : ''}`} type="button" onClick={() => handleTabChange('signin')}>
              Sign In
            </button>
            <button className={`auth-tab ${activeTab === 'signup' ? 'active' : ''}`} type="button" onClick={() => handleTabChange('signup')}>
              Sign Up
            </button>
          </div>

          {activeTab === 'signin' && !forgotMode ? (
            <form className="auth-form" onSubmit={handleSignIn}>
              <div className="input-group">
                <label htmlFor="signin-username">Email or Username</label>
                <div className="input-field">
                  <span className="input-icon">@</span>
                  <input
                    id="signin-username"
                    name="username"
                    type="text"
                    value={signInData.username}
                    onChange={handleSignInChange}
                    placeholder="you@example.com"
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="input-group">
                <label htmlFor="signin-account-type">Account Type</label>
                <div className="input-field">
                  <span className="input-icon">+</span>
                  <select
                    id="signin-account-type"
                    name="accountType"
                    value={signInData.accountType}
                    onChange={handleSignInChange}
                  >
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>

              <div className="input-group">
                <label htmlFor="signin-password">Password</label>
                <div className="input-field">
                  <span className="input-icon">*</span>
                  <input
                    id="signin-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={signInData.password}
                    onChange={handleSignInChange}
                    placeholder="Enter password"
                    autoComplete="current-password"
                  />
                  <button type="button" className="icon-button" onClick={() => setShowPassword((prev) => !prev)}>
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div className="form-meta">
                <label className="checkbox-field">
                  <input
                    name="rememberMe"
                    type="checkbox"
                    checked={signInData.rememberMe}
                    onChange={handleSignInChange}
                  />
                  Remember Me
                </label>
                <button type="button" className="link-button" onClick={openForgotPassword}>Forgot Password?</button>
              </div>

              <button type="submit" className="primary-button" disabled={loading}>
                {loading ? 'Signing in...' : 'Login to your account'}
              </button>
            </form>
          ) : activeTab === 'signin' && forgotMode ? (
            <form className="auth-form" onSubmit={forgotStep === 'request' ? requestPasswordReset : resetPassword}>
              <div>
                <p className="eyebrow">Account recovery</p>
                <h3>{forgotStep === 'request' ? 'Request a reset code' : 'Create a new password'}</h3>
              </div>

              <div className="input-group">
                <label htmlFor="forgot-username">Email or Username</label>
                <div className="input-field">
                  <span className="input-icon">@</span>
                  <input id="forgot-username" name="username" type="text" value={forgotData.username} onChange={handleForgotChange} autoComplete="username" />
                </div>
              </div>

              {forgotStep === 'reset' ? (
                <>
                  <div className="input-group">
                    <label htmlFor="forgot-otp">OTP</label>
                    <div className="input-field">
                      <span className="input-icon">#</span>
                      <input id="forgot-otp" name="otp" type="text" value={forgotData.otp} onChange={handleForgotChange} inputMode="numeric" autoComplete="one-time-code" />
                    </div>
                  </div>
                  <div className="input-group">
                    <label htmlFor="forgot-new-password">New Password</label>
                    <div className="input-field">
                      <span className="input-icon">*</span>
                      <input id="forgot-new-password" name="newPassword" type="password" value={forgotData.newPassword} onChange={handleForgotChange} autoComplete="new-password" />
                    </div>
                  </div>
                  <div className="input-group">
                    <label htmlFor="forgot-confirm-password">Confirm New Password</label>
                    <div className="input-field">
                      <span className="input-icon">*</span>
                      <input id="forgot-confirm-password" name="confirmPassword" type="password" value={forgotData.confirmPassword} onChange={handleForgotChange} autoComplete="new-password" />
                    </div>
                  </div>
                </>
              ) : null}

              <button type="submit" className="primary-button" disabled={loading}>
                {loading ? 'Please wait...' : forgotStep === 'request' ? 'Send reset code' : 'Reset password'}
              </button>
              <button type="button" className="link-button" onClick={closeForgotPassword}>Back to sign in</button>
            </form>
          ) : (
            <form className="auth-form" onSubmit={handleSignUp}>
              <div className="input-group">
                <label htmlFor="signup-fullname">Full Name</label>
                <div className="input-field">
                  <span className="input-icon">👤</span>
                  <input
                    id="signup-fullname"
                    name="fullName"
                    type="text"
                    value={signUpData.fullName}
                    onChange={handleSignUpChange}
                    placeholder="Firstname Lastname"
                    autoComplete="name"
                  />
                </div>
              </div>

              <div className="input-group">
                <label htmlFor="signup-email">Email Address</label>
                <div className="input-field">
                  <span className="input-icon">@</span>
                  <input
                    id="signup-email"
                    name="email"
                    type="email"
                    value={signUpData.email}
                    onChange={handleSignUpChange}
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="input-group">
                <label htmlFor="signup-phone">Phone Number</label>
                <div className="input-field">
                  <span className="input-icon">☎</span>
                  <input
                    id="signup-phone"
                    name="phone"
                    type="tel"
                    value={signUpData.phone}
                    onChange={handleSignUpChange}
                    placeholder="+1 234 567 890"
                    autoComplete="tel"
                  />
                </div>
              </div>

              <div className="input-group">
                <label htmlFor="signup-password">Password</label>
                <div className="input-field">
                  <span className="input-icon">*</span>
                  <input
                    id="signup-password"
                    name="password"
                    type={showSignUpPassword ? 'text' : 'password'}
                    value={signUpData.password}
                    onChange={handleSignUpChange}
                    placeholder="Create password"
                    autoComplete="new-password"
                  />
                  <button type="button" className="icon-button" onClick={() => setShowSignUpPassword((prev) => !prev)}>
                    {showSignUpPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div className="input-group">
                <label htmlFor="signup-confirm-password">Confirm Password</label>
                <div className="input-field">
                  <span className="input-icon">*</span>
                  <input
                    id="signup-confirm-password"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={signUpData.confirmPassword}
                    onChange={handleSignUpChange}
                    placeholder="Confirm password"
                    autoComplete="new-password"
                  />
                  <button type="button" className="icon-button" onClick={() => setShowConfirmPassword((prev) => !prev)}>
                    {showConfirmPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <button type="submit" className="primary-button" disabled={loading}>
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
            </form>
          )}
        </section>
      </div>

      {toast ? (
        <div className={`toast toast-${toast.type}`}>{toast.text}</div>
      ) : null}
    </div>
  );
}

function DashboardPage() {
  const [summary, setSummary] = useState({ totalMedicines: 0, totalStock: 0 });
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    request('/medicines/summary')
      .then(setSummary)
      .catch((err) => setError(err.message));
  }, []);

  async function handleSearch(event) {
    event.preventDefault();
    setError('');
    setResult(null);

    if (!query.trim()) {
      setError('Enter a medicine name');
      return;
    }

    try {
      const medicines = await request(`/search/${encodeURIComponent(query.trim())}`);
      setResult(medicines?.[0] || null);
      if (!medicines?.length) setError('Medicine not found');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="content-grid dashboard-layout">
      <section className="dashboard-hero card">
        <div>
          <p className="eyebrow">Staff dashboard</p>
          <h1>Medicine locator and store overview</h1>
          <p className="dashboard-text">
            Search medicines instantly, verify rack placement, and monitor live stock from the same source of truth.
          </p>
        </div>
        <div className="hero-chip-stack">
          <div className="hero-chip">
            <span>Medicine count</span>
            <strong>{summary.totalMedicines}</strong>
          </div>
          <div className="hero-chip">
            <span>Total stock units</span>
            <strong>{summary.totalStock}</strong>
          </div>
        </div>
      </section>

      <div className="stats-row">
        <div className="card stat-card accent-card"><span>Fast lookup</span><strong>Search by name</strong></div>
        <div className="card stat-card accent-card"><span>Store location</span><strong>Rack / Shelf</strong></div>
        <div className="card stat-card accent-card"><span>Operations</span><strong>Store workflow</strong></div>
      </div>

      <section className="card surface-card">
        <div className="section-header">
          <div>
            <h2>Medicine search</h2>
            <p>Type a product name and jump directly to the storage location.</p>
          </div>
        </div>
        <form className="search-row" onSubmit={handleSearch}>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search medicine name" />
          <button type="submit">Find medicine</button>
        </form>
        {error ? <p className="message error">{error}</p> : null}
        {result ? (
          <div className="result-card soft-glow">
            <div>
              <p className="result-tag">Found medicine</p>
              <strong>{result.name}</strong>
              <p>Company: {result.company || '-'}</p>
            </div>
            <div className="result-meta">
              <span>₹{result.price}</span>
              <span>Stock: {result.quantity}</span>
              <span>Rack: {result.rack || '-'}</span>
              <span>Shelf: {result.shelf || '-'}</span>
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <strong>No medicine selected yet</strong>
            <p>Search a medicine to see its pricing, quantity, and shelf location.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function AttendancePage({ user }) {
  const [today, setToday] = useState(null);
  const [history, setHistory] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function loadAttendance() {
    if (!user?._id) return;
    const [todayData, historyData] = await Promise.all([
      request(`/attendance/${user._id}/today`),
      request(`/attendance/${user._id}`)
    ]);
    setToday(todayData);
    setHistory(historyData || []);
  }

  useEffect(() => {
    loadAttendance().catch((err) => setMessage(err.message));
  }, [user]);

  async function mark(type) {
    if (!user?._id) return;
    try {
      setLoading(true);
      setMessage('');
      if (type === 'checkin') {
        await request('/attendance/checkin', {
          method: 'POST',
          body: JSON.stringify({ user_id: user._id, username: user.username, status: 'present' })
        });
      } else {
        await request('/attendance/checkout', {
          method: 'POST',
          body: JSON.stringify({ user_id: user._id })
        });
      }
      await loadAttendance();
      setMessage(type === 'checkin' ? 'Check-in recorded' : 'Check-out recorded');
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="content-grid">
      <section className="page-header card page-banner">
        <div>
          <p className="eyebrow">Attendance</p>
          <h1>Your attendance</h1>
          <p className="dashboard-text">Quick check-in and check-out actions with a clean history view.</p>
        </div>
      </section>

      {message ? <p className="message error">{message}</p> : null}

      <div className="stats-row">
        <div className="card stat-card"><span>Today</span><strong>{today?.marked ? today.status : 'Not marked'}</strong></div>
        <div className="card stat-card"><span>Last update</span><strong>{today?.timestamp ? new Date(today.timestamp).toLocaleString() : '-'}</strong></div>
      </div>

      <section className="card surface-card">
        <div className="page-actions">
          <button onClick={() => mark('checkin')} disabled={loading}>Check In</button>
          <button onClick={() => mark('checkout')} disabled={loading}>Check Out</button>
          <button className="secondary-button" onClick={() => loadAttendance().catch((err) => setMessage(err.message))} disabled={loading}>Refresh</button>
        </div>
      </section>

      <section className="card">
        <h2>Recent history</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Status</th>
                <th>Check in</th>
                <th>Check out</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item._id}>
                  <td>{item.date ? new Date(item.date).toLocaleDateString() : '-'}</td>
                  <td>{item.status || '-'}</td>
                  <td>{item.check_in ? new Date(item.check_in).toLocaleString() : '-'}</td>
                  <td>{item.check_out ? new Date(item.check_out).toLocaleString() : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ProfilePage({ user, onUserChange }) {
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setName(user?.name || '');
    setEmail(user?.email || '');
    setPhone(user?.phone || '');
  }, [user]);

  async function saveProfile(event) {
    event.preventDefault();
    if (!user?._id) return;

    try {
      setLoading(true);
      setMessage('');
      const updated = await request(`/staff/${user._id}/profile`, {
        method: 'PUT',
        body: JSON.stringify({ name, email, phone })
      });
      const nextUser = { ...user, ...updated };
      saveUser(nextUser);
      onUserChange(nextUser);
      setMessage('Profile saved');
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="content-grid">
      <section className="page-header card page-banner">
        <div>
          <p className="eyebrow">Profile</p>
          <h1>Your account</h1>
          <p className="dashboard-text">Keep staff details clean and ready for billing, attendance, and messaging flows.</p>
        </div>
      </section>

      {message ? <p className="message error">{message}</p> : null}

      <section className="card surface-card">
        <form className="stack" onSubmit={saveProfile}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" />
          <button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save profile'}</button>
        </form>
      </section>
    </div>
  );
}

function AdminAttendancePage() {
  const [staff, setStaff] = useState([]);
  const [records, setRecords] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    Promise.all([request('/staff'), request('/attendance-report/all')])
      .then(([staffData, recordsData]) => {
        setStaff(staffData || []);
        setRecords(recordsData || []);
      })
      .catch((err) => setMessage(err.message));
  }, []);

  async function markAttendance(status) {
    if (!selectedUser) {
      setMessage('Select a staff member first');
      return;
    }

    try {
      setMessage('');
      await request('/attendance/mark', {
        method: 'POST',
        body: JSON.stringify({ user_id: selectedUser, status })
      });
      const nextRecords = await request('/attendance-report/all');
      setRecords(nextRecords || []);
      setMessage(`Marked ${status}`);
    } catch (err) {
      setMessage(err.message);
    }
  }

  return (
    <div className="content-grid">
      <section className="page-header card page-banner">
        <div>
          <p className="eyebrow">Attendance</p>
          <h1>Mark staff attendance</h1>
          <p className="dashboard-text">Admin controls for daily check-in, check-out, and leave tracking.</p>
        </div>
      </section>

      {message ? <p className="message error">{message}</p> : null}

      <section className="card surface-card">
        <div className="stack">
          <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)}>
            <option value="">Select staff member</option>
            {staff.map((item) => (
              <option key={item._id} value={item._id}>{item.name || item.username}</option>
            ))}
          </select>
          <div className="page-actions">
            <button onClick={() => markAttendance('present')}>Present</button>
            <button onClick={() => markAttendance('absent')}>Absent</button>
            <button onClick={() => markAttendance('leave')}>Leave</button>
          </div>
        </div>
      </section>

      <section className="card surface-card">
        <h2>Recent records</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Staff</th>
                <th>Date</th>
                <th>Status</th>
                <th>Check in</th>
                <th>Check out</th>
              </tr>
            </thead>
            <tbody>
              {records.map((item) => (
                <tr key={item._id}>
                  <td>{item.username || '-'}</td>
                  <td>{item.date ? new Date(item.date).toLocaleDateString() : '-'}</td>
                  <td>{item.status || '-'}</td>
                  <td>{item.check_in ? new Date(item.check_in).toLocaleString() : '-'}</td>
                  <td>{item.check_out ? new Date(item.check_out).toLocaleString() : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function BillingPage() {
  const [query, setQuery] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [cart, setCart] = useState({});
  const [invoice, setInvoice] = useState(null);
  const [message, setMessage] = useState('');

  const items = Object.values(cart);
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  async function searchMedicine(event) {
    event.preventDefault();
    try {
      setMessage('');
      const medicines = await request(`/search/${encodeURIComponent(query.trim())}`);
      setSearchResult(medicines?.[0] || null);
      if (!medicines?.length) setMessage('Medicine not found');
    } catch (err) {
      setMessage(err.message);
    }
  }

  function addToCart() {
    if (!searchResult?._id) return;
    setCart((current) => ({
      ...current,
      [searchResult._id]: {
        id: searchResult._id,
        name: searchResult.name,
        price: Number(searchResult.price) || 0,
        quantity: (current[searchResult._id]?.quantity || 0) + 1
      }
    }));
  }

  function changeQuantity(id, nextQuantity) {
    setCart((current) => {
      const next = { ...current };
      if (nextQuantity <= 0) {
        delete next[id];
      } else {
        next[id] = { ...next[id], quantity: nextQuantity };
      }
      return next;
    });
  }

  async function checkout() {
    try {
      setMessage('');
      const response = await request('/billing', {
        method: 'POST',
        body: JSON.stringify({ items: cart })
      });
      setInvoice(response);
      setCart({});
    } catch (err) {
      setMessage(err.message);
    }
  }

  return (
    <div className="content-grid billing-layout">
      <section className="page-header card page-banner billing-banner">
        <div>
          <p className="eyebrow">Billing</p>
          <h1>Cart and invoice</h1>
          <p className="dashboard-text">Search medicine, build a cart, and generate a billing summary in one place.</p>
        </div>
        <div className="hero-chip">
          <span>Subtotal</span>
          <strong>₹{subtotal}</strong>
        </div>
      </section>

      {message ? <p className="message error">{message}</p> : null}

      <section className="card surface-card">
        <form className="search-row" onSubmit={searchMedicine}>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search medicine" />
          <button type="submit">Search</button>
        </form>
        {searchResult ? (
          <div className="result-card" style={{ marginTop: '16px' }}>
            <div>
              <strong>{searchResult.name}</strong>
              <p>{searchResult.company || '-'}</p>
            </div>
            <button type="button" onClick={addToCart}>Add to cart</button>
          </div>
        ) : null}
      </section>

      <section className="card surface-card">
        <div className="section-header">
          <div>
            <h2>Cart</h2>
            <p>Live item totals before checkout.</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Price</th>
                <th>Qty</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>₹{item.price}</td>
                  <td>
                    <div className="quantity-controls">
                      <button type="button" className="secondary-button" onClick={() => changeQuantity(item.id, item.quantity - 1)}>-</button>
                      <span>{item.quantity}</span>
                      <button type="button" className="secondary-button" onClick={() => changeQuantity(item.id, item.quantity + 1)}>+</button>
                    </div>
                  </td>
                  <td>₹{item.price * item.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="page-actions" style={{ justifyContent: 'space-between', marginTop: '16px' }}>
          <strong>Total: ₹{subtotal}</strong>
          <button type="button" onClick={checkout} disabled={!items.length}>Checkout</button>
        </div>
      </section>

      {invoice ? (
        <section className="card surface-card">
          <h2>Invoice</h2>
          <pre className="json-box">{JSON.stringify(invoice, null, 2)}</pre>
        </section>
      ) : null}
    </div>
  );
}

function AdminPage() {
  const [analytics, setAnalytics] = useState({ totalMedicines: 0, totalStock: 0, totalStaff: 0 });
  const [staff, setStaff] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      request('/analytics'),
      request('/staff')
    ])
      .then(([analyticsData, staffData]) => {
        setAnalytics(analyticsData);
        setStaff(staffData || []);
      })
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="content-grid admin-layout">
      <section className="page-header card page-banner">
        <div>
          <p className="eyebrow">Admin panel</p>
          <h1>Operations overview</h1>
          <p className="dashboard-text">Monitor medicines, stock, and staff from a polished command center.</p>
        </div>
      </section>

      {error ? <p className="message error">{error}</p> : null}

      <div className="stats-row">
        <div className="card stat-card"><span>Total Medicines</span><strong>{analytics.totalMedicines}</strong></div>
        <div className="card stat-card"><span>Total Stock</span><strong>{analytics.totalStock}</strong></div>
        <div className="card stat-card"><span>Total Staff</span><strong>{analytics.totalStaff}</strong></div>
      </div>

      <section className="card surface-card">
        <div className="section-header">
          <div>
            <h2>Staff</h2>
            <p>Active pharmacy staff roster and contact details.</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Email</th>
                <th>Phone</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((item) => (
                <tr key={item._id}>
                  <td>{item.name || '-'}</td>
                  <td>{item.username}</td>
                  <td>{item.email || '-'}</td>
                  <td>{item.phone || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ScannerPage() {
  return (
    <div className="content-grid">
      <section className="page-header card page-banner">
        <div>
          <p className="eyebrow">Scanner</p>
          <h1>Barcode lookup</h1>
          <p className="dashboard-text">Ready for a barcode scanner or a simple search input later.</p>
        </div>
      </section>
      <section className="card surface-card">
        <p>This route is ready for a scanner component if you want to add one later.</p>
      </section>
    </div>
  );
}

function AnalyticsPage() {
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    request('/analytics')
      .then(setAnalytics)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="content-grid">
      <section className="page-header card page-banner">
        <div>
          <p className="eyebrow">Analytics</p>
          <h1>Sales and inventory snapshot</h1>
          <p className="dashboard-text">A compact view of the backend analytics response for quick business review.</p>
        </div>
      </section>
      {error ? <p className="message error">{error}</p> : null}
      <section className="card surface-card">
        <pre className="json-box">{JSON.stringify(analytics || {}, null, 2)}</pre>
      </section>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(loadUser);

  function handleLogout() {
    logout();
    setUser(null);
  }

  if (!user) {
    return <LoginPage onLogin={setUser} />;
  }

  return (
    <Shell user={user} onLogout={handleLogout}>
      <Routes>
        <Route path="/" element={<Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />} />
        <Route path="/dashboard" element={<RequireAuth user={user}><RequireRole user={user} role="staff"><DashboardPage /></RequireRole></RequireAuth>} />
        <Route path="/admin" element={<RequireAuth user={user}><RequireRole user={user} role="admin"><AdminPage /></RequireRole></RequireAuth>} />
        <Route path="/attendance" element={<RequireAuth user={user}><RequireRole user={user} role="staff"><AttendancePage user={user} /></RequireRole></RequireAuth>} />
        <Route path="/profile" element={<RequireAuth user={user}><RequireRole user={user} role="staff"><ProfilePage user={user} onUserChange={setUser} /></RequireRole></RequireAuth>} />
        <Route path="/admin-attendance" element={<RequireAuth user={user}><RequireRole user={user} role="admin"><AdminAttendancePage /></RequireRole></RequireAuth>} />
        <Route path="/billing" element={<RequireAuth user={user}><BillingPage /></RequireAuth>} />
        <Route path="/scanner" element={<RequireAuth user={user}><ScannerPage /></RequireAuth>} />
        <Route path="/analytics" element={<RequireAuth user={user}><RequireRole user={user} role="admin"><AnalyticsPage /></RequireRole></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}

export default App;