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

export default function MobileProsjekt() {
  const [stats, setStats] = useState<AllDepts>({
    KRS: { today: 0, week: 0, month: 0 },
    OSL: { today: 0, week: 0, month: 0 },
    Skien: { today: 0, week: 0, month: 0 },
  });
  const [muonTotal, setMuonTotal] = useState({ day: 0, week: 0, month: 0 });
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
    let deptEmpsMap: { [dept: string]: Set<string> } = {
      KRS: new Set(),
      OSL: new Set(),
      Skien: new Set(),
    };

    const loadAndSubscribe = async () => {
      try {
        const empSnapshot = await getDocs(collection(db, 'employees'));
        console.log('🔍 MobileProsjekt: Employees loaded:', empSnapshot.size);

        empSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          const dept = data.avdeling || '';
          if (dept in deptEmpsMap) {
            deptEmpsMap[dept].add(data.name?.toLowerCase() || '');
          }
        });

        console.log('📊 Dept employees:', {
          KRS: deptEmpsMap.KRS.size,
          OSL: deptEmpsMap.OSL.size,
          Skien: deptEmpsMap.Skien.size,
        });

        // Call updateStats immediately
        await updateStats(deptEmpsMap);

        // Then set up listeners
        const unsubscribeLivefeed = onSnapshot(collection(db, 'livefeed_sales'), () => {
          console.log('🔄 Livefeed changed');
          updateStats(deptEmpsMap);
        });

        const unsubscribeArchive = onSnapshot(collection(db, 'allente_kontraktsarkiv'), () => {
          console.log('🔄 Archive changed');
          updateStats(deptEmpsMap);
        });

        setLoading(false);

        return () => {
          unsubscribeLivefeed();
          unsubscribeArchive();
        };
      } catch (error) {
        console.error('❌ Error loading Mitt Prosjekt:', error);
        setLoading(false);
      }
    };

    loadAndSubscribe();
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

  return (
    <div className="mobile-prosjekt-matrix">
      <h3>🏢 MITT PROSJEKT</h3>

      <div className="matrix-table">
        {/* HEADER ROW */}
        <div className="matrix-header">
          <div className="matrix-cell header-cell"></div>
          <div className="matrix-cell header-cell">I DAG</div>
          <div className="matrix-cell header-cell">UKE</div>
          <div className="matrix-cell header-cell">MÅNED</div>
        </div>

        {/* DEPT ROWS */}
        {depts.map((dept) => (
          <div key={dept} className="matrix-row">
            <div className="matrix-cell dept-label">{dept}</div>
            <div
              className="matrix-cell data-cell"
              style={{
                background: deptColors[dept as keyof typeof deptColors],
                borderColor: deptBorders[dept as keyof typeof deptBorders],
              }}
            >
              {stats[dept as keyof AllDepts]?.today || 0}
            </div>
            <div
              className="matrix-cell data-cell"
              style={{
                background: deptColors[dept as keyof typeof deptColors],
                borderColor: deptBorders[dept as keyof typeof deptBorders],
              }}
            >
              {stats[dept as keyof AllDepts]?.week || 0}
            </div>
            <div
              className="matrix-cell data-cell"
              style={{
                background: deptColors[dept as keyof typeof deptColors],
                borderColor: deptBorders[dept as keyof typeof deptBorders],
              }}
            >
              {stats[dept as keyof AllDepts]?.month || 0}
            </div>
          </div>
        ))}

        {/* MUON ROW */}
        <div className="matrix-row">
          <div className="matrix-cell dept-label muon">MUON</div>
          <div
            className="matrix-cell data-cell muon"
            style={{ background: '#1a1a3a', borderColor: '#7c3aed' }}
          >
            {muonTotal.day}
          </div>
          <div
            className="matrix-cell data-cell muon"
            style={{ background: '#1a1a3a', borderColor: '#7c3aed' }}
          >
            {muonTotal.week}
          </div>
          <div
            className="matrix-cell data-cell muon"
            style={{ background: '#1a1a3a', borderColor: '#7c3aed' }}
          >
            {muonTotal.month}
          </div>
        </div>
      </div>
    </div>
  );
}
