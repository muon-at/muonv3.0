import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/authContext';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { subscribeToWebPush, requestNotificationPermission } from '../lib/push-notification-handler';
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
      const isMobile = window.innerWidth < 769;
      navigate(isMobile ? '/home' : '/min-side');
    }
  }, [isAuthenticated, navigate]);

  // Fix autofilled input text color
  useEffect(() => {
    const inputs = document.querySelectorAll('.form-group input');
    
    inputs.forEach((input) => {
      const el = input as HTMLInputElement;
      
      // Listen for autofill changes
      const checkAndFixAutofill = () => {
        // If it has a value (likely autofilled), fix the text color
        if (el.value) {
          el.style.color = '#1f2937 !important';
          (el.style as any).webkitTextFillColor = '#1f2937 !important';
        }
      };
      
      // Check on focus (common autofill trigger)
      el.addEventListener('focus', checkAndFixAutofill);
      el.addEventListener('change', checkAndFixAutofill);
      el.addEventListener('input', checkAndFixAutofill);
      
      // Initial check
      checkAndFixAutofill();
    });

    // Also check after delay for async autofill
    const timer = setTimeout(() => {
      inputs.forEach((input) => {
        const el = input as HTMLInputElement;
        if (el.value) {
          el.style.color = '#1f2937 !important';
          (el.style as any).webkitTextFillColor = '#1f2937 !important';
        }
      });
    }, 100);

    return () => clearTimeout(timer);
  }, []);

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
        // Check if requiresPasswordChange flag is set by admin
        if (foundEmployee.requiresPasswordChange) {
          console.log('🔄 Admin-generated password - must create new password');
          localStorage.setItem('tempEmployee', JSON.stringify(foundEmployee));
          navigate('/change-password-first-login');
        } else if (foundEmployee.password === '1234' || !foundEmployee.passwordChanged) {
          // Legacy default password check
          console.log('🔄 First login (legacy) - redirecting to password reset');
          localStorage.setItem('tempEmployee', JSON.stringify(foundEmployee));
          navigate('/reset-password');
        } else {
          // Normal login
          console.log('✅ Logging in:', {
            name: foundEmployee.name,
            id: foundEmployee.id,
            role: foundEmployee.role,
            allData: foundEmployee
          });
          login(foundEmployee.name, foundEmployee.id, foundEmployee.role, foundEmployee);
          
          // Subscribe to Web Push immediately after login
          console.log('🔔 Subscribing to Web Push for user:', foundEmployee.id);
          requestNotificationPermission().then((granted) => {
            if (granted) {
              console.log('✅ Notification permission granted!');
              subscribeToWebPush(foundEmployee.id).then((subscription) => {
                if (subscription) {
                  console.log('✅ Web Push subscribed - will notify even when app closed!');
                } else {
                  console.warn('⚠️ Web Push subscription failed!');
                }
              }).catch((error) => {
                console.error('❌ Error in subscribeToWebPush:', error);
              });
            } else {
              console.warn('⚠️ Notification permission not granted!');
            }
          }).catch((error) => {
            console.error('❌ Error requesting notification permission:', error);
          });
          
          // On mobile: show home screen. On desktop: go to min-side
          const isMobile = window.innerWidth < 769;
          navigate(isMobile ? '/home' : '/min-side');
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
          <div className="logo">
            <span className="logo-part-1">Muo</span><span className="logo-connector logo-variant-4">N</span><span className="logo-part-2">exus</span>
          </div>
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
              placeholder="Skriv e-post"
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

        {/* Footer */}
        <div className="login-footer">
          <p className="forgot-password">
            <a href="#">Glemt passord?</a>
          </p>
          <p className="signup">
            Ingen konto? <a href="#">Kontakt administrator</a>
          </p>
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
