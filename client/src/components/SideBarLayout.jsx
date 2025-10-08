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
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed((v) => !v)}
        />
      </aside>

      <main className="flex-1 min-w-0 bg-slate-50 flex flex-col">
        {/* Header with Login/User info */}
        <header className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b">
  <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-3 sm:py-4
                  grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-3">

    {/* ซ้าย: spacer สำหรับบาลานซ์หัวข้อบนจอ ≥ sm */}
    <div className="hidden sm:block" aria-hidden="true" />

    {/* กลาง: หัวข้อ – อยู่กลางจริง ๆ */}
    <h1
      className="text-center justify-self-center
                 text-xl sm:text-2xl font-extrabold text-gray-800 leading-tight"
    >
      Continuous Emission Monitoring Systems (CEMS)
    </h1>

    {/* ขวา: User/Login */}
    <div className="justify-self-center sm:justify-self-end">
      {isAuthenticated ? (
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="text-right leading-tight">
            <div className="text-sm font-medium text-gray-900 whitespace-nowrap">
              {user.role.toUpperCase()}
            </div>
          </div>

          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center shrink-0">
            {user.role.toLowerCase() === 'admin' ? (
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12A3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5a3.5 3.5 0 0 1-3.5 3.5m7.43-2.53c.04-.32.07-.64.07-.97c0-.33-.03-.66-.07-1l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.31-.61-.22l-2.49 1c-.52-.39-1.06-.73-1.69-.98l-.37-2.65A.506.506 0 0 0 14 2h-4c-.25 0-.46.18-.5.42l-.37 2.65c-.63.25-1.17.59-1.69.98l-2.49-1c-.22-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.34-.07.67-.07 1c0 .33.03.65.07.97l-2.11 1.66c-.19.15-.25.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1.01c.52.4 1.06.74 1.69.99l.37 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.37-2.65c.63-.26 1.17-.59 1.69-.99l2.49 1.01c.22.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.66Z"/>
              </svg>
            ) : (
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
            )}
          </div>

          <button
            onClick={logout}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors whitespace-nowrap"
            title="ออกจากระบบ"
          >
            <span className="hidden sm:inline">ออกจากระบบ</span>
            <span className="sm:hidden">ออก</span>
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowLoginModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white
                     px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span className="whitespace-nowrap">เข้าสู่ระบบ</span>
        </button>
      )}
    </div>
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
