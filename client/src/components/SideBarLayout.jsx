// src/components/SidebarLayout.jsx
import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import Sidebar from "./Sidebar.jsx";
import LoginModal from "./LoginModal.jsx";

export default function SidebarLayout({ children }) {
  const { isAuthenticated, user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  useEffect(() => {
    const apply = () => setCollapsed(window.innerWidth < 1024);
    apply(); 
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);

  return (
    <div className="h-screen w-screen flex overflow-hidden">
      {/* ปรับความกว้างตาม collapsed + ใส่ transition */}
      <aside
        className={`shrink-0 transition-[width] duration-200 ${
          collapsed ? "w-16" : "w-60"
        }`}
      >
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />  
      </aside>

      <main className="flex-1 min-w-0 bg-slate-50 flex flex-col">
        {/* Header with Login/User info */}
        <header className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold">
            Continuous Emission Monitoring Systems (CEMS)
          </h1>
          
          {/* User/Login Section */}
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">{user.name}</div>
                  <div className="text-xs text-gray-500">{user.role.toUpperCase()}</div>
                </div>
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    {user.name.charAt(0)}
                  </span>
                </div>
                <button
                  onClick={logout}
                  className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                  title="ออกจากระบบ"
                >
                  ออกจากระบบ
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowLoginModal(true)}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                เข้าสู่ระบบ
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4">
          {children}
        </div>
      </main>
      
      {/* Login Modal */}
      <LoginModal 
        isOpen={showLoginModal} 
        onClose={() => setShowLoginModal(false)} 
      />
    </div>
  );
}
