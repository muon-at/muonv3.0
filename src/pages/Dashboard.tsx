import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import '../styles/Dashboard.css';

interface Employee {
  id: string;
  name: string;
  email?: string;
  department?: string;
  role?: string;
  project?: string;
  slackName?: string;
  externalName?: string;
  tmgName?: string;
  employment_type?: string;
}

const getRoleBadgeColor = (role: string) => {
  const roleColors: { [key: string]: string } = {
    owner: '#4f46e5',
    teamleder: '#6366f1',
    selger: '#10b981',
    tekniker: '#f59e0b',
    ansatt: '#6b7280',
  };
  return roleColors[role?.toLowerCase()] || '#6b7280';
};

export default function Dashboard() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const employeesRef = collection(db, 'employees');
        const snapshot = await getDocs(employeesRef);
        
        const employeeList: Employee[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          employeeList.push({
            id: doc.id,
            name: data.name || 'N/A',
            email: data.email,
            department: data.department,
            role: data.role,
            project: data.project,
            slackName: data.slackName,
            externalName: data.externalName,
            tmgName: data.tmgName,
            employment_type: data.employment_type,
          });
        });
        
        setEmployees(employeeList.sort((a, b) => a.name.localeCompare(b.name)));
      } catch (err) {
        setError(`Feil ved henting av data: ${err}`);
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchEmployees();
  }, []);

  if (loading) return <div className="dashboard"><div className="loading">Laster ansattliste...</div></div>;
  if (error) return <div className="dashboard error">{error}</div>;

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1>Muon Dashboard</h1>
          <p className="subtitle">Oversikt over ansatte</p>
        </div>
      </div>

      <div className="table-container">
        <table className="employees-table">
          <thead>
            <tr>
              <th>Navn</th>
              <th>Email</th>
              <th>Rolle</th>
              <th>Prosjekt</th>
              <th>Avdeling</th>
              <th>Slack Navn</th>
              <th>Type</th>
              <th>Ekstern Navn</th>
              <th>Handlinger</th>
            </tr>
          </thead>
          <tbody>
            {employees.length > 0 ? (
              employees.map((emp) => (
                <tr key={emp.id} className="employee-row">
                  <td className="name-cell">
                    <strong>{emp.name}</strong>
                  </td>
                  <td className="email-cell">{emp.email || '-'}</td>
                  <td className="role-cell">
                    {emp.role && (
                      <span 
                        className="role-badge"
                        style={{ backgroundColor: getRoleBadgeColor(emp.role) }}
                      >
                        {emp.role}
                      </span>
                    )}
                  </td>
                  <td>{emp.project || '-'}</td>
                  <td className="department-cell">{emp.department || '-'}</td>
                  <td>{emp.slackName || '-'}</td>
                  <td>{emp.employment_type || '-'}</td>
                  <td>{emp.externalName || '-'}</td>
                  <td className="actions-cell">
                    <button className="btn btn-edit">Redigør</button>
                    <button className="btn btn-delete">Slett</button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={9} className="no-data">Ingen ansatte å vise</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
