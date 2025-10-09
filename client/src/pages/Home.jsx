import { useState, useEffect, useRef, useMemo } from "react";
import { HomePageSkeleton } from "../components/SkeletonLoader";
import { useGasSettings } from "../hooks/useGasSettings";
import { useNotification, Notification } from "../components/Notification";

function MetricCard({ title, value = 0, unit, status = "normal", icon, warningThreshold, dangerThreshold }) {
  // กำหนดสถานะตามค่า
  const getStatus = (val, warning, danger) => {
    if (danger && val >= danger) return "danger";
    if (warning && val >= warning) return "warning";
    return "normal";
  };

  const currentStatus = getStatus(value, warningThreshold, dangerThreshold);

  const getCardStyle = (status) => {
    switch (status) {
      case "warning":
        return "bg-yellow-50 border-yellow-300 hover:bg-yellow-100";
      case "danger":
        return "bg-red-50 border-red-300 hover:bg-red-100";
      default:
        return "bg-cyan-50 border-cyan-200 hover:bg-cyan-100";
    }
  };

  const getValueColor = (status) => {
    switch (status) {
      case "warning":
        return "text-yellow-700";
      case "danger":
        return "text-red-700";
      default:
        return "text-cyan-700";
    }
  };

  return (
    <div className={`rounded-lg border p-4 transition-all duration-200 min-w-0 w-full ${getCardStyle(currentStatus)}`}>
      <div className="flex items-center justify-between mb-3 min-w-0">
        <div className="text-gray-600 text-sm font-medium truncate pr-2">{title}</div>
        {icon && (
          <div className="text-gray-500 text-lg flex-shrink-0">
            {icon}
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-2 min-w-0">
        <span className={`text-xl font-bold tabular-nums truncate ${getValueColor(currentStatus)}`}>
          {value && value !== 0 ? Number(value).toFixed(1) : '--'}
        </span>
        {unit && (
          <span className="text-sm text-gray-600 flex-shrink-0">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

export default function Home() {
    const { gasSettings, loading: gasLoading } = useGasSettings();
    const [values, setValues] = useState({});
    const [selectedStack, setSelectedStack] = useState("stack1");
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [loading, setLoading] = useState(false);
    const [lastUpdate, setLastUpdate] = useState(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const websocketRef = useRef(null);
    const lastUpdateTimeRef = useRef(0);
    const UPDATE_THROTTLE_MS = 1000; // อัปเดตทุก 1 วินาที
    
    // ใช้ notification hook
    const { notification, showNotification, hideNotification } = useNotification();

    // Memoize gas cards เพื่อลด re-render
    const gasCards = useMemo(() => {
        return gasSettings.map((gas) => (
            <MetricCard 
                key={gas.id} 
                title={gas.display} 
                value={values[gas.key] || 0} 
                unit={gas.unit} 
                icon="" 
                warningThreshold={gas.alarm * 0.7} 
                dangerThreshold={gas.alarm} 
            />
        ));
    }, [gasSettings, values]);

    // Memoize corrected gas cards
    const correctedGasCards = useMemo(() => {
        return gasSettings.filter(gas => gas.showCorrected && gas.enabled).map((gas) => (
            <MetricCard 
                key={`${gas.id}-corr`} 
                title={gas.display} 
                value={values[`${gas.key}Corr`] || 0} 
                unit={gas.unit} 
                icon="" 
                warningThreshold={gas.alarm * 0.7} 
                dangerThreshold={gas.alarm} 
            />
        ));
    }, [gasSettings, values]);

    // ฟังก์ชันสำหรับเก็บข้อมูลลง localStorage
    const saveValuesToStorage = (data) => {
        try {
            localStorage.setItem('cems_home_values', JSON.stringify(data));
            localStorage.setItem('cems_home_lastUpdate', new Date().toISOString());
        } catch (error) {
            // console.error('Error saving values to localStorage:', error);
        }
    };

    // ฟังก์ชันสำหรับดึงข้อมูลจาก localStorage
    const loadValuesFromStorage = () => {
        try {
            const savedValues = localStorage.getItem('cems_home_values');
            const savedLastUpdate = localStorage.getItem('cems_home_lastUpdate');
            
            if (savedValues) {
                const parsedValues = JSON.parse(savedValues);
                setValues(parsedValues);
                
                if (savedLastUpdate) {
                    setLastUpdate(new Date(savedLastUpdate));
                }
                
                return parsedValues;
            }
        } catch (error) {
            // console.error('Error loading values from localStorage:', error);
        }
        return null;
    };

const API = "http://127.0.0.1:8000";
const WS_URL = "ws://127.0.0.1:8000";

    // ฟังก์ชัน Refresh ข้อมูล
    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            // ส่งคำขอข้อมูลล่าสุดผ่าน WebSocket
            if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
                websocketRef.current.send(JSON.stringify({ type: "get_latest_data" }));
                showNotification("กำลังอัปเดตข้อมูล...", "info");
            } else {
                showNotification("ไม่สามารถเชื่อมต่อ WebSocket ได้", "error");
            }
                } catch (error) {
                    // console.error('Error refreshing data:', error);
                    showNotification("เกิดข้อผิดพลาดในการอัปเดตข้อมูล", "error");
                } finally {
            setIsRefreshing(false);
        }
    };

    // ใช้ WebSocket เท่านั้น - ไม่มี HTTP fallback

    // โหลดข้อมูลจาก localStorage เมื่อ component mount
    useEffect(() => {
        const savedValues = loadValuesFromStorage();
        if (savedValues) {
            // console.log('📂 Loaded values from localStorage');
        }
    }, []);

    // WebSocket connection for real-time data - แก้ไขโครงสร้างให้ถูกต้อง
    useEffect(() => {
        // console.log("🏃 Home useEffect starting...", { WS_URL, selectedStack });
        // console.log("🔧 Environment check:", {
        //     VITE_BACKEND_URL: import.meta.env.VITE_BACKEND_URL,
        //     VITE_WS_URL: import.meta.env.VITE_WS_URL,
        //     WS_URL,
        //     API
        // });
        let ws = null;
        let reconnectTimeout = null;
        let isMounted = true;

        const connect = () => {
            // ป้องกัน multiple connections
            if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
                // console.log("WebSocket already connecting or connected, skipping...");
                return;
            }

            // ป้องกันการเชื่อมต่อเมื่อ component unmount
            if (!isMounted) {
                // console.log("Component unmounted, skipping WebSocket connection");
                return;
            }

            // console.log("🔌 Connecting to WebSocket:", `${WS_URL}/ws/data`);
            ws = new WebSocket(`${WS_URL}/ws/data`);
            websocketRef.current = ws; // เก็บ reference สำหรับใช้ใน handleRefresh
            setIsConnecting(true);

            ws.onopen = () => {
                if (!isMounted) return;
                // console.log("✅ WebSocket connected successfully");
                setIsConnecting(false);
                setIsConnected(true);
                
                // Send initial data request
                try {
                    ws.send(JSON.stringify({ type: "get_latest_data" }));
                    // console.log("📤 Sent initial data request");
                } catch (error) {
                    // console.error("❌ Error sending initial data request:", error);
                }
            };

            ws.onmessage = (event) => {
                if (!isMounted) return;
                
                // Throttle updates เพื่อลดการอัปเดตที่บ่อยเกินไป
                const now = Date.now();
                if (now - lastUpdateTimeRef.current < UPDATE_THROTTLE_MS) {
                    return;
                }
                lastUpdateTimeRef.current = now;
                
                try {
                    const message = JSON.parse(event.data);
                    // console.log("📨 Received WebSocket data:", message.type);
                    
                    if (message.type === "data" && message.data && message.data.length > 0) {
                        const stackData = message.data[0];
                        const data = stackData.data;
                        const correctedData = stackData.corrected_data;
                        
                        // ใช้ useCallback pattern เพื่อลด re-render
                        setValues(prevValues => {
                            // ตรวจสอบว่ามีการเปลี่ยนแปลงจริงหรือไม่
                            let hasChanges = false;
                            const newValues = { ...prevValues };
                            
                            // เพิ่มข้อมูลจาก data (raw values)
                            if (data && typeof data === 'object') {
                                for (const [key, value] of Object.entries(data)) {
                                    const newValue = value || 0;
                                    if (newValues[key] !== newValue) {
                                        newValues[key] = newValue;
                                        hasChanges = true;
                                    }
                                }
                            }
                            
                            // เพิ่มข้อมูลจาก corrected_data
                            if (correctedData && typeof correctedData === 'object') {
                                for (const [key, value] of Object.entries(correctedData)) {
                                    const newValue = value || 0;
                                    const corrKey = `${key}Corr`;
                                    if (newValues[corrKey] !== newValue) {
                                        newValues[corrKey] = newValue;
                                        hasChanges = true;
                                    }
                                }
                            }
                            
                            // อัปเดต state และ localStorage เฉพาะเมื่อมีการเปลี่ยนแปลง
                            if (hasChanges) {
                                // บันทึกข้อมูลลง localStorage เมื่อได้รับข้อมูลใหม่
                                saveValuesToStorage(newValues);
                                return newValues;
                            }
                            
                            // ไม่มีการเปลี่ยนแปลง ให้ return ค่าเดิม
                            return prevValues;
                        });
                        
                        setIsConnected(true);
                        setLastUpdate(new Date());
                    }
                } catch (error) {
                    // console.error("Error parsing WebSocket message:", error);
                }
            };

            ws.onerror = (e) => {
                if (!isMounted) return;
                // console.warn("WebSocket error:", e);
                if (ws) {
                    // console.log("WebSocket error details:", {
                    //     readyState: ws.readyState,
                    //     url: ws.url,
                    //     error: e
                    // });
                }
                setIsConnecting(false);
                setIsConnected(false);
            };

            ws.onclose = (e) => {
                if (!isMounted) return;
                // console.warn("🔌 WebSocket closed", {
                //     code: e.code,
                //     reason: e.reason,
                //     wasClean: e.wasClean
                // });
                ws = null;
                setIsConnecting(false);
                setIsConnected(false);
                
                // Only reconnect if not a clean close and component is still mounted
                if (e.code !== 1000 && isMounted) {
                    // console.log("Scheduling reconnect in 3s...");
                    reconnectTimeout = setTimeout(connect, 3000);
                }
            };
        };

        // console.log("🚀 Starting WebSocket connection...");
        connect();

        return () => {
            // console.log("🧹 Cleaning up WebSocket connection");
            isMounted = false;
            
            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
                reconnectTimeout = null;
            }
            
            if (ws) {
                ws.close(1000, "Component unmounting");
                ws = null;
            }
        };
    }, [selectedStack]);

    // แสดง skeleton loading ถ้ากำลังโหลดและไม่มีข้อมูล
    if (loading && !isConnected) {
        return <HomePageSkeleton />;
    }

    return (
        <div className="min-h-screen bg-white p-4 sm:p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">
                            Stack Value Monitoring Dashboard
                        </h1>
                        {!isConnected && (
                            <p className="text-sm text-orange-600 mt-1">
                                No devices configured. Please go to Config page to set up Modbus devices and mappings.
                            </p>
                        )}
                    </div>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
                        <div className="border border-gray-300 rounded px-3 py-2 text-sm bg-white">
                            Stack 1
                        </div>
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : isConnecting ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
                            <span className="text-sm text-gray-600">
                                {isConnected ? 'Connected' : isConnecting ? 'Connecting...' : 'Disconnected - Showing last known data'}
                            </span>
                        </div>
                        {lastUpdate && (
                            <div className="text-xs text-gray-500">
                                Last update: {lastUpdate.toLocaleTimeString('th-TH', { 
                                    hour12: false,
                                    hour: '2-digit'
                                })}:00
                            </div>
                        )}
                        {/* ปุ่ม Refresh */}
                        <button
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isRefreshing ? "กำลังอัปเดต..." : "Refresh"}
                        </button>
                    </div>
                </div>

                {/* Main Data Grid - Responsive */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 mb-6">
                    {/* Dynamic Cards from Settings */}
                    {gasCards}
                </div>


                {/* Corrected Values Section - แสดงเฉพาะเมื่อ showCorrected = true */}
                {gasSettings.some(gas => gas.showCorrected) && (
                    <div className="mb-4">
                        <h2 className="text-lg font-semibold text-gray-800 mb-4">
                            Corrected to 7% Vol Oxygen
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                            {/* Dynamic Corrected Cards from Settings (เฉพาะที่ showCorrected = true) */}
                            {correctedGasCards}
                        </div>
                    </div>
                )}
            </div>
            
            {/* Notification Component */}
            <Notification 
                show={notification.show}
                message={notification.message}
                type={notification.type}
                onClose={hideNotification}
            />
        </div>
    );
}