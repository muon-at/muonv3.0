import { useNavigate } from 'react-router-dom';

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
      {/* HEADER */}
      <div style={{
        padding: '2rem',
        textAlign: 'center',
        borderBottom: '1px solid #333',
      }}>
        <h1 style={{
          fontSize: '3rem',
          fontWeight: '900',
          margin: 0,
          color: '#fff',
          letterSpacing: '2px',
        }}>
          LIVE KRS
        </h1>
      </div>

      {/* CONTENT - Main area */}
      <div style={{
        flex: 1,
        paddingRight: '340px',
        paddingLeft: '2rem',
        paddingTop: '2rem',
        paddingBottom: '2rem',
        overflowY: 'auto',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#9ca3af',
        }}>
          <p>Live feed updates here...</p>
        </div>
      </div>

      {/* BACK BUTTON - Bottom left */}
      <button
        onClick={() => navigate(-1)}
        style={{
          position: 'fixed',
          bottom: '2rem',
          left: '2rem',
          padding: '0.75rem 1.5rem',
          background: '#666666',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          fontWeight: '600',
          cursor: 'pointer',
          fontSize: '1rem',
          zIndex: 100,
          transition: 'background 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = '#777777')}
        onMouseLeave={(e) => (e.currentTarget.style.background = '#666666')}
      >
        ← Tilbake
      </button>
    </div>
  );
}
