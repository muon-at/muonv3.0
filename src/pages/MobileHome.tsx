import { useState } from 'react';
import { useAuth } from '../lib/authContext';
import MobileSaleModal from '../components/MobileSaleModal';
import MobileLivefeed from '../components/MobileLivefeed';
import MobileMinSide from '../components/MobileMinSide';
import MobileKalender from '../components/MobileKalender';
import MobileAvdeling from '../components/MobileAvdeling';
import MobileProsjekt from '../components/MobileProsjekt';
import '../styles/MobileHomeRadial.css';

export default function MobileHome() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('home');
  const [showSaleModal, setShowSaleModal] = useState(false);

  if (!user) return <div>Laster...</div>;

  // 5 cards positioned at perfect circle (72° apart)
  const cards = [
    { id: 'livefeed', label: 'LIVEFEED', icon: '📱', angle: 0 },      // Top (0°)
    { id: 'minside', label: 'MIN SIDE', icon: '📊', angle: 72 },      // Top-right (72°)
    { id: 'prosjekt', label: 'MITT PROSJEKT', icon: '🏢', angle: 144 }, // Bottom-right (144°)
    { id: 'avdeling', label: 'MIN AVDELING', icon: '👥', angle: 216 }, // Bottom-left (216°)
    { id: 'kalender', label: 'KALENDER', icon: '📅', angle: 288 },   // Top-left (288°)
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
        {/* CENTRAL BELL - CLICKABLE */}
        <button 
          className="bell-center"
          onClick={() => setShowSaleModal(true)}
          title="Meld salg"
        >
          🔔
        </button>

        {/* SURROUNDING CARDS - PERFECT CIRCLE */}
        {cards.map((card) => {
          const rad = (card.angle * Math.PI) / 180;
          const radius = 170; // Distance from center to card center (reduced to fit screen)
          const x = Math.sin(rad) * radius;
          const y = -Math.cos(rad) * radius;

          return (
            <button
              key={card.id}
              className="radial-card"
              onClick={() => setActiveTab(card.id)}
              style={{
                transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
              }}
            >
              <div className="card-icon">{card.icon}</div>
              <div className="card-label">{card.label}</div>
            </button>
          );
        })}
      </div>

      {/* SALE MODAL */}
      <MobileSaleModal 
        isOpen={showSaleModal} 
        onClose={() => setShowSaleModal(false)}
        userName={user.name}
        userDepartment={user.department || 'Ukjent'}
      />
    </div>
  );
}
