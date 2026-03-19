import { useState, useEffect } from 'react';
import { collection, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface DeptStats {
  today: number;
  week: number;
  month: number;
}

interface AllDepts {
  [dept: string]: DeptStats;
}

interface AllDeptsGoals {
  [dept: string]: { day: number; week: number; month: number };
}

export default function MobileProsjekt() {
  const [stats, setStats] = useState<AllDepts>({
    KRS: { today: 0, week: 0, month: 0 },
    OSL: { today: 0, week: 0, month: 0 },
    Skien: { today: 0, week: 0, month: 0 },
  });
  const [muonTotal, setMuonTotal] = useState({ day: 0, week: 0, month: 0 });
  const [goals, setGoals] = useState<AllDeptsGoals>({
    KRS: { day: 5, week: 20, month: 80 },
    OSL: { day: 5, week: 20, month: 80 },
    Skien: { day: 5, week: 20, month: 80 },
  });
  const [loading, setLoading] = useState(true);

  const deptColors = {
    KRS: '#1a3a52',
    OSL: '#1a3a2a',
    Skien: '#3a2a1a',
  };

  const deptBorders = {
    KRS: '#4db8ff',
    OSL: '#51cf66',
    Skien: '#ffa94d',
  };

  useEffect(() => {
    // Load all department goals
    getDocs(collection(db, 'department_goals')).then((snapshot) => {
      const goalsMap: AllDeptsGoals = {
        KRS: { day: 5, week: 20, month: 80 },
        OSL: { day: 5, week: 20, month: 80 },
        Skien: { day: 5, week: 20, month: 80 },
      };

      snapshot.forEach((doc) => {
        const data = doc.data();
        if (doc.id === 'KRS' || doc.id === 'OSL' || doc.id === 'Skien') {
          goalsMap[doc.id] = {
            day: data.day || 5,
            week: data.week || 20,
            month: data.month || 80,
          };
        }
      });

      setGoals(goalsMap);
    });

    // Load employee list
    let deptEmpsMap: { [dept: string]: Set<string> } = {
      KRS: new Set(),
      OSL: new Set(),
      Skien: new Set(),
    };

    getDocs(collection(db, 'employees')).then((empSnapshot) => {
      empSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        const dept = data.avdeling || '';
        if (dept in deptEmpsMap) {
          deptEmpsMap[dept].add(data.name?.toLowerCase() || '');
        }
      });

      // Real-time listener
      const unsubscribeLivefeed = onSnapshot(collection(db, 'livefeed_sales'), () => {
        updateStats(deptEmpsMap);
      });

      const unsubscribeArchive = onSnapshot(collection(db, 'allente_kontraktsarkiv'), () => {
        updateStats(deptEmpsMap);
      });

      setLoading(false);

      return () => {
        unsubscribeLivefeed();
        unsubscribeArchive();
      };
    });
  }, []);

  const updateStats = async (deptEmpsMap: { [dept: string]: Set<string> }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const statsMap: AllDepts = {
      KRS: { today: 0, week: 0, month: 0 },
      OSL: { today: 0, week: 0, month: 0 },
      Skien: { today: 0, week: 0, month: 0 },
    };

    let muonDay = 0,
      muonWeek = 0,
      muonMonth = 0;

    // Count livefeed
    const livefeedSnapshot = await getDocs(collection(db, 'livefeed_sales'));
    livefeedSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      const userName = data.userName?.toLowerCase() || '';

      for (const [dept, emps] of Object.entries(deptEmpsMap)) {
        if (emps.has(userName)) {
          statsMap[dept].today++;
          statsMap[dept].week++;
          statsMap[dept].month++;
          muonDay++;
          muonWeek++;
          muonMonth++;
          break;
        }
      }
    });

    // Count contracts
    const contractsSnapshot = await getDocs(collection(db, 'allente_kontraktsarkiv'));
    contractsSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      let selger = (data.selger || '').replace(/ \/ selger$/i, '').trim();
      const selgerLower = selger.toLowerCase();

      if (data.dato) {
        const [day, month, year] = data.dato.split('/').map(Number);
        if (day && month && year) {
          const contractDate = new Date(year, month - 1, day);
          contractDate.setHours(0, 0, 0, 0);

          for (const [dept, emps] of Object.entries(deptEmpsMap)) {
            if (emps.has(selgerLower)) {
              if (contractDate >= startOfWeek) {
                statsMap[dept].week++;
                muonWeek++;
              }
              if (contractDate >= startOfMonth) {
                statsMap[dept].month++;
                muonMonth++;
              }
              break;
            }
          }
        }
      }
    });

    setStats(statsMap);
    setMuonTotal({ day: muonDay, week: muonWeek, month: muonMonth });
  };

  if (loading) return <div className="loading">Laster prosjekt...</div>;

  const depts = ['KRS', 'OSL', 'Skien'];
  const muonGoal = {
    day: (goals.KRS?.day || 5) + (goals.OSL?.day || 5) + (goals.Skien?.day || 5),
    week: (goals.KRS?.week || 20) + (goals.OSL?.week || 20) + (goals.Skien?.week || 20),
    month: (goals.KRS?.month || 80) + (goals.OSL?.month || 80) + (goals.Skien?.month || 80),
  };

  return (
    <div className="mobile-prosjekt">
      <h3>🏢 MITT PROSJEKT</h3>

      {/* I DAG */}
      <div className="period-section">
        <div className="period-title">I DAG</div>
        <div className="dept-grid">
          {depts.map((dept) => (
            <div
              key={dept}
              className="dept-box"
              style={{
                background: deptColors[dept as keyof typeof deptColors],
                borderColor: deptBorders[dept as keyof typeof deptBorders],
              }}
            >
              <div className="dept-name">{dept}</div>
              <div className="dept-value">{stats[dept as keyof AllDepts]?.today || 0}</div>
              <div className="dept-goal">/ {goals[dept]?.day || 5}</div>
            </div>
          ))}
          <div className="dept-box muon" style={{ background: '#1a1a3a', borderColor: '#7c3aed' }}>
            <div className="dept-name">MUON</div>
            <div className="dept-value">{muonTotal.day}</div>
            <div className="dept-goal">/ {muonGoal.day}</div>
          </div>
        </div>
      </div>

      {/* UKE */}
      <div className="period-section">
        <div className="period-title">UKE</div>
        <div className="dept-grid">
          {depts.map((dept) => (
            <div
              key={dept}
              className="dept-box"
              style={{
                background: deptColors[dept as keyof typeof deptColors],
                borderColor: deptBorders[dept as keyof typeof deptBorders],
              }}
            >
              <div className="dept-name">{dept}</div>
              <div className="dept-value">{stats[dept as keyof AllDepts]?.week || 0}</div>
              <div className="dept-goal">/ {goals[dept]?.week || 20}</div>
            </div>
          ))}
          <div className="dept-box muon" style={{ background: '#1a1a3a', borderColor: '#7c3aed' }}>
            <div className="dept-name">MUON</div>
            <div className="dept-value">{muonTotal.week}</div>
            <div className="dept-goal">/ {muonGoal.week}</div>
          </div>
        </div>
      </div>

      {/* MÅNED */}
      <div className="period-section">
        <div className="period-title">MÅNED</div>
        <div className="dept-grid">
          {depts.map((dept) => (
            <div
              key={dept}
              className="dept-box"
              style={{
                background: deptColors[dept as keyof typeof deptColors],
                borderColor: deptBorders[dept as keyof typeof deptBorders],
              }}
            >
              <div className="dept-name">{dept}</div>
              <div className="dept-value">{stats[dept as keyof AllDepts]?.month || 0}</div>
              <div className="dept-goal">/ {goals[dept]?.month || 80}</div>
            </div>
          ))}
          <div className="dept-box muon" style={{ background: '#1a1a3a', borderColor: '#7c3aed' }}>
            <div className="dept-name">MUON</div>
            <div className="dept-value">{muonTotal.month}</div>
            <div className="dept-goal">/ {muonGoal.month}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
