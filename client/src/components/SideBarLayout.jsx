// src/components/SidebarLayout.jsx
import { useEffect, useState } from "react";
import Sidebar from "./Sidebar.jsx";

export default function SidebarLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false);

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
        {/* จัดปุ่มกับหัวเรื่องให้อยู่บรรทัดเดียว */}
        <header className="sticky top-0 z-10 bg-white border-b px-4 py-3 ">
          <h1 className="text-lg font-semibold">
            Continuous Emission Monitoring Systems (CEMS)
          </h1>
        </header>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4">
          {children}
        </div>
      </main>
    </div>
  );
}
