import { useState, useEffect, useRef } from "react";
import { HomePageSkeleton } from "../components/SkeletonLoader";
import { useGasSettings } from "../hooks/useGasSettings";

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
    <div className={`rounded-lg border p-4 transition-all duration-200 ${getCardStyle(currentStatus)}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-gray-600 text-sm font-medium">{title}</div>
        {icon && (
          <div className="text-gray-500 text-lg">
            {icon}
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <span className={`text-2xl font-bold tabular-nums ${getValueColor(currentStatus)}`}>
          {Number(value).toFixed(1)}
        </span>
        {unit && (
          <span className="text-sm text-gray-600">
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
    const websocketRef = useRef(null);

const API = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000";
const WS_URL = import.meta.env.VITE_WS_URL || "ws://127.0.0.1:8000";

    // ใช้ WebSocket เท่านั้น - ไม่มี HTTP fallback

    // WebSocket connection for real-time data - แก้ไขโครงสร้างให้ถูกต้อง
    useEffect(() => {
        let ws = null;
        let reconnectTimeout = null;
        let isMounted = true;

        const connect = () => {
            // ป้องกัน multiple connections
            if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
                console.log("WebSocket already connecting or connected, skipping...");
                return;
            }

            // ป้องกันการเชื่อมต่อเมื่อ component unmount
            if (!isMounted) {
                console.log("Component unmounted, skipping WebSocket connection");
                return;
            }

            console.log("🔌 Connecting to WebSocket:", `${WS_URL}/ws/data`);
            ws = new WebSocket(`${WS_URL}/ws/data`);
            setIsConnecting(true);

            ws.onopen = () => {
                if (!isMounted) return;
                console.log("✅ WebSocket connected successfully");
                setIsConnecting(false);
                setIsConnected(true);
                
                // Send initial data request
                try {
                    ws.send(JSON.stringify({ type: "get_latest_data" }));
                    console.log("📤 Sent initial data request");
                } catch (error) {
                    console.error("❌ Error sending initial data request:", error);
                }
            };

            ws.onmessage = (event) => {
                if (!isMounted) return;
                try {
                    const message = JSON.parse(event.data);
                    console.log("📨 Received WebSocket data:", message.type);
                    
                    if (message.type === "data" && message.data && message.data.length > 0) {
                        const stackData = message.data[0];
                        const data = stackData.data;
                        const correctedData = stackData.corrected_data;
                        
                        // สร้าง values แบบ dynamic จาก data
                        const newValues = {};
                        
                        // เพิ่มข้อมูลจาก data (raw values)
                        if (data && typeof data === 'object') {
                            for (const [key, value] of Object.entries(data)) {
                                newValues[key] = value || 0;
                            }
                        }
                        
                        // เพิ่มข้อมูลจาก corrected_data
                        if (correctedData && typeof correctedData === 'object') {
                            for (const [key, value] of Object.entries(correctedData)) {
                                newValues[`${key}Corr`] = value || 0;
                            }
                        }
                        
                        setValues(newValues);
                        setIsConnected(true);
                        setLastUpdate(new Date());
                    }
                } catch (error) {
                    console.error("Error parsing WebSocket message:", error);
                }
            };

            ws.onerror = (e) => {
                if (!isMounted) return;
                console.warn("⚠️ WebSocket error:", e);
                if (ws) {
                    console.log("WebSocket error details:", {
                        readyState: ws.readyState,
                        url: ws.url,
                        error: e
                    });
                }
                setIsConnecting(false);
                setIsConnected(false);
            };

            ws.onclose = (e) => {
                if (!isMounted) return;
                console.warn("🔌 WebSocket closed", {
                    code: e.code,
                    reason: e.reason,
                    wasClean: e.wasClean
                });
                ws = null;
                setIsConnecting(false);
                setIsConnected(false);
                
                // Only reconnect if not a clean close and component is still mounted
                if (e.code !== 1000 && isMounted) {
                    console.log("🔄 Scheduling reconnect in 3s...");
                    reconnectTimeout = setTimeout(connect, 3000);
                }
            };
        };

        connect();

        return () => {
            console.log("🧹 Cleaning up WebSocket connection");
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
        <div className="min-h-screen bg-white p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-semibold text-gray-800">
                            Stack Value Monitoring Dashboard
                        </h1>
                        {!isConnected && (
                            <p className="text-sm text-orange-600 mt-1">
                                ⚠️ No devices configured. Please go to Config page to set up Modbus devices and mappings.
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="border border-gray-300 rounded px-3 py-2 text-sm bg-white">
                            Stack 1
                        </div>
                        {/* ใช้ WebSocket เท่านั้น - ไม่มีปุ่ม Refresh */}
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                            <span className="text-sm text-gray-600">
                                {isConnected ? 'Connected' : 'Disconnected - Please configure devices in Config page'}
                            </span>
                        </div>
                        {lastUpdate && (
                            <div className="text-xs text-gray-500 mt-1">
                                Last update: {lastUpdate.toLocaleTimeString('th-TH', { 
                                    hour12: false,
                                    hour: '2-digit'
                                })}:00
                            </div>
                        )}
                    </div>
                </div>

                {/* Main Data Grid */}
                <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-4 mb-6">
                    {/* Dynamic Cards from Settings */}
                    {gasSettings.map((gas) => (
                        <MetricCard 
                            key={gas.id} 
                            title={gas.display} 
                            value={values[gas.key] || 0} 
                            unit={gas.unit} 
                            icon="☁️" 
                            warningThreshold={gas.alarm * 0.7} 
                            dangerThreshold={gas.alarm} 
                        />
                    ))}
                </div>


                {/* Corrected Values Section - แสดงเฉพาะเมื่อ showCorrected = true */}
                {gasSettings.some(gas => gas.showCorrected) && (
                    <div className="mb-4">
                        <h2 className="text-lg font-semibold text-gray-800 mb-4">
                            Corrected to 7% Vol Oxygen
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {/* Dynamic Corrected Cards from Settings (เฉพาะที่ showCorrected = true) */}
                            {gasSettings.filter(gas => gas.showCorrected && gas.enabled).map((gas) => (
                                <MetricCard 
                                    key={`${gas.id}-corr`} 
                                    title={gas.display} 
                                    value={values[`${gas.key}Corr`] || 0} 
                                    unit={gas.unit} 
                                    icon="☁️" 
                                    warningThreshold={gas.alarm * 0.7} 
                                    dangerThreshold={gas.alarm} 
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}