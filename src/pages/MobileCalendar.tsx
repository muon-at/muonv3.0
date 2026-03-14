import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/authContext';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import '../styles/MobileCalendar.css';

const HOLIDAYS = [
  '2026-01-01', '2026-04-10', '2026-04-13', '2026-05-01', '2026-05-17',
  '2026-05-21', '2026-05-31', '2026-12-25', '2026-12-26'
];

const normalize = (str: string): string => {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\/\\]/g, '_')
    .toLowerCase()
    .trim();
};

const getStatusColor = (status: string): string => {
  switch (status) {
    case '09-16': return '#22c55e'; // green
    case '09-21': return '#3b82f6'; // blue
    case 'fri': return '#eab308'; // yellow
    case 'helligdag': return '#ef4444'; // red
    default: return '#e5e7eb'; // gray (empty)
  }
};

const getStatusLabel = (status: string): string => {
  switch (status) {
    case '09-16': return '09-16';
    case '09-21': return '09-21';
    case 'fri': return 'Fri';
    case 'helligdag': return 'Helligdag';
    default: return '';
  }
};

export default function MobileCalendar() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load statuses from Firestore
  useEffect(() => {
    const loadStatuses = async () => {
      if (!user) return;
      const normalizedName = normalize(user.externalName || user.name || '');
      try {
        const docRef = doc(db, 'calendar_statuses', normalizedName);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setStatuses(data.statuses || {});
        }
      } catch (error) {
        console.error('Error loading statuses:', error);
      }
    };
    loadStatuses();
  }, [user]);

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const isHoliday = (dateStr: string) => HOLIDAYS.includes(dateStr);

  const formatDate = (day: number) => {
    const year = currentMonth.getFullYear();
    const month = String(currentMonth.getMonth() + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    return `${year}-${month}-${dayStr}`;
  };

  const isWeekend = (day: number) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    return date.getDay() === 0 || date.getDay() === 6;
  };

  const handleDayClick = (day: number) => {
    if (!editMode) return;
    const dateStr = formatDate(day);
    const currentStatus = statuses[dateStr] || '';
    
    // Cycle: empty -> 09-16 -> 09-21 -> fri -> (helligdag auto, skip) -> empty
    let newStatus = '';
    if (!currentStatus) newStatus = '09-16';
    else if (currentStatus === '09-16') newStatus = '09-21';
    else if (currentStatus === '09-21') newStatus = 'fri';
    else if (currentStatus === 'fri') newStatus = '';
    
    setStatuses({
      ...statuses,
      [dateStr]: newStatus
    });
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const normalizedName = normalize(user.externalName || user.name || '');
      const docRef = doc(db, 'calendar_statuses', normalizedName);
      await setDoc(docRef, {
        statuses,
        updatedAt: serverTimestamp(),
        userId: user.id,
      }, { merge: true });
      setEditMode(false);
      console.log('✅ Kalender lagret!');
    } catch (error) {
      console.error('Error saving statuses:', error);
    } finally {
      setSaving(false);
    }
  };

  const daysInMonth = getDaysInMonth(currentMonth);
  const firstDay = getFirstDayOfMonth(currentMonth);
  const days = [];

  // Empty cells before month starts
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }

  // Days of month
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const monthName = currentMonth.toLocaleDateString('no-NO', { month: 'long', year: 'numeric' });

  return (
    <div className="mobile-calendar">
      <div className="calendar-header">
        <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}>
          ←
        </button>
        <h2>{monthName}</h2>
        <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}>
          →
        </button>
      </div>

      <div className="calendar-weekdays">
        <div>Man</div>
        <div>Tir</div>
        <div>Ons</div>
        <div>Tor</div>
        <div>Fre</div>
        <div>Lør</div>
        <div>Søn</div>
      </div>

      <div className="calendar-grid">
        {days.map((day, idx) => {
          if (day === null) {
            return <div key={`empty-${idx}`} className="calendar-day empty"></div>;
          }

          const dateStr = formatDate(day);
          const status = statuses[dateStr] || (isHoliday(dateStr) ? 'helligdag' : '');
          const color = getStatusColor(status);

          return (
            <div
              key={day}
              className={`calendar-day ${editMode ? 'editable' : ''}`}
              style={{
                backgroundColor: color,
                cursor: editMode ? 'pointer' : 'default',
              }}
              onClick={() => handleDayClick(day)}
            >
              <div className="day-number">{day}</div>
              {status && <div className="day-status">{getStatusLabel(status)}</div>}
            </div>
          );
        })}
      </div>

      <div className="calendar-controls">
        {!editMode ? (
          <button onClick={() => setEditMode(true)} className="edit-btn">
            Rediger
          </button>
        ) : (
          <>
            <button onClick={handleSave} className="save-btn" disabled={saving}>
              {saving ? 'Lagrer...' : 'Lagre'}
            </button>
            <button onClick={() => setEditMode(false)} className="cancel-btn">
              Avbryt
            </button>
          </>
        )}
      </div>

      <div className="calendar-legend">
        <div><span style={{ backgroundColor: '#22c55e' }}></span> 09-16</div>
        <div><span style={{ backgroundColor: '#3b82f6' }}></span> 09-21</div>
        <div><span style={{ backgroundColor: '#eab308' }}></span> Fri</div>
        <div><span style={{ backgroundColor: '#ef4444' }}></span> Helligdag</div>
      </div>
    </div>
  );
}
