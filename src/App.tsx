import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './lib/authContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import MinSide from './pages/MinSide';
import Chat from './pages/Chat';
import Teamleder from './pages/Teamleder';
import AdminDashboard from './pages/AdminDashboard';
import MobileHome from './pages/MobileHome';
import MobileChat from './pages/MobileChat';
import MobileChatConversation from './pages/MobileChatConversation';
import MobileMinSide from './pages/MobileMinSide';
import MobileGoals from './pages/MobileGoals';
import MobileLonn from './pages/MobileLonn';
import MobileTeam from './pages/MobileTeam';
import MobileCalendar from './pages/MobileCalendar';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/change-password-first-login" element={<ResetPassword />} />
          {/* Public preview route - no auth required */}
          <Route path="/min-side-preview" element={<MinSide />} />
          {/* Mobile home screen */}
          <Route 
            path="/home" 
            element={
              <ProtectedRoute requiredRole="employee">
                <MobileHome />
              </ProtectedRoute>
            } 
          />
          {/* Mobile chat screens */}
          <Route 
            path="/home/chat" 
            element={
              <ProtectedRoute requiredRole="employee">
                <MobileChat />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/home/chat/:type/:id" 
            element={
              <ProtectedRoute requiredRole="employee">
                <MobileChatConversation />
              </ProtectedRoute>
            } 
          />
          {/* Mobile min side screen */}
          <Route 
            path="/home/min-side" 
            element={
              <ProtectedRoute requiredRole="employee">
                <MobileMinSide />
              </ProtectedRoute>
            } 
          />
          {/* Mobile goals editor screen */}
          <Route 
            path="/home/mine-mal" 
            element={
              <ProtectedRoute requiredRole="employee">
                <MobileGoals />
              </ProtectedRoute>
            } 
          />
          {/* Mobile lønn screen */}
          <Route 
            path="/home/lonn" 
            element={
              <ProtectedRoute requiredRole="employee">
                <MobileLonn />
              </ProtectedRoute>
            } 
          />
          {/* Mobile team screen */}
          <Route 
            path="/home/team" 
            element={
              <ProtectedRoute requiredRole="employee">
                <MobileTeam />
              </ProtectedRoute>
            } 
          />
          {/* Mobile calendar screen */}
          <Route 
            path="/home/calendar" 
            element={
              <ProtectedRoute requiredRole="employee">
                <MobileCalendar />
              </ProtectedRoute>
            } 
          />
          {/* Protected route for normal use */}
          <Route 
            path="/min-side" 
            element={
              <ProtectedRoute requiredRole="employee">
                <MinSide />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/teamleder" 
            element={
              <ProtectedRoute requiredRole="teamleder">
                <Teamleder />
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

