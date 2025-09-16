function Pill({ label, on, type = "status", category = "default", error = null }) {
  const getStatusColor = (type, on, category, error) => {
    if (error) {
      return "bg-yellow-50 border-yellow-200 text-yellow-800";
    }
    
    if (type === "alarm") {
      return on 
        ? "bg-red-50 border-red-200 text-red-800" 
        : "bg-gray-50 border-gray-200 text-gray-600";
    }
    
    // สีสำหรับ Status ตาม category - ใช้สีฟ้าทั้งหมด
    if (on) {
      return "bg-blue-50 border-blue-200 text-blue-800";
    }
    return "bg-gray-50 border-gray-200 text-gray-600";
  };

  const getDotColor = (type, on, category, error) => {
    if (error) {
      return "bg-yellow-500";
    }
    
    if (type === "alarm") {
      return on ? "bg-red-500" : "bg-gray-300";
    }
    
    if (on) {
      return "bg-blue-500";
    }
    return "bg-gray-300";
  };

  const getBadgeColor = (type, on, category, error) => {
    if (error) {
      return "bg-yellow-100 text-yellow-700";
    }
    
    if (type === "alarm") {
      return on 
        ? "bg-red-100 text-red-700" 
        : "bg-gray-200 text-gray-600";
    }
    
    if (on) {
      return "bg-blue-100 text-blue-700";
    }
    return "bg-gray-200 text-gray-600";
  };

  const getStatusText = (on, error) => {
    if (error) return "ERROR";
    return on ? "ON" : "OFF";
  };

  return (  
    <div className={`flex items-center justify-between rounded-lg border px-4 py-3 shadow-sm hover:shadow-md transition-all duration-200 ${getStatusColor(type, on, category, error)}`}>
      <div className="flex items-center gap-3">
        <span className={`inline-block w-3 h-3 rounded-full ${getDotColor(type, on, category, error)}`} />
        <span className="text-sm font-medium">{label}</span>
        {error && (
          <span className="text-xs text-yellow-600 ml-2" title={error}>
            ⚠️
          </span>
        )}
      </div>
      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${getBadgeColor(type, on, category, error)}`}>
        {getStatusText(on, error)}
      </span>
    </div>
  );
}


import { useState, useEffect, useRef } from "react";

const API = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000";
const WS_URL = "ws://127.0.0.1:8000";

export default function Status() {
    const [statusData, setStatusData] = useState({
      system_status: "online",
      active_alarms: 0,
      statuses: [],
      alarms: []
    });
    const [loading, setLoading] = useState(true);
    const [manualLoading, setManualLoading] = useState(false);
    const [lastUpdate, setLastUpdate] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const websocketRef = useRef(null);

    // ดึงข้อมูลจาก backend
    const fetchStatusData = async (retryCount = 0) => {
      try {
        setLoading(true);
        // เพิ่ม timeout เพื่อป้องกันการโหลดนานเกินไป
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // ลดเป็น 5 วินาที
        
        const response = await fetch(`${API}/api/status`, {
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
          }
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result) {
          setStatusData(result);
          setLastUpdate(new Date());
          setIsConnected(true);
        }
      } catch (error) {
        console.error("Failed to fetch status data:", error);
        
        // Retry mechanism - ลองใหม่สูงสุด 3 ครั้ง
        if (retryCount < 3 && (error.name === 'AbortError' || error.message.includes('Failed to fetch'))) {
          console.log(`Retrying... (${retryCount + 1}/3)`);
          setTimeout(() => {
            fetchStatusData(retryCount + 1);
          }, 2000); // รอ 2 วินาทีก่อนลองใหม่
          return;
        }
        
        // ไม่ใช้ mock data แล้ว - ให้ backend ส่งข้อมูลการ์ดทั้งหมดมา
        console.log("API failed, but backend should provide all cards by default");
        setIsConnected(false);
      } finally {
        setLoading(false);
      }
    };

    // Auto-refresh + Manual refresh
    useEffect(() => {
      // Initial fetch
      console.log("Status: Initial fetch");
      fetchStatusData();
      
      // Auto-refresh every 2 seconds
      console.log("Status: Setting up auto-refresh interval");
      const interval = setInterval(() => {
        console.log("Status: Auto-refresh triggered");
        // ไม่แสดง loading state สำหรับ auto-refresh
        fetchStatusData().catch(error => {
          console.log("Auto-refresh error:", error);
        });
      }, 2000);
      
      return () => {
        console.log("Status: Cleaning up interval");
        clearInterval(interval);
      };
    }, []);

    // ฟังก์ชัน acknowledge alarm
    const acknowledgeAlarm = async (alarmId) => {
      try {
        const response = await fetch(`${API}/api/alarms/${alarmId}/acknowledge`, {
          method: "POST",
          headers: { "Content-Type": "application/json" }
        });
        const result = await response.json();
        
        if (result.success) {
          // รีเฟรชข้อมูลหลังจาก acknowledge
          await fetchStatusData();
        } else {
          alert(`Failed to acknowledge alarm: ${result.message}`);
        }
      } catch (error) {
        console.error("Failed to acknowledge alarm:", error);
        alert("Failed to acknowledge alarm");
      }
    };

    // แปลงข้อมูลจาก backend เป็นรูปแบบที่ใช้ใน UI
    const alarms = statusData.alarms ? statusData.alarms.map(alarm => ({
      id: alarm.id,
      label: alarm.message,  // Backend ส่งมาเป็น .message
      active: !alarm.acknowledged,  // Backend ส่งมาเป็น .acknowledged (true=inactive, false=active)
      severity: alarm.severity || "high",
      timestamp: alarm.timestamp,
      error: alarm.error
    })) : [];

    const statuses = statusData.statuses ? statusData.statuses.map(status => ({
      id: status.id,
      label: status.name,
      active: status.status === "on",  // Backend ส่งมาเป็น "on"/"off" (lowercase)
      category: status.category || "default",
      description: status.description,
      error: status.error
    })) : [];

    return ( 
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">
                  System Status & Alarms
                </h1>
                <p className="text-gray-600 text-sm">Real-time monitoring of system components and alarm states</p>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">System Status</div>
                <div className={`text-sm font-mono ${statusData.system_status === "online" ? "text-green-600" : "text-red-600"}`}>
                  {statusData.system_status.toUpperCase()}
                </div>
                <div className="text-sm text-gray-500 mt-1">Active Alarms</div>
                <div className={`text-sm font-mono ${statusData.active_alarms > 0 ? "text-red-600" : "text-green-600"}`}>
                  {statusData.active_alarms}
                </div>
                <div className="text-sm text-gray-500 mt-1">Last updated</div>
                <div className="text-sm font-mono text-gray-700">
                  {lastUpdate ? lastUpdate.toLocaleString('th-TH', {
                    timeZone: 'Asia/Bangkok',
                    hour12: false
                  }) : '-'}
                </div>
                <div className="text-xs text-green-600 mt-1">🔄 Auto-refresh: ON</div>
                
                {/* ปุ่ม Refresh */}
                <div className="mt-3">
                  <button
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                    onClick={async () => {
                      console.log("Manual refresh clicked");
                      setManualLoading(true);
                      try {
                        await fetchStatusData();
                      } finally {
                        setManualLoading(false);
                      }
                    }}
                    disabled={manualLoading}
                  >
                    {manualLoading ? "Loading..." : "🔄 Refresh"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Alarm Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Alarm Status</h2>
                <p className="text-gray-600 text-sm">Critical system alarms requiring immediate attention</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {alarms.map((alarm, i) => (
                <Pill key={i} label={alarm.label} on={alarm.active} type="alarm" error={alarm.error} />
              ))}
            </div>
          </div>

          {/* Status Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">System Status</h2>
              <p className="text-gray-600 text-sm">Current operational status of system components</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {statuses.map((status, i) => (
                <Pill key={i} label={status.label} on={status.active} type="status" category={status.category} error={status.error} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
}