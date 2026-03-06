import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './lib/authContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import Login from './pages/Login';
import MinSide from './pages/MinSide';
import MinSideTest from './pages/MinSideTest';
import Chat from './pages/Chat';
import Teamleder from './pages/Teamleder';
import Admin from './pages/Admin';
import AdminDashboard from './pages/AdminDashboard';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route 
            path="/min-side" 
            element={
              <ProtectedRoute requiredRole="employee">
                <MinSide />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/min-side-test" 
            element={
              <ProtectedRoute requiredRole="employee">
                <MinSideTest />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/teamleder" 
            element={
              <ProtectedRoute requiredRole="teamlead">
                <Teamleder />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute requiredRole="owner">
                <Admin />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/admin-dashboard" 
            element={
              <ProtectedRoute requiredRole="owner">
                <AdminDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/chat" 
            element={
              <ProtectedRoute requiredRole="employee">
                <Chat />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;

