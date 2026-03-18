import { useState } from 'react';
import { useAuth } from '../lib/authContext';
import '../styles/Records.css';

export default function Records() {
  const { user } = useAuth();
  const [records] = useState<{ [key: string]: any }>({
    bestDay: { title: 'Beste dag', value: 12, date: '2026-03-15' },
    bestWeek: { title: 'Beste uke', value: 55, date: 'Uke 11' },
    bestMonth: { title: 'Beste måned', value: 210, date: 'Februar 2026' },
    bestYear: { title: 'Beste år', value: 1250, date: '2025' },
    allTime: { title: 'Totalt', value: 3847, date: 'All-time' },
  });

  if (!user) return <div className="records-container">Laster...</div>;

  return (
    <div className="records-container">
      <div className="records-content">
        <h1 className="user-header">{user?.name}</h1>

        {/* Top 3 Records */}
        <div className="records-grid-top">
          {Object.entries(records).slice(0, 3).map(([key, record]) => (
            <div key={key} className="record-plaque">
              <div className="plaque-icon">⭐</div>
              <div className="plaque-content">
                <div className="plaque-title">{record.title}</div>
                <div className="plaque-value-wreath">
                  <div className="wreath-left">🌿</div>
                  <div className="plaque-value">{record.value}</div>
                  <div className="wreath-right">🌿</div>
                </div>
                <div className="plaque-date">{record.date}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom 2 Records - Centered */}
        <div className="records-grid-bottom">
          {Object.entries(records).slice(3).map(([key, record]) => (
            <div key={key} className="record-plaque">
              <div className="plaque-icon">⭐</div>
              <div className="plaque-content">
                <div className="plaque-title">{record.title}</div>
                <div className="plaque-value-wreath">
                  <div className="wreath-left">🌿</div>
                  <div className="plaque-value">{record.value}</div>
                  <div className="wreath-right">🌿</div>
                </div>
                <div className="plaque-date">{record.date}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
