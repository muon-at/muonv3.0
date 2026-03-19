import '../styles/WallOfFame.css';

interface Props {
  department?: string;
  title?: string;
}

export default function WallOfFame({ title = 'WALL OF FAME' }: Props) {
  return (
    <div className="wall-of-fame-container">
      <h2 className="wall-of-fame-title">{title}</h2>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        flexDirection: 'column',
        gap: '1rem',
        padding: '2rem',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '3rem' }}>🚀</div>
        <h3 style={{ fontSize: '1.2rem', color: '#e2e8f0', margin: 0 }}>Coming Soon</h3>
        <p style={{ color: '#9ca3af', margin: 0, maxWidth: '300px' }}>
          Wall of Fame records system is being refined. We're working on getting the calculations perfect!
        </p>
      </div>
    </div>
  );
}
