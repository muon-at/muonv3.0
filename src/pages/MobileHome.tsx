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
  const [activeTab, setActiveTab] = useState('salg');
  const [showSaleModal, setShowSaleModal] = useState(false);

  if (!user) return <div>Laster...</div>;

  const cards = [
    { id: 'salg', label: 'MELD SALG', icon: '🔔', isCentral: true, position: 'center' },
    { id: 'livefeed', label: 'LIVEFEED', icon: '📱', position: 'top-left' },
    { id: 'minside', label: 'MIN SIDE', icon: '📊', position: 'top-right' },
    { id: 'kalender', label: 'KALENDER', icon: '📅', position: 'bottom-left' },
    { id: 'avdeling', label: 'MIN AVDELING', icon: '👥', position: 'bottom-right' },
    { id: 'prosjekt', label: 'MITT PROSJEKT', icon: '🏢', position: 'right' },
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
  if (activeTab !== 'salg') {
    return (
      <div className="mobile-tab-view">
        <button className="back-btn" onClick={() => setActiveTab('salg')}>← Tilbake</button>
        <div className="tab-content">
          {renderTab()}
        </div>
      </div>
    );
  }

  // Home screen with radial layout
  return (
    <div className="mobile-home-radial">
      <div className="radial-container">
        {/* CENTRAL BELL */}
        <button
          className="radial-card central"
          onClick={() => setShowSaleModal(true)}
        >
          <div className="card-icon">🔔</div>
          <div className="card-label">MELD SALG</div>
        </button>

        {/* SURROUNDING CARDS */}
        {cards.map((card) => {
          if (card.isCentral) return null;
          return (
            <button
              key={card.id}
              className={`radial-card ${card.position}`}
              onClick={() => setActiveTab(card.id)}
            >
              <div className="card-icon">{card.icon}</div>
              <div className="card-label">{card.label.split(' ')[0]}</div>
              {card.label.includes(' ') && (
                <div className="card-label-secondary">{card.label.split(' ')[1]}</div>
              )}
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
