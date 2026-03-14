import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/authContext';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import '../styles/MobileCalendar.css';

const HOLIDAY_MAP: Record<string, string> = {
  '2026-01-01': 'Nyttårsdag',
  '2026-04-02': 'Skjærtorsdag',
  '2026-04-03': 'Langfredag',
  '2026-04-05': '1. påskedag',
  '2026-04-06': '2. påskedag',
  '2026-05-01': 'Arbeidernes dag',
  '2026-05-14': 'Kristi himmelfartsdag',
  '2026-05-17': 'Grunnlovsdag',
  '2026-05-24': 'Første pinsedag',
  '2026-05-25': 'Andre pinsedag',
  '2026-12-25': 'Julaften',
  '2026-12-26': 'Andre juledag'
};

const HOLIDAYS = Object.keys(HOLIDAY_MAP);

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
    case '16-21': return '#ec4899'; // pink
    default: return '#e5e7eb'; // gray (empty)
  }
};

const getStatusLabel = (status: string): string => {
  switch (status) {
    case '09-16': return '09-16';
    case '09-21': return '09-21';
    case 'fri': return 'Fri';
    case 'helligdag': return 'Helligdag';
    case '16-21': return '16-21';
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
    // Returns 0-6 where 0 = Monday, 6 = Sunday (Norwegian week format)
    const dayOfWeek = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    return dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  };

  const isHoliday = (dateStr: string) => HOLIDAYS.includes(dateStr);

  const formatDate = (day: number) => {
    const year = currentMonth.getFullYear();
    const month = String(currentMonth.getMonth() + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    return `${year}-${month}-${dayStr}`;
  };

  const handleDayClick = (day: number) => {
    if (!editMode) return;
    const dateStr = formatDate(day);
    const currentStatus = statuses[dateStr] || '';
    
    // Cycle: empty -> 09-16 -> 09-21 -> 16-21 -> fri -> (helligdag auto, skip) -> empty
    let newStatus = '';
    if (!currentStatus) newStatus = '09-16';
    else if (currentStatus === '09-16') newStatus = '09-21';
    else if (currentStatus === '09-21') newStatus = '16-21';
    else if (currentStatus === '16-21') newStatus = 'fri';
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

  // Get holidays for current month
  const getHolidaysThisMonth = () => {
    const year = currentMonth.getFullYear();
    const month = String(currentMonth.getMonth() + 1).padStart(2, '0');
    const monthPrefix = `${year}-${month}`;
    
    const monthHolidays: Array<{ date: string; day: string; name: string }> = [];
    Object.entries(HOLIDAY_MAP).forEach(([dateStr, name]) => {
      if (dateStr.startsWith(monthPrefix)) {
        const day = dateStr.split('-')[2];
        monthHolidays.push({
          date: dateStr,
          day: day.replace(/^0/, ''),
          name
        });
      }
    });
    return monthHolidays.sort((a, b) => parseInt(a.day) - parseInt(b.day));
  };

  const monthHolidays = getHolidaysThisMonth();

  const monthName = currentMonth.toLocaleDateString('no-NO', { month: 'long', year: 'numeric' });

  return (
    <div className="mobile-calendar">
      <div className="calendar-header-top">
        <button className="back-btn" onClick={() => navigate('/home')}>
          ← Tilbake
        </button>
      </div>
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
        <div><span style={{ backgroundColor: '#ec4899' }}></span> 16-21</div>
        <div><span style={{ backgroundColor: '#eab308' }}></span> Fri</div>
        <div><span style={{ backgroundColor: '#ef4444' }}></span> Helligdag</div>
      </div>

      {monthHolidays.length > 0 && (
        <div className="month-holidays">
          <h3>Helligdager denne måneden</h3>
          <div className="holidays-list">
            {monthHolidays.map((holiday) => (
              <div key={holiday.date} className="holiday-item">
                <span className="holiday-date">{holiday.day}.</span>
                <span className="holiday-name">{holiday.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
