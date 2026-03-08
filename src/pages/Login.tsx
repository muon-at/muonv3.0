import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/authContext';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import '../styles/Login.css';

export default function Login() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Auto-redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/min-side');
    }
  }, [isAuthenticated, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Vennligst fyll inn både e-post og passord');
      return;
    }

    setLoading(true);
    
    try {
      // Lookup employee by email in Firestore
      const employeesRef = collection(db, 'employees');
      const snapshot = await getDocs(employeesRef);
      
      let foundEmployee: any = null;
      const normalizedEmail = email.trim().toLowerCase();
      const trimmedPassword = password.trim();
      
      console.log('🔍 Login attempt:', { email: normalizedEmail, passwordLength: trimmedPassword.length });
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        const dbEmail = (data.email || '').trim().toLowerCase();
        const dbPassword = (data.password || '').trim();
        
        console.log('🔄 Checking:', { 
          name: data.name, 
          dbEmail, 
          inputEmail: normalizedEmail,
          emailMatch: dbEmail === normalizedEmail,
          passwordMatch: dbPassword === trimmedPassword,
          archived: data.archived
        });
        
        // Check if email matches and password is correct (case-insensitive email)
        if (dbEmail === normalizedEmail && dbPassword === trimmedPassword && !data.archived) {
          console.log('✅ LOGIN SUCCESS:', data.name);
          foundEmployee = { id: doc.id, ...data };
        }
      });

      if (foundEmployee) {
        // Check if default password - must change it
        if (foundEmployee.password === '1234' || !foundEmployee.passwordChanged) {
          console.log('🔄 First login - redirecting to password reset');
          localStorage.setItem('tempEmployee', JSON.stringify(foundEmployee));
          navigate('/reset-password');
        } else {
          // Normal login
          console.log('✅ Logging in:', foundEmployee.name);
          login(foundEmployee.name, foundEmployee.id, foundEmployee.role, foundEmployee);
          navigate('/min-side');
        }
      } else {
        setError('Feil e-post eller passord');
        console.log('❌ Login failed for:', normalizedEmail);
        console.log('💾 Available employees:', snapshot.size);
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Feil ved innlogging. Prøv igjen.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        {/* Logo */}
        <div className="login-header">
          <div className="logo">muon</div>
          <h1>Admin Portal</h1>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="login-form">
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label htmlFor="email">E-post</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="f.eks stian@muonas.no"
              disabled={loading}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Passord</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                style={{ paddingRight: '2.5rem', width: '100%' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  padding: '0.5rem',
                  color: '#667eea',
                }}
                disabled={loading}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          {/* Removed role selector - comes from Firestore */}

          <button
            type="submit"
            className="login-button"
            disabled={loading}
          >
            {loading ? '🔄 Logger inn...' : '✅ Logg inn'}
          </button>

          {/* Rolle og prosjekt hentes fra Firestore */}
        </form>

        {/* Demo Test Mode */}
        <div style={{ marginTop: '2rem', padding: '1rem', background: '#fff8dc', borderRadius: '6px', textAlign: 'center' }}>
          <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.8rem', color: '#999' }}>🧪 Testing/Development:</p>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => {
                const demoUser = {
                  id: 'demo-owner',
                  name: 'Stian Abrahamsen',
                  role: 'owner',
                  department: 'MUON',
                  project: 'Muon',
                  email: 'stian@muonas.no',
                  externalName: 'Stian Abrahamsen',
                };
                login(demoUser.name, demoUser.id, demoUser.role, demoUser);
                navigate('/min-side');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#667eea',
                cursor: 'pointer',
                textDecoration: 'underline',
                fontSize: '0.9rem',
                padding: 0,
              }}
            >
              👑 Owner (Stian)
            </button>
            <span style={{ color: '#999' }}>·</span>
            <button
              type="button"
              onClick={() => {
                const demoUser = {
                  id: 'demo-employee',
                  name: 'Oliver T Jenssen',
                  role: 'employee',
                  department: 'KRS',
                  project: 'Allente',
                  email: 'oliver@muonas.no',
                  externalName: 'Oliver T Jenssen',
                };
                login(demoUser.name, demoUser.id, demoUser.role, demoUser);
                navigate('/min-side');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#10b981',
                cursor: 'pointer',
                textDecoration: 'underline',
                fontSize: '0.9rem',
                padding: 0,
              }}
            >
              👤 Employee (Oliver)
            </button>
            <span style={{ color: '#999' }}>·</span>
            <button
              type="button"
              onClick={() => {
                const demoUser = {
                  id: 'demo-employee-ajay',
                  name: 'Ajay Sureshkumar',
                  role: 'employee',
                  department: 'OSL',
                  project: 'Allente',
                  email: 'ajay@muonas.no',
                  externalName: 'Ajay Sureshkumar / selger',
                };
                login(demoUser.name, demoUser.id, demoUser.role, demoUser);
                navigate('/min-side');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#3b82f6',
                cursor: 'pointer',
                textDecoration: 'underline',
                fontSize: '0.9rem',
                padding: 0,
              }}
            >
              👤 Employee (Ajay)
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="login-footer">
          <p className="forgot-password">
            <a href="#">Glemt passord?</a>
          </p>
          <p className="signup">
            Ingen konto? <a href="#">Kontakt administrator</a>
          </p>
        </div>

        {/* Demo Info */}
        <div className="demo-info">
          <p>Demo: Bruk hvilken som helst e-post og passord</p>
        </div>
      </div>

      {/* Background decoration */}
      <div className="background-decoration">
        <div className="gradient-circle-1"></div>
        <div className="gradient-circle-2"></div>
      </div>
    </div>
  );
}
