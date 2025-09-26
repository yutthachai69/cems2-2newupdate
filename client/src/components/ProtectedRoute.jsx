import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children, requiredRole = null, requiredPermission = null }) {
  const { user, isAuthenticated, loading } = useAuth();

  // แสดง loading ขณะตรวจสอบ authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  // ถ้ายังไม่ได้ login ให้แสดงหน้า "กรุณาเข้าสู่ระบบ"
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 max-w-md">
            <svg className="h-12 w-12 text-blue-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <h3 className="text-lg font-medium text-blue-800 mb-2">กรุณาเข้าสู่ระบบ</h3>
            <p className="text-blue-600">กรุณาเข้าสู่ระบบเพื่อเข้าถึงหน้านี้</p>
          </div>
        </div>
      </div>
    );
  }

  // ตรวจสอบ role ที่ต้องการ
  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/" replace />;
  }

  // ตรวจสอบ permission ที่ต้องการ
  if (requiredPermission && !user.permissions[requiredPermission]) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
            <svg className="h-12 w-12 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <h3 className="text-lg font-medium text-red-800 mb-2">ไม่มีสิทธิ์เข้าถึง</h3>
            <p className="text-red-600">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
          </div>
        </div>
      </div>
    );
  }

  return children;
}
