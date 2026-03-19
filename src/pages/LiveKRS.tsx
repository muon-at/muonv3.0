import { useNavigate } from 'react-router-dom';
import LivefeedTicker from '../components/LivefeedTicker';

export default function LiveKRS() {
  const navigate = useNavigate();

  return (
    <div style={{
      background: '#000000',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      color: '#e2e8f0',
      position: 'relative',
    }}>
      {/* TICKER AT TOP */}
      <LivefeedTicker />

      {/* CONTENT - Main area */}
      <div style={{
        flex: 1,
        paddingLeft: '2rem',
        paddingTop: '2rem',
        paddingBottom: '2rem',
        paddingRight: '2rem',
        marginTop: '80px',
        overflowY: 'auto',
      }}>
        {/* Main content area */}
      </div>

      {/* BACK BUTTON - Bottom left */}
      <button
        onClick={() => navigate(-1)}
        style={{
          position: 'fixed',
          bottom: '2rem',
          left: '2rem',
          padding: 0,
          background: 'transparent',
          color: '#222222',
          border: 'none',
          borderRadius: 0,
          fontWeight: '400',
          cursor: 'pointer',
          fontSize: '0.5rem',
          zIndex: 100,
          transition: 'color 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#333333')}
        onMouseLeave={(e) => (e.currentTarget.style.color = '#222222')}
      >
        ← Tilbake
      </button>
    </div>
  );
}
