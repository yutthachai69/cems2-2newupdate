import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import SideBarLayout from './components/SideBarLayout'
import ProtectedRoute from './components/ProtectedRoute'
import LoginModal from './components/LoginModal'
import Home from './pages/Home'
import Status from './pages/Status'
import DataLogs from './pages/DataLogs'
import Blowback from './pages/Blowback'
import Graph from './pages/Graph'
import Config from './pages/Config'

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <>
      <SideBarLayout>
        <Routes>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<Home />} />
          
          {/* Routes ที่ต้องการ authentication */}
          {isAuthenticated ? (
            <>
              <Route path="/graph" element={<Graph />} />
              <Route path="/logs" element={<DataLogs />} />
              
              {/* Admin only routes */}
              <Route 
                path="/status" 
                element={
                  <ProtectedRoute requiredPermission="canAccessStatus">
                    <Status />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/blowback" 
                element={
                  <ProtectedRoute requiredPermission="canAccessStatus">
                    <Blowback />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/config" 
                element={
                  <ProtectedRoute requiredPermission="canAccessConfig">
                    <Config />
                  </ProtectedRoute>
                } 
              />
            </>
          ) : (
            /* เมื่อไม่ได้ล็อกอิน ให้ redirect ไปหน้า Home */
            <Route path="*" element={<Navigate to="/home" replace />} />
          )}
          
          <Route path="*" element={<h1>404 Not Found</h1>} />
        </Routes>
      </SideBarLayout>
      
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}