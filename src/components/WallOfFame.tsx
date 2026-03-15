import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { RecordsCache } from '../utils/recordsCache';
import '../styles/Plaquet.css';

interface WallOfFameProps {
  recordsCache: RecordsCache;
}

interface DeptRecords {
  day: { name: string; count: number } | null;
  week: { name: string; count: number } | null;
  month: { name: string; count: number } | null;
}

export const WallOfFame: React.FC<WallOfFameProps> = ({ recordsCache }) => {
  const [empDeptMap, setEmpDeptMap] = useState<{ [emp: string]: string }>({});
  const [deptRecords, setDeptRecords] = useState<{ [dept: string]: DeptRecords }>({
    KRS: { day: null, week: null, month: null },
    OSL: { day: null, week: null, month: null },
    Skien: { day: null, week: null, month: null },
    Allente: { day: null, week: null, month: null },
  });

  // Load employee departments on mount
  useEffect(() => {
    const loadEmpDepts = async () => {
      try {
        const empRef = collection(db, 'employees');
        const empSnap = await getDocs(empRef);
        const map: { [emp: string]: string } = {};
        empSnap.forEach(doc => {
          const data = doc.data();
          if (data.externalName) {
            map[data.externalName] = data.department || 'Allente';
          }
        });
        console.log('✅ Emp dept map loaded:', Object.keys(map).length, 'employees');
        setEmpDeptMap(map);
      } catch (err) {
        console.error('Error loading employee departments:', err);
      }
    };
    loadEmpDepts();
  }, []);

  // Calculate records for each department
  useEffect(() => {
    if (Object.keys(empDeptMap).length === 0) {
      console.log('⏳ Waiting for emp dept map...');
      return;
    }

    console.log('🔍 Filtering records for all departments...');
    const depts = ['KRS', 'OSL', 'Skien', 'Allente'];
    const results: { [dept: string]: DeptRecords } = {};

    depts.forEach(dept => {
      const deptEmps = Object.entries(recordsCache.employees || {})
        .filter(([emp]) => empDeptMap[emp] === dept)
        .map(([name, record]) => ({ 
          name, 
          dayBest: record.dayBest, 
          weekBest: record.weekBest, 
          monthBest: record.monthBest 
        }));

      console.log(`🏢 ${dept} employees found:`, deptEmps.length);

      if (deptEmps.length > 0) {
        const dayTop = deptEmps.reduce((a, b) => a.dayBest > b.dayBest ? a : b);
        const weekTop = deptEmps.reduce((a, b) => a.weekBest > b.weekBest ? a : b);
        const monthTop = deptEmps.reduce((a, b) => a.monthBest > b.monthBest ? a : b);

        results[dept] = {
          day: { name: dayTop.name, count: dayTop.dayBest },
          week: { name: weekTop.name, count: weekTop.weekBest },
          month: { name: monthTop.name, count: monthTop.monthBest },
        };
      } else {
        results[dept] = { day: null, week: null, month: null };
      }
    });

    setDeptRecords(results);
  }, [empDeptMap, recordsCache]);

  const depts = ['KRS', 'OSL', 'Skien', 'Allente'];

  const PlaqueCard = ({ dept, records }: { dept: string; records: DeptRecords }) => (
    <div className="plaquet">
      <div className="plaquet-content">
        <div className="plaquet-trophy">🏆</div>
        <div className="plaquet-title">{dept}</div>
        <div className="plaquet-subtitle">Rekorder</div>
        <div className="plaquet-records">
          <div className="plaquet-record">
            <span className="plaquet-record-label">Day:</span>
            <span className="plaquet-record-name">{records.day ? records.day.name.split(' ')[0] : '—'}</span>
            <span className="plaquet-record-value">{records.day ? records.day.count : '0'}</span>
          </div>
          <div className="plaquet-record">
            <span className="plaquet-record-label">Week:</span>
            <span className="plaquet-record-name">{records.week ? records.week.name.split(' ')[0] : '—'}</span>
            <span className="plaquet-record-value">{records.week ? records.week.count : '0'}</span>
          </div>
          <div className="plaquet-record">
            <span className="plaquet-record-label">Month:</span>
            <span className="plaquet-record-name">{records.month ? records.month.name.split(' ')[0] : '—'}</span>
            <span className="plaquet-record-value">{records.month ? records.month.count : '0'}</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="tab-content">
      <div className="content-title">
        <h3>🏆 Wall of Fame</h3>
        <p>Rekorder per avdeling</p>
      </div>

      <div className="plaquet-container">
        {depts.map(dept => (
          <PlaqueCard key={dept} dept={dept} records={deptRecords[dept]} />
        ))}
      </div>

      {/* DEBUG INFO */}
      <div style={{ marginTop: '2rem', padding: '1rem', background: '#f0f0f0', borderRadius: '8px', fontSize: '0.85rem' }}>
        <div>📊 recordsCache.employees: {Object.keys(recordsCache.employees || {}).length}</div>
        <div>🔗 empDeptMap: {Object.keys(empDeptMap).length}</div>
        <div style={{ marginTop: '0.5rem' }}>
          {depts.map(dept => (
            <div key={dept}>
              {dept}: Day={deptRecords[dept].day ? `${deptRecords[dept].day!.name} ${deptRecords[dept].day!.count}` : 'Loading...'} | Week={deptRecords[dept].week ? deptRecords[dept].week!.count : 'Loading...'} | Month={deptRecords[dept].month ? deptRecords[dept].month!.count : 'Loading...'}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
