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

