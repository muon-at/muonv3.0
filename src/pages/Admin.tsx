import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import EditEmployeeModal from '../components/EditEmployeeModal';
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

export default function Admin() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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

  const [modalMode, setModalMode] = useState<'edit' | 'create'>('edit');

  const handleEditClick = (emp: Employee) => {
    setEditingEmployee(emp);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const handleAddClick = () => {
    setEditingEmployee({
      id: '',
      name: '',
      email: '',
      department: '',
      role: '',
      project: '',
      slackName: '',
      externalName: '',
      tmgName: '',
      employment_type: '',
    });
    setModalMode('create');
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingEmployee(null);
  };

  const handleSave = (updatedEmployee: Employee) => {
    if (modalMode === 'create') {
      // Legg til ny ansatt i listen
      setEmployees([...employees, updatedEmployee].sort((a, b) => a.name.localeCompare(b.name)));
    } else {
      // Oppdater eksisterende ansatt
      setEmployees(
        employees.map((emp) =>
          emp.id === updatedEmployee.id ? updatedEmployee : emp
        )
      );
    }
  };

  if (loading) return <div className="dashboard"><div className="loading">Laster ansattliste...</div></div>;
  if (error) return <div className="dashboard error">{error}</div>;

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1>🔐 Admin - Ansatt Oversikt</h1>
          <p className="subtitle">Administrering av alle ansatte</p>
        </div>
        <div className="header-buttons">
          <button className="btn btn-add" onClick={handleAddClick}>
            ➕ Legg til ansatt
          </button>
          <button 
            className="btn btn-back"
            onClick={() => navigate('/teamleder')}
          >
            ← Tilbake
          </button>
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
                    <button className="btn btn-edit" onClick={() => handleEditClick(emp)}>Redigør</button>
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

      <EditEmployeeModal
        employee={editingEmployee}
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSave={handleSave}
        mode={modalMode}
      />
    </div>
  );
}
