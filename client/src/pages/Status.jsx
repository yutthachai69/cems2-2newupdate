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
import { StatusPageSkeleton } from "../components/SkeletonLoader";
import { useNotification, Notification, useSwitchAlert, SwitchAlert } from "../components/Notification";

const API = "http://127.0.0.1:8000";
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
    
    // ใช้ notification และ switch alert hooks
    const { notification, showNotification, hideNotification } = useNotification();
    const { switchAlert, showSwitchAlert, hideSwitchAlert } = useSwitchAlert();

    // ใช้ WebSocket เท่านั้น - ไม่มี HTTP fallback

    // WebSocket connection for real-time status data - ใช้วิธีง่ายๆ
    useEffect(() => {
        let ws = null;
        let reconnectTimeout = null;

        const connect = () => {
            if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
                return;
            }

            ws = new WebSocket(`${WS_URL}/ws/status`);

            ws.onopen = () => {
                // console.log("Status WebSocket connected");
                setIsConnected(true);
                setLoading(false); // หยุด skeleton loading
            };

            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    // console.log("Status WebSocket data received:", message);
                    
                    if (message.type === "status") {
                        setStatusData(message.data);
                        setLastUpdate(new Date());
                        setIsConnected(true);
                        setLoading(false); // หยุด skeleton loading เมื่อได้รับข้อมูล
                    }
                } catch (error) {
                    // console.error("Error parsing status WebSocket message:", error);
                }
            };

            ws.onerror = (e) => {
                // console.warn("Status WebSocket error:", e);
                setIsConnected(false);
                setLoading(false); // หยุด skeleton loading เมื่อเกิด error
            };

            ws.onclose = () => {
                // console.warn("Status WebSocket closed, reconnect in 2s");
                ws = null;
                setIsConnected(false);
                reconnectTimeout = setTimeout(connect, 2000);
            };
        };

        // ใช้ WebSocket เท่านั้น
        connect();

        return () => {
            if (ws) {
                ws.close();
                ws = null;
            }
            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
            }
        };
    }, []);

    // ฟังก์ชัน acknowledge alarm
    const acknowledgeAlarm = async (alarmId) => {
      // ยืนยันก่อนยืนยันการแจ้งเตือน
      const confirmed = await showSwitchAlert({
        title: "ยืนยันการแจ้งเตือน",
        message: "คุณแน่ใจหรือไม่ที่จะยืนยันการแจ้งเตือนนี้?",
        type: "warning",
        buttons: ["ยกเลิก", "ยืนยัน"]
      });

      if (!confirmed) return; // ถ้าไม่ยืนยัน ให้หยุด

      try {
        const response = await fetch(`${API}/api/alarms/${alarmId}/acknowledge`, {
          method: "POST",
          headers: { "Content-Type": "application/json" }
        });
        const result = await response.json();
        
        if (result.success) {
          // WebSocket จะอัปเดตข้อมูลอัตโนมัติ
          console.log("Alarm acknowledged successfully");
          showNotification("ยืนยันการแจ้งเตือนสำเร็จ", "success");
        } else {
          showNotification(`ยืนยันการแจ้งเตือนไม่สำเร็จ: ${result.message}`, "error");
        }
      } catch (error) {
        console.error("Failed to acknowledge alarm:", error);
        showNotification("ยืนยันการแจ้งเตือนไม่สำเร็จ", "error");
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

    // แสดง skeleton loading ถ้ากำลังโหลด
    if (loading) {
        return <StatusPageSkeleton />;
    }

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
                <div className="text-xs text-green-600 mt-1">Auto-refresh: ON</div>
                
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
                    {manualLoading ? "Loading..." : "Refresh"}
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
      
      {/* Notification Component */}
      <Notification 
        show={notification.show}
        message={notification.message}
        type={notification.type}
        onClose={hideNotification}
      />
      
      {/* Switch Alert Component */}
      <SwitchAlert 
        show={switchAlert.show}
        title={switchAlert.title}
        message={switchAlert.message}
        type={switchAlert.type}
        buttons={switchAlert.buttons}
        onClose={hideSwitchAlert}
        onConfirm={switchAlert.onConfirm}
      />
    </div>
  );
}