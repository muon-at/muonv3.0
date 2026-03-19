import { useState } from 'react';
import { useAuth } from '../lib/authContext';
import MobileSaleModal from '../components/MobileSaleModal';
import MobileLivefeed from '../components/MobileLivefeed';
import MobileMinSide from '../components/MobileMinSide';
import MobileKalender from '../components/MobileKalender';
import MobileAvdeling from '../components/MobileAvdeling';
import MobileProsjekt from '../components/MobileProsjekt';
import '../styles/MobileHome.css';

export default function MobileHome() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('salg');
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  if (!user) return <div>Laster...</div>;

  const tabs = [
    { id: 'salg', label: '🔔 Salg', icon: '🔔' },
    { id: 'livefeed', label: '📱 Feed', icon: '📱' },
    { id: 'minside', label: '📊 Min Side', icon: '📊' },
    { id: 'kalender', label: '📅 Kalender', icon: '📅' },
    { id: 'avdeling', label: '👥 Avdeling', icon: '👥' },
    { id: 'prosjekt', label: '🏢 Prosjekt', icon: '🏢' },
  ];

  const renderTab = () => {
    switch (activeTab) {
      case 'salg':
        return <div className="tab-content"><button onClick={() => setShowSaleModal(true)} className="meld-salg-btn">🔔 MELD SALG</button></div>;
      case 'livefeed':
        return <MobileLivefeed onNewPost={() => setUnreadCount(u => u + 1)} />;
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

  return (
    <div className="mobile-home">
      {/* MAIN CONTENT */}
      <div className="mobile-content">
        {renderTab()}
      </div>

      {/* BOTTOM TAB BAR */}
      <div className="mobile-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label.split(' ')[1]}</span>
            {tab.id === 'livefeed' && unreadCount > 0 && (
              <span className="tab-badge">{unreadCount}</span>
            )}
          </button>
        ))}
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
