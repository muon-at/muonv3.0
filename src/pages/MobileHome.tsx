import { useState } from 'react';
import { useAuth } from '../lib/authContext';
import MobileLivefeed from '../components/MobileLivefeed';
import MobileMinSide from '../components/MobileMinSide';
import MobileKalender from '../components/MobileKalender';
import MobileAvdeling from '../components/MobileAvdeling';
import MobileProsjekt from '../components/MobileProsjekt';
import '../styles/MobileHomeRadial.css';

export default function MobileHome() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('home');

  if (!user) return <div>Laster...</div>;

  const cards = [
    { id: 'livefeed', label: 'LIVEFEED', icon: '📱', position: 'top-left' },
    { id: 'minside', label: 'MIN SIDE', icon: '📊', position: 'top-right' },
    { id: 'prosjekt', label: 'MITT PROSJEKT', icon: '🏢', position: 'right' },
    { id: 'avdeling', label: 'MIN AVDELING', icon: '👥', position: 'bottom-right' },
    { id: 'kalender', label: 'KALENDER', icon: '📅', position: 'bottom-left' },
  ];

  const renderTab = () => {
    switch (activeTab) {
      case 'livefeed':
        return <MobileLivefeed />;
      case 'minside':
        return <MobileMinSide />;
      case 'kalender':
        return <MobileKalender />;
      case 'avdeling':
        return <MobileAvdeling />;
      case 'prosjekt':
        return <MobileProsjekt />;
      default:
        return null;
    }
  };

  // If viewing a tab, show full screen
  if (activeTab !== 'home') {
    return (
      <div className="mobile-tab-view">
        <button className="back-btn" onClick={() => setActiveTab('home')}>← Tilbake</button>
        <div className="tab-content">
          {renderTab()}
        </div>
      </div>
    );
  }

  // Home screen
  return (
    <div className="mobile-home-radial">
      <div className="radial-container">
        {/* CENTRAL BELL */}
        <div className="bell-center">
          🔔
        </div>

        {/* SURROUNDING CARDS */}
        {cards.map((card) => (
          <button
            key={card.id}
            className={`radial-card ${card.position}`}
            onClick={() => setActiveTab(card.id)}
          >
            <div className="card-icon">{card.icon}</div>
            <div className="card-label">{card.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
