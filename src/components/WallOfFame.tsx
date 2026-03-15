import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { RecordsCache } from '../utils/recordsCache';
import '../styles/Plaquet.css';

interface WallOfFameProps {
  recordsCache: RecordsCache;
}

export const WallOfFame: React.FC<WallOfFameProps> = ({ recordsCache }) => {
  const [empDeptMap, setEmpDeptMap] = useState<{ [emp: string]: string }>({});

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
        setEmpDeptMap(map);
      } catch (err) {
        console.error('Error loading employee departments:', err);
      }
    };
    loadEmpDepts();
  }, []);

  // Get top employee for each department and period
  const getTopForDept = (dept: string, period: 'dayBest' | 'weekBest' | 'monthBest') => {
    return Object.entries(recordsCache.employees || {})
      .filter(([emp]) => empDeptMap[emp] === dept)
      .sort((a, b) => b[1][period] - a[1][period])
      .map(([name, record]) => ({ name, count: record[period] }))[0];
  };

  const depts = ['KRS', 'OSL', 'Skien', 'Allente'];
  const empRecords = depts.map(dept => ({
    name: dept,
    day: getTopForDept(dept, 'dayBest'),
    week: getTopForDept(dept, 'weekBest'),
    month: getTopForDept(dept, 'monthBest'),
  }));

  const deptRecords = depts.map(dept => ({
    name: dept,
    record: recordsCache.departments?.[dept] || { dayBest: 0, weekBest: 0, monthBest: 0 },
  }));

  return (
    <div className="tab-content">
      <div className="content-title">
        <h3>🏆 Wall of Fame</h3>
        <p>All-time records - Beautiful plaques</p>
      </div>

      <div className="plaquet-container">
        {/* EMPLOYEE PLAQUES */}
        {empRecords.map((dept) => (
          <div key={`emp-${dept.name}`} className="plaquet">
            <div className="plaquet-content">
              <div className="plaquet-trophy">🏆</div>
              <div className="plaquet-title">{dept.name}</div>
              <div className="plaquet-subtitle">Best Employees</div>
              <div className="plaquet-records">
                <div className="plaquet-record">
                  <span className="plaquet-record-label">Day:</span>
                  <span className="plaquet-record-name">{dept.day ? dept.day[0].split(' ')[0] : '—'}</span>
                  <span className="plaquet-record-value">{dept.day ? dept.day[1].dayBest : '0'}</span>
                </div>
                <div className="plaquet-record">
                  <span className="plaquet-record-label">Week:</span>
                  <span className="plaquet-record-name">{dept.week ? dept.week[0].split(' ')[0] : '—'}</span>
                  <span className="plaquet-record-value">{dept.week ? dept.week[1].weekBest : '0'}</span>
                </div>
                <div className="plaquet-record">
                  <span className="plaquet-record-label">Month:</span>
                  <span className="plaquet-record-name">{dept.month ? dept.month[0].split(' ')[0] : '—'}</span>
                  <span className="plaquet-record-value">{dept.month ? dept.month[1].monthBest : '0'}</span>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* DEPARTMENT PLAQUES */}
        {deptRecords.map((dept) => (
          <div key={`dept-${dept.name}`} className="plaquet">
            <div className="plaquet-content">
              <div className="plaquet-trophy">🏢</div>
              <div className="plaquet-title">{dept.name}</div>
              <div className="plaquet-subtitle">Department Total</div>
              <div className="plaquet-records">
                <div className="plaquet-record">
                  <span className="plaquet-record-label">Day:</span>
                  <span className="plaquet-record-value">{dept.record.dayBest}</span>
                </div>
                <div className="plaquet-record">
                  <span className="plaquet-record-label">Week:</span>
                  <span className="plaquet-record-value">{dept.record.weekBest}</span>
                </div>
                <div className="plaquet-record">
                  <span className="plaquet-record-label">Month:</span>
                  <span className="plaquet-record-value">{dept.record.monthBest}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
