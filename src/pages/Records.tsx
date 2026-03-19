import '../styles/Records.css';

export default function Records() {
  return (
    <div style={{
      marginLeft: '135px',
      paddingRight: '340px',
      paddingTop: '2rem',
      paddingBottom: '2rem',
      paddingLeft: '1.5rem',
      background: '#1a1a1a',
      minHeight: '100vh',
      color: '#e2e8f0',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1rem',
        padding: '2rem',
        textAlign: 'center',
        maxWidth: '400px',
      }}>
        <div style={{ fontSize: '4rem' }}>📋</div>
        <h1 style={{ fontSize: '1.8rem', fontWeight: '700', margin: 0 }}>Records</h1>
        <h2 style={{ fontSize: '1.2rem', color: '#9ca3af', margin: 0, fontWeight: 600 }}>Coming Soon</h2>
        <p style={{ color: '#9ca3af', margin: '1rem 0 0 0', lineHeight: '1.5' }}>
          Your personal records system is being refined. We're working on getting the calculations perfect!
        </p>
      </div>
    </div>
  );
}
