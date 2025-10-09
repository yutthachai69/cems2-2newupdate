// src/pages/Config.jsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { ConfigPageSkeleton } from "../components/SkeletonLoader";
import { useNotification, Notification, useSwitchAlert, SwitchAlert } from "../components/Notification";
const API = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000";

// ข้อมูลสำหรับ Status/Alarm dropdown
const STATUS_OPTIONS = [
  "Maintenance Mode",
  "Calibration Through Probe", 
  "Manual Blowback Button",
  "Analyzer Calibration",
  "Analyzer Holding Zero",
  "Analyzer Zero Indicator",
  "Sampling SOV",
  "Sampling Pump",
  "Direct Calibration SOV",
  "Blowback SOV",
  "Calibration Through Probe SOV",
  "Calibration Through Probe Light",
  "Blowback Light",
  "Blowback in Operation",
  "Hold Current Value"
];

const ALARM_OPTIONS = [
  "Temperature Controller Alarm",
  "Analyzer Malfunction",
  "Sample Probe Alarm",
  "Alarm Light"
];

/* ---------- UI helpers ---------- */
const DataTable = function DataTable({ cols, rows, rowKey = "id", onDelete, showDelete = true }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-[800px] w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {cols.map(c => (
                <th key={c.key} className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                  {c.title}
                </th>
              ))}
              {showDelete && <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 w-24">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rows.map((r, index) => (
              <tr key={r[rowKey]} className={`hover:bg-gray-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                {cols.map(c => (
                  <td key={c.key} className="px-4 py-3 whitespace-nowrap text-sm text-gray-800">
                    {c.render ? c.render(r) : r[c.dataIndex]}
                  </td>
                ))}
                {showDelete && (
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center gap-1">
                      <button
                        className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete?.(r);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={cols.length + (showDelete ? 1 : 0)} className="px-4 py-8 text-center text-gray-500">
                  No data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const Section = ({ title, right, children, icon }) => (
  <div className="space-y-4">
    <div className="flex items-center justify-between border-b border-gray-200 pb-3">
      <div className="flex items-center gap-3">
        {icon && <div className="text-xl">{icon}</div>}
        <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
      </div>
      {right}
    </div>
    <div className="space-y-4">
    {children}
    </div>
  </div>
);

const Field = ({ label, children, required }) => (
  <div className="space-y-2">
  <label className="flex items-center gap-2">
      <span className="text-sm font-medium text-gray-700 min-w-[120px]">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </span>
    {children}
  </label>
  </div>
);

const Text = (p) => (
  <input
    {...p}
    type={p.type || "text"}
    className={
      "rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 " +
      (p.className || "w-56")
    }
    // ลบ key ออกเพราะไม่จำเป็น และ Math.random() ทำให้ cursor หาย
  />
);

const NumberField = (p) => <Text {...p} type="number" step="any" />;

const Switch = ({ checked, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className={`relative h-6 w-11 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
      checked 
        ? "bg-blue-500" 
        : "bg-gray-300 hover:bg-gray-400"
    }`}
  >
    <span
      className={`absolute top-0.5 left-0.5 h-5 w-5 bg-white rounded-full shadow transition-all duration-300 ${
        checked ? "translate-x-5" : "translate-x-0"
      }`}
    />
  </button>
);

/* ---------- Page: Config ---------- */
export default function Config() {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('devices');
  const [message, setMessage] = useState('');
  const [selectedDevice, setSelectedDevice] = useState(() => {
    try {
      const saved = localStorage.getItem('cems_selected_device');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [filteredMappings, setFilteredMappings] = useState([]);
  const [filteredStatusAlarmMappings, setFilteredStatusAlarmMappings] = useState([]);
  const [editingDevice, setEditingDevice] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', host: '', port: 502, unit: 1 });
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const gasIdInitialized = useRef(false);
  
  // ใช้ notification และ switch alert hooks
  const { notification, showNotification, hideNotification } = useNotification();
  const { switchAlert, showSwitchAlert, hideSwitchAlert } = useSwitchAlert();

  /* 1) Devices */
  const [devices, setDevices] = useState([
    // { id: 1, name: "GasAnalyzer-1", mode: "TCP", host: "192.168.1.10", port: 502, unit: 1 }
  ]);

  /* 2) Mapping */
  const [mapping, setMapping] = useState([
    // { id: 1, name: "SO2", unit: "ppm", address: 0, dataType: "float32", format: "AB CD", count: 2, device: "GasAnalyzer-1" }
  ]);

  /* 3) Gases / ranges / alarms */
  const [gases, setGases] = useState([
    // { key:"SO2", display:"SO₂", unit:"ppm", enabled:true, min:0, max:200, alarm:150 }
  ]);


  /* 5) Status/Alarm Mapping */
  const [statusAlarmMapping, setStatusAlarmMapping] = useState([
    // { id: 1, name: "Pump Status", type: "status", address: 0, device: "PLC-1", enabled: true }
  ]);

  /* Load config on mount */
  useEffect(() => {
    console.log("DEBUG: Config useEffect triggered");
    try {
      reloadConfig();
    } catch (err) {
      console.error("Error in useEffect:", err);
    }
  }, []);

  /* Debug state changes */
  useEffect(() => {
    console.log("DEBUG: devices state changed:", devices);
  }, [devices]);

  useEffect(() => {
    console.log("DEBUG: mapping state changed:", mapping);
  }, [mapping]);

  useEffect(() => {
    console.log("DEBUG: loading state changed:", loading);
  }, [loading]);


  /* Save selectedDevice to localStorage when it changes */
  useEffect(() => {
    if (selectedDevice) {
      localStorage.setItem('cems_selected_device', JSON.stringify(selectedDevice));
    } else {
      localStorage.removeItem('cems_selected_device');
    }
  }, [selectedDevice]);

  /* เพิ่ม id ให้ Gas ที่ไม่มี id */
  useEffect(() => {
    if (!gasIdInitialized.current && gases.length > 0) {
    setGases(g => g.map((x, i) => x.id ? x : ({ ...x, id: Date.now() + i })));
      gasIdInitialized.current = true;
    }
  }, [gases]);

  /* กรอง Mappings ตาม Device ที่เลือก */
  useEffect(() => {
    if (selectedDevice) {
      const filtered = mapping.filter(m => m.device === selectedDevice.name);
      setFilteredMappings(filtered);
    } else {
      setFilteredMappings(mapping);
    }
  }, [selectedDevice, mapping]);

  /* กรอง Status/Alarm Mappings ตาม Device ที่เลือก */
  useEffect(() => {
    if (selectedDevice) {
      const filtered = statusAlarmMapping.filter(m => m.device === selectedDevice.name);
      setFilteredStatusAlarmMappings(filtered);
    } else {
      setFilteredStatusAlarmMappings(statusAlarmMapping);
    }
  }, [selectedDevice, statusAlarmMapping]);

  /* Auto-calculate stack area when shape/dimensions change */
  // useEffect(() => {
  //   calculateStackArea();
  // }, [
  //   systemParams.stackShape,
  //   systemParams.stackCircumference || 0, // ใช้ตอนคำนวณวงกลมจากเส้นรอบวง
  //   systemParams.stackWidth || 0,         // ใช้ตอนสี่เหลี่ยม
  //   systemParams.stackLength || 0         // ใช้ตอนสี่เหลี่ยม
  //   // ❌ ไม่ใส่ stackArea/stackDiameter เพราะเป็นค่าที่คำนวณ "ปลายทาง"
  // ]);

  /* Helper functions */
  const addRow = useCallback((arr, setArr, template) => {
    setArr(prevArr => {
      const id = Math.max(0, ...prevArr.map((r) => r.id || 0)) + 1;
      return [...prevArr, { ...template, id }];
    });
  }, []);

  const delRow = useCallback((arr, setArr, id) => {
    setArr(prevArr => prevArr.filter((r) => r.id !== id));
  }, []);

  const up = useCallback((arr, setArr) => (id, key, val) => {
    setArr(prevArr => prevArr.map((r) => (r.id === id ? { ...r, [key]: val } : r)));
  }, []);

  const cDel = useCallback((idOrKey) => {
    if (devices.some((d) => d.id === idOrKey)) return delRow(devices, setDevices, idOrKey);
    if (mapping.some((m) => m.id === idOrKey)) return delRow(mapping, setMapping, idOrKey);
    if (gases.some((g) => g.id === idOrKey)) return setGases(prev => prev.filter(x => x.id !== idOrKey));
  }, [devices, mapping, gases, delRow]);

  /* Handler functions สำหรับ DataTable */

  const handleDelete = (row) => {
    console.log('handleDelete called:', { activeTab, row });
    console.log('Row data fields:', { 
      id: row.id, 
      display: row.display, 
      key: row.key, 
      name: row.name,
      unit: row.unit 
    });
    
    if (activeTab === 'devices') {
      // นับจำนวน mappings ที่เกี่ยวข้อง
      const relatedMappings = mapping.filter(m => m.device === row.name);
      const mappingCount = relatedMappings.length;
      
      setDeleteConfirm({
        type: 'device',
        item: row,
        message: `ต้องการลบ device "${row.name}" หรือไม่?${mappingCount > 0 ? `\n\nจะลบ mappings ที่เกี่ยวข้องด้วย (${mappingCount} รายการ)` : ''}`
      });
    } else if (activeTab === 'mapping') {
      // ใช้ field ที่ถูกต้องสำหรับ mapping
      const mappingLabel = row.name || row.display || row.key || `${row.device || ''} → ${row.address || ''}`.trim();
      
      setDeleteConfirm({
        type: 'mapping',
        item: row,
        message: `คุณแน่ใจไหมว่าจะลบ mapping "${mappingLabel}" นี้`
      });
    } else if (activeTab === 'gas') {
      // ใช้ Switch Alert สำหรับการลบแก๊ส
      handleDeleteGas(row);
    } else if (activeTab === 'status') {
      const statusLabel = row.name || row.key || row.display || '';
      setDeleteConfirm({
        type: 'status_alarm',
        item: row,
        message: `ต้องการลบ Status/Alarm mapping "${statusLabel}" หรือไม่?`
      });
    }
  };

  const handleEditDevice = (device) => {
    setEditingDevice(device);
    setEditForm({
      name: device.name,
      host: device.host,
      port: device.port,
      unit: device.unit
    });
  };

  const handleSaveEdit = () => {
    if (!editForm.name || !editForm.host) {
      setMessage('กรุณากรอกชื่อและ IP Address');
      return;
    }
    
    const oldDeviceName = editingDevice.name;
    const newDeviceName = editForm.name;
    
    setDevices(prev => prev.map(d => 
      d.id === editingDevice.id 
        ? { ...d, ...editForm }
        : d
    ));
    
    // อัพเดท mappings ที่เกี่ยวข้องกับ device นี้ (ถ้าชื่อเปลี่ยน)
    if (oldDeviceName !== newDeviceName) {
      setMapping(prev => prev.map(m => 
        m.device === oldDeviceName 
          ? { ...m, device: newDeviceName }
          : m
      ));
      setMessage(`แก้ไข device และอัพเดท mappings ที่เกี่ยวข้องแล้ว`);
    } else {
      setMessage('แก้ไข Device สำเร็จ');
    }
    
    // ถ้า device ที่แก้ไขเป็น selectedDevice ให้อัพเดทด้วย
    if (selectedDevice?.name === editingDevice.name) {
      const updatedSelectedDevice = { ...selectedDevice, ...editForm };
      setSelectedDevice(updatedSelectedDevice);
      // อัพเดท localStorage ด้วย
      localStorage.setItem('cems_selected_device', JSON.stringify(updatedSelectedDevice));
    }
    
    setEditingDevice(null);
  };

  const handleCancelEdit = () => {
    setEditingDevice(null);
    setEditForm({ name: '', host: '', port: 502, unit: 1 });
  };

  const handleDeleteGas = async (gas) => {
    console.log('handleDeleteGas called with gas:', gas);
    
    // ตรวจสอบและใช้ชื่อแก๊สที่ถูกต้อง
    const gasLabel = (gas.display && gas.display.trim()) || 
                     (gas.key && gas.key.trim()) || 
                     (gas.name && gas.name.trim()) || 
                     'ไม่ระบุชื่อ';
    
    console.log('gasLabel determined as:', gasLabel);
    
    // ใช้ Switch Alert สำหรับการลบแก๊ส
    const confirmed = await showSwitchAlert({
      title: "ยืนยันการลบการตั้งค่าแก๊ส",
      message: `คุณแน่ใจหรือไม่ที่จะลบการตั้งค่าแก๊ส "${gasLabel}"?`,
      type: "warning",
      buttons: ["ยกเลิก", "ลบ"]
    });

    if (!confirmed) return; // ถ้าไม่ยืนยัน ให้หยุด

    // ดำเนินการลบ
    const gasToDelete = gas;
    
    // ลบแก๊สจาก state
    setGases(prev => prev.filter(g => g.id !== gasToDelete.id));
    
    // บันทึกลงไฟล์ทันที
    try {
      const updatedGases = gases.filter(g => g.id !== gasToDelete.id);
      const response = await fetch(`${API}/api/config/gas`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedGases)
      });
      
      if (response.ok) {
        showNotification(`ลบการตั้งค่าแก๊ส "${gasLabel}" สำเร็จ`, "success");
      } else {
        showNotification(`ลบการตั้งค่าแก๊ส "${gasLabel}" แล้ว แต่เกิดข้อผิดพลาดในการบันทึก`, "warning");
      }
    } catch (error) {
      console.error('Error saving after delete:', error);
      showNotification(`ลบการตั้งค่าแก๊ส "${gasLabel}" แล้ว แต่เกิดข้อผิดพลาดในการบันทึก`, "error");
    }
  };

  const handleDeleteDevice = async (device) => {
    // นับจำนวน mappings ทั้งสองประเภทที่เกี่ยวข้อง
    const relatedGasMappings = mapping.filter(m => m.device === device.name);
    const relatedStatusMappings = statusAlarmMapping.filter(s => s.device === device.name);
    const gasMappingCount = relatedGasMappings.length;
    const statusMappingCount = relatedStatusMappings.length;
    const totalMappingCount = gasMappingCount + statusMappingCount;
    
    // สร้างข้อความแจ้งเตือนที่ครบถ้วน
    let mappingMessage = '';
    if (totalMappingCount > 0) {
      mappingMessage = '\n\nจะลบ mappings ที่เกี่ยวข้องด้วย:';
      if (gasMappingCount > 0) {
        mappingMessage += `\n• Gas mappings (${gasMappingCount} รายการ)`;
      }
      if (statusMappingCount > 0) {
        mappingMessage += `\n• Status/Alarm mappings (${statusMappingCount} รายการ)`;
      }
      mappingMessage += `\n• รวมทั้งหมด (${totalMappingCount} รายการ)`;
    }
    
    // ใช้ Switch Alert แทน deleteConfirm
    const confirmed = await showSwitchAlert({
      title: "ยืนยันการลบอุปกรณ์",
      message: `คุณแน่ใจหรือไม่ที่จะลบอุปกรณ์ "${device.name}"?${mappingMessage}`,
      type: "warning",
      buttons: ["ยกเลิก", "ลบ"]
    });

    if (!confirmed) return; // ถ้าไม่ยืนยัน ให้หยุด

    // ดำเนินการลบ
    const deviceToDelete = device;
    
    // ลบ device จาก state
    setDevices(prev => prev.filter(d => d.id !== deviceToDelete.id));
    
    // ลบ Gas mappings ที่เกี่ยวข้องกับ device นี้ด้วย
    setMapping(prev => prev.filter(m => m.device !== deviceToDelete.name));
    
    // ลบ Status/Alarm mappings ที่เกี่ยวข้องกับ device นี้ด้วย
    setStatusAlarmMapping(prev => prev.filter(s => s.device !== deviceToDelete.name));
    
    // ถ้า device ที่ถูกลบเป็น selectedDevice ให้ยกเลิกการเลือก
    if (selectedDevice?.name === deviceToDelete.name) {
      setSelectedDevice(null);
      localStorage.removeItem('cems_selected_device');
    }
    
    // บันทึกลงไฟล์ทันที
    try {
      const updatedDevices = devices.filter(d => d.id !== deviceToDelete.id);
      const updatedGasMappings = mapping.filter(m => m.device !== deviceToDelete.name);
      const updatedStatusMappings = statusAlarmMapping.filter(s => s.device !== deviceToDelete.name);
      
      // บันทึก devices
      const devicesResponse = await fetch(`${API}/api/config/devices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedDevices)
      });
      
      // บันทึก Gas mappings
      const gasMappingsResponse = await fetch(`${API}/api/config/mappings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedGasMappings)
      });
      
      // บันทึก Status/Alarm mappings
      const statusMappingsResponse = await fetch(`${API}/api/config/status-alarm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedStatusMappings)
      });
      
      if (devicesResponse.ok && gasMappingsResponse.ok && statusMappingsResponse.ok) {
        showNotification(`ลบอุปกรณ์ "${deviceToDelete.name}" และ mappings ทั้งหมดสำเร็จ`, "success");
      } else {
        showNotification(`ลบอุปกรณ์ "${deviceToDelete.name}" แล้ว แต่เกิดข้อผิดพลาดในการบันทึกบางส่วน`, "warning");
      }
    } catch (error) {
      console.error('Error saving after delete:', error);
      showNotification(`ลบอุปกรณ์ "${deviceToDelete.name}" แล้ว แต่เกิดข้อผิดพลาดในการบันทึก`, "error");
    }
  };

  const confirmDelete = async () => {
    if (deleteConfirm?.type === 'device') {
      const device = deleteConfirm.item;
      
      // ลบ device จาก state
      setDevices(prev => prev.filter(d => d.id !== device.id));
      
      // ลบ mappings ที่เกี่ยวข้องกับ device นี้ด้วย
      setMapping(prev => prev.filter(m => m.device !== device.name));
      
      // ถ้า device ที่ถูกลบเป็น selectedDevice ให้ยกเลิกการเลือก
      if (selectedDevice?.name === device.name) {
        setSelectedDevice(null);
        localStorage.removeItem('cems_selected_device');
      }
      
      // บันทึกลงไฟล์ทันที
      try {
        const updatedDevices = devices.filter(d => d.id !== device.id);
        const updatedMappings = mapping.filter(m => m.device !== device.name);
        
        // บันทึก devices
        const devicesResponse = await fetch(`${API}/api/config/devices`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedDevices)
        });
        
        // บันทึก mappings
        const mappingsResponse = await fetch(`${API}/api/config/mappings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedMappings)
        });
        
        if (devicesResponse.ok && mappingsResponse.ok) {
          setMessage(`ลบ device "${device.name}" และบันทึกแล้ว`);
        } else {
          setMessage(`ลบ device "${device.name}" แล้ว แต่เกิดข้อผิดพลาดในการบันทึก`);
        }
      } catch (error) {
        console.error('Error saving after delete:', error);
        setMessage(`ลบ device "${device.name}" แล้ว แต่เกิดข้อผิดพลาดในการบันทึก`);
      }
      
    } else if (deleteConfirm?.type === 'mapping') {
      const mappingToDelete = deleteConfirm.item;
      setMapping(prev => prev.filter(m => m.id !== mappingToDelete.id));
      
      // บันทึกลงไฟล์ทันที
      try {
        const updatedMappings = mapping.filter(m => m.id !== mappingToDelete.id);
        const response = await fetch(`${API}/api/config/mappings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedMappings)
        });
        
        if (response.ok) {
          setMessage(`ลบ mapping "${mappingToDelete.name}" และบันทึกแล้ว`);
        } else {
          setMessage(`ลบ mapping "${mappingToDelete.name}" แล้ว แต่เกิดข้อผิดพลาดในการบันทึก`);
        }
      } catch (error) {
        console.error('Error saving after delete:', error);
        setMessage(`ลบ mapping "${mappingToDelete.name}" แล้ว แต่เกิดข้อผิดพลาดในการบันทึก`);
      }
      
    } else if (deleteConfirm?.type === 'status_alarm') {
      const statusAlarm = deleteConfirm.item;
      setStatusAlarmMapping(prev => prev.filter(s => s.id !== statusAlarm.id));
      
      // บันทึกลงไฟล์ทันที
      try {
        const updatedStatusAlarmMappings = statusAlarmMapping.filter(s => s.id !== statusAlarm.id);
        const response = await fetch(`${API}/api/config/status-alarm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedStatusAlarmMappings)
        });
        
        if (response.ok) {
          setMessage(`ลบ Status/Alarm mapping "${statusAlarm.name}" และบันทึกแล้ว`);
        } else {
          setMessage(`ลบ Status/Alarm mapping "${statusAlarm.name}" แล้ว แต่เกิดข้อผิดพลาดในการบันทึก`);
        }
      } catch (error) {
        console.error('Error saving after delete:', error);
        setMessage(`ลบ Status/Alarm mapping "${statusAlarm.name}" แล้ว แต่เกิดข้อผิดพลาดในการบันทึก`);
      }
    }
    setDeleteConfirm(null);
  };

  const cancelDelete = () => {
    setDeleteConfirm(null);
  };



  /* API functions */
  const reloadConfig = async () => {
    setLoading(true);
    try {
      // ใช้ Promise.allSettled แทน Promise.all เพื่อไม่ให้ล้มเหลวทั้งหมดถ้า API บางตัวล้มเหลว
      // เพิ่ม timeout สำหรับแต่ละ fetch
      const fetchWithTimeout = (url, timeout = 15000) => {
        console.log(`DEBUG: Fetching ${url} with timeout ${timeout}ms`);
        const fetchPromise = fetch(url);
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), timeout);
        });
        return Promise.race([fetchPromise, timeoutPromise]);
      };

      const [devicesRes, mappingRes, gasRes, statusAlarmRes] = await Promise.allSettled([
        fetchWithTimeout(`${API}/api/config/devices`).then(r => r.json()),
        fetchWithTimeout(`${API}/api/config/mappings`).then(r => r.json()),
        fetchWithTimeout(`${API}/api/config/gas`).then(r => r.json()),
        fetchWithTimeout(`${API}/api/config/status-alarm`).then(r => r.json())
      ]);

      // ตรวจสอบแต่ละ response แยกกัน
      console.log("DEBUG Config reload - devicesRes:", devicesRes);
      console.log("DEBUG Config reload - mappingRes:", mappingRes);
      
      if (devicesRes.status === 'fulfilled' && devicesRes.value?.devices) {
        console.log("DEBUG: Setting devices:", devicesRes.value.devices);
        setDevices(devicesRes.value.devices);
      } else {
        console.warn("Failed to load devices:", devicesRes.reason);
        // Fallback: ใช้ข้อมูลจาก localStorage หรือข้อมูลเริ่มต้น
        const fallbackDevices = [
          { name: "test1", mode: "TCP", host: "127.0.0.1", port: 502, unit: 1, id: 1 },
          { name: "test2", mode: "TCP", host: "127.0.0.1", port: 503, unit: 1, id: 2 }
        ];
        setDevices(fallbackDevices);
      }

      if (mappingRes.status === 'fulfilled' && mappingRes.value?.mappings) {
        console.log("DEBUG: Setting mappings:", mappingRes.value.mappings);
        setMapping(mappingRes.value.mappings);
      } else {
        console.warn("Failed to load mappings:", mappingRes.reason);
        // Fallback: ใช้ข้อมูลจาก localStorage หรือข้อมูลเริ่มต้น
        const fallbackMappings = [
          { id: 1, name: "SO2", unit: "ppm", address: 0, dataType: "float32", format: "AB CD", count: 2, device: "test1" },
          { id: 2, name: "NOx", unit: "ppm", address: 2, dataType: "float32", format: "AB CD", count: 2, device: "test1" },
          { id: 3, name: "O2", unit: "%", address: 4, dataType: "float32", format: "AB CD", count: 2, device: "test1" },
          { id: 4, name: "CO", unit: "ppm", address: 6, dataType: "float32", format: "AB CD", count: 2, device: "test1" }
        ];
        setMapping(fallbackMappings);
      }

      if (gasRes.status === 'fulfilled' && gasRes.value?.gas_settings) {
        setGases(gasRes.value.gas_settings);
      } else {
        console.warn("Failed to load gas settings:", gasRes.reason);
      }

      if (statusAlarmRes.status === 'fulfilled' && statusAlarmRes.value?.status_alarm_mapping) {
        setStatusAlarmMapping(statusAlarmRes.value.status_alarm_mapping);
        console.log("Loaded status/alarm mapping:", statusAlarmRes.value.status_alarm_mapping);
      } else {
        console.warn("Failed to load status/alarm mapping:", statusAlarmRes.reason);
      }

    } catch (error) {
      console.error("Failed to reload config:", error);
      setMessage("Failed to reload config: " + error.message);
      } finally {
        setLoading(false);
      }
  };

  const saveDevices = async () => {
    setLoading(true);
    try {
      await fetch(`${API}/api/config/devices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(devices)
      });
      
      // โหลดการตั้งค่าใหม่ในระบบ
      await fetch(`${API}/api/config/reload`, {
        method: "POST"
      });
      
      setMessage('Devices saved and configuration reloaded successfully');
    } catch (error) {
      console.error("Failed to save devices:", error);
      setMessage('Failed to save devices');
    } finally {
      setLoading(false);
    }
  };

  const saveMapping = async () => {
    setLoading(true);
    try {
      await fetch(`${API}/api/config/mappings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mapping)
      });
      
      // โหลดการตั้งค่าใหม่ในระบบ
      await fetch(`${API}/api/config/reload`, {
        method: "POST"
      });
      
      setMessage('Mappings saved and configuration reloaded successfully');
    } catch (error) {
      console.error("Failed to save mapping:", error);
      setMessage('Failed to save mappings');
    } finally {
      setLoading(false);
    }
  };



  const saveGasSettings = async () => {
    setLoading(true);
    try {
      console.log('Saving gas settings:', gases);
      const response = await fetch(`${API}/api/config/gas`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(gases)
      });
      
      if (response.ok) {
        setMessage('Gas settings saved successfully');
      } else {
        const errorData = await response.json();
        setMessage(`Failed to save gas settings: ${errorData.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error("Failed to save gas settings:", error);
      setMessage('Failed to save gas settings');
    } finally {
      setLoading(false);
    }
  };


  const saveStatusAlarmMapping = async () => {
    setLoading(true);
    try {
      console.log('Saving status/alarm mapping:', statusAlarmMapping);
      
      const response = await fetch(`${API}/api/config/status-alarm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(statusAlarmMapping),
      });

      if (response.ok) {
        const result = await response.json();
        setMessage(`Status/Alarm mapping saved successfully! (${result.count} entries)`);
        console.log('Status/Alarm mapping saved:', result);
      } else {
        const error = await response.json();
        setMessage(`Failed to save Status/Alarm mapping: ${error.detail}`);
        console.error('Failed to save status/alarm mapping:', error);
      }
    } catch (error) {
      console.error('Failed to save status/alarm mapping:', error);
      setMessage(`Failed to save Status/Alarm mapping: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };



  /* Reusable Table - ลบ useMemo เพื่อป้องกัน cursor เด้ง */
  const Table = ({ cols, rows, rowKey = "id" }) => (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-[800px] w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
            {cols.map((c) => (
                <th key={c.key} className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                {c.title}
              </th>
            ))}
              <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 w-24">
                Actions
              </th>
          </tr>
        </thead>
          <tbody className="divide-y divide-gray-200">
            {rows.map((r, index) => (
              <tr 
                key={r[rowKey]} 
                className={`hover:bg-gray-50 transition-colors ${
                  index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                }`}
              >
              {cols.map((c) => (
                  <td key={c.key} className="px-4 py-3 whitespace-nowrap text-sm text-gray-800">
                  {c.render ? c.render(r) : r[c.dataIndex]}
                </td>
              ))}
                <td className="px-4 py-3 text-center">
                  <div className="flex justify-center gap-1">
                    <button 
                      className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded transition-colors" 
                      onClick={() => cDel(r[rowKey])}
                    >
                  Delete
                </button>
                  </div>
              </td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
                <td colSpan={cols.length + 1} className="px-4 py-8 text-center">
                                      <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="text-gray-500 font-medium">No data available</div>
                      <div className="text-gray-400 text-sm">Click "Add" to create new entries</div>
                    </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
    </div>
  );

  /* Devices columns */
  const cDev = useMemo(() => ({
    cols: [
      { key: "name", title: "ชื่ออุปกรณ์", dataIndex: "name", render: (r) => <Text value={r.name || ""} onChange={(e) => up(devices, setDevices)(r.id, "name", e.target.value)} /> },
      { key: "mode", title: "โหมด", dataIndex: "mode", render: (r) => <select className="rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200" value={r.mode || "TCP"} onChange={(e) => up(devices, setDevices)(r.id, "mode", e.target.value)}><option value="TCP">TCP</option><option value="RTU">RTU</option></select> },
      { key: "host", title: "IP/Port", dataIndex: "host", render: (r) => <div className="flex gap-1"><Text value={r.host || ""} onChange={(e) => up(devices, setDevices)(r.id, "host", e.target.value)} className="w-32" /><Text value={r.port || 502} onChange={(e) => up(devices, setDevices)(r.id, "port", Number(e.target.value) || 502)} className="w-20" /></div> },
      { key: "unit", title: "Slave ID", dataIndex: "unit", render: (r) => <NumberField value={r.unit ?? 1} onChange={(e) => up(devices, setDevices)(r.id, "unit", Number(e.target.value) || 1)} className="w-20" /> }
    ],
    add: () => addRow(devices, setDevices, { name: "", mode: "TCP", host: "", port: 502, unit: 1 })
  }), [devices, up, addRow]);

  /* Mapping columns */
  const cMap = useMemo(() => ({
    cols: [
      { key: "name", title: "ชื่อสัญญาณ", dataIndex: "name", render: (r) => {
        // กำหนดหน่วยเริ่มต้นตามชื่อสัญญาณ
        const getDefaultUnit = (signalName) => {
          switch(signalName) {
            case "SO2": return "ppm";
            case "NOx": return "ppm";
            case "CO": return "ppm";
            case "O2": return "%";
            case "Dust": return "mg/m³";
            case "Temperature": return "°C";
            case "Velocity": return "m/s";
            case "Flowrate": return "m³/h";
            case "Pressure": return "Pa";
            default: return "";
          }
        };
        
        return (
          <select 
            className="rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200" 
            value={r.name || ""} 
            onChange={(e) => {
              const newName = e.target.value;
              const defaultUnit = getDefaultUnit(newName);
              up(mapping, setMapping)(r.id, "name", newName);
              up(mapping, setMapping)(r.id, "unit", defaultUnit);
            }}
          >
            <option value="">เลือกสัญญาณ</option>
            <option value="SO2">SO2</option>
            <option value="NOx">NOx</option>
            <option value="O2">O2</option>
            <option value="CO">CO</option>
            <option value="Dust">Dust</option>
            <option value="Temperature">Temperature</option>
            <option value="Velocity">Velocity</option>
            <option value="Flowrate">Flowrate</option>
            <option value="Pressure">Pressure</option>
          </select>
        );
      } },
      { key: "unit", title: "หน่วย", dataIndex: "unit", render: (r) => {
        // กำหนดหน่วยเริ่มต้นตามชื่อสัญญาณ
        const getDefaultUnit = (signalName) => {
          switch(signalName) {
            case "SO2": return "ppm";
            case "NOx": return "ppm";
            case "CO": return "ppm";
            case "O2": return "%";
            case "Dust": return "mg/m³";
            case "Temperature": return "°C";
            case "Velocity": return "m/s";
            case "Flowrate": return "m³/h";
            case "Pressure": return "Pa";
            default: return "";
          }
        };
        
        return (
          <select 
            className="rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 w-20" 
            value={r.unit || getDefaultUnit(r.name)} 
            onChange={(e) => up(mapping, setMapping)(r.id, "unit", e.target.value)}
          >
            <option value="">เลือกหน่วย</option>
            <option value="ppm">ppm</option>
            <option value="%">%</option>
            <option value="°C">°C</option>
            <option value="°F">°F</option>
            <option value="mg/m³">mg/m³</option>
            <option value="m/s">m/s</option>
            <option value="m³/h">m³/h</option>
            <option value="Pa">Pa</option>
            <option value="kPa">kPa</option>
            <option value="bar">bar</option>
            <option value="atm">atm</option>
          </select>
        );
      } },
      { key: "address", title: "Address", dataIndex: "address", render: (r) => <NumberField value={r.address ?? 0} onChange={(e) => up(mapping, setMapping)(r.id, "address", Number(e.target.value) || 0)} className="w-20" /> },
      { key: "dataType", title: "Data Type", dataIndex: "dataType", render: (r) => {
        // กำหนด Count เริ่มต้นตาม Data Type
        const getDefaultCount = (dataType) => {
          switch(dataType) {
            case "int16": return 1;
            case "uint16": return 1;
            case "int32": return 2;
            case "uint32": return 2;
            case "float32": return 2;
            case "float64": return 4;
            default: return 1;
          }
        };
        
        return (
          <select 
            className="rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200" 
            value={r.dataType || "float32"} 
            onChange={(e) => {
              const newDataType = e.target.value;
              const defaultCount = getDefaultCount(newDataType);
              up(mapping, setMapping)(r.id, "dataType", newDataType);
              up(mapping, setMapping)(r.id, "count", defaultCount);
            }}
          >
            <option value="float32">float32</option>
            <option value="int16">int16</option>
            <option value="uint16">uint16</option>
            <option value="uint32">uint32</option>
            <option value="int32">int32</option>
            <option value="float64">float64</option>
          </select>
        );
      } },
      { key: "format", title: "Format", dataIndex: "format", render: (r) => (
        <select 
          className="rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 w-24" 
          value={r.format || "AB CD"} 
          onChange={(e) => up(mapping, setMapping)(r.id, "format", e.target.value)}
        >
          <option value="AB CD">AB CD</option>
          <option value="CD AB">CD AB</option>
          <option value="ABCD">ABCD</option>
          <option value="DCBA">DCBA</option>
        </select>
      ) },
      { key: "count", title: "Count", dataIndex: "count", render: (r) => {
        // กำหนด Count เริ่มต้นตาม Data Type
        const getDefaultCount = (dataType) => {
          switch(dataType) {
            case "int16": return 1;
            case "uint16": return 1;
            case "int32": return 2;
            case "uint32": return 2;
            case "float32": return 2;
            case "float64": return 4;
            default: return 1;
          }
        };
        
        return (
          <NumberField 
            value={r.count ?? getDefaultCount(r.dataType)} 
            onChange={(e) => up(mapping, setMapping)(r.id, "count", Number(e.target.value) || getDefaultCount(r.dataType))} 
            className="w-16" 
          />
        );
      } },
      { key: "device", title: "Device", dataIndex: "device", render: (r) => (
        <select 
          className="rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200" 
          value={r.device || ""} 
          onChange={(e) => up(mapping, setMapping)(r.id, "device", e.target.value)}
        >
          <option value="">เลือก Device</option>
          {devices.map(device => (
            <option key={device.id} value={device.name}>{device.name}</option>
          ))}
        </select>
      )}
    ],
    add: () => {
      if (!selectedDevice) {
        setMessage('กรุณาเลือก Device ก่อนเพิ่ม Mapping');
        return;
      }
      addRow(mapping, setMapping, { 
        name: "", 
        unit: "ppm", 
        address: 0, 
        dataType: "float32", 
        format: "AB CD", 
        count: 1, 
        device: selectedDevice.name 
      });
    }
  }), [mapping, up, addRow, selectedDevice, devices]);

  /* Gas columns */
  const cGas = useMemo(() => ({
    cols: [
      { key: "enabled", title: "Enable", dataIndex: "enabled", render: (r) => <Switch checked={!!r.enabled} onChange={(v) => setGases(gases.map(g => g.id === r.id ? { ...g, enabled: v } : g))} /> },
      { key: "showCorrected", title: "Show Corrected", dataIndex: "showCorrected", render: (r) => <Switch checked={!!r.showCorrected} onChange={(v) => setGases(gases.map(g => g.id === r.id ? { ...g, showCorrected: v } : g))} /> },
      { key: "display", title: "ชื่อแก๊ส", dataIndex: "display", render: (r) => (
        <select 
          className="rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200" 
          value={r.display || ""} 
          onChange={(e) => {
            const newDisplay = e.target.value;
            setGases(gases.map(g => g.id === r.id ? { 
              ...g, 
              display: newDisplay,
              key: newDisplay // อัปเดต key ให้ตรงกับ display
            } : g));
          }}
        >
          <option value="">เลือกแก๊ส</option>
          <option value="SO2">SO2</option>
          <option value="NOx">NOx</option>
          <option value="O2">O2</option>
          <option value="CO">CO</option>
          <option value="Dust">Dust</option>
          <option value="Temperature">Temperature</option>
          <option value="Velocity">Velocity</option>
          <option value="Flowrate">Flowrate</option>
          <option value="Pressure">Pressure</option>
          {/* Emission Gases */}
          <option value="CO2">CO₂</option>
          <option value="CH4">CH₄</option>
          <option value="HCl">HCl</option>
          <option value="HF">HF</option>
          <option value="NH3">NH₃</option>
          <option value="H2S">H₂S</option>
          <option value="THC">THC / VOC</option>
          <option value="N2O">N₂O</option>
          <option value="H2">H₂</option>
          <option value="Cl2">Cl₂</option>
          <option value="SO3">SO₃</option>
          <option value="O3">O₃</option>
          {/* Physical Parameters */}
          <option value="H2O">H₂O (Moisture)</option>
          <option value="Humidity">Humidity / Moisture</option>
          <option value="AmbientTemp">Ambient Temp</option>
          <option value="AmbientPressure">Ambient Pressure</option>
        </select>
      ) },
      { key: "unit", title: "Unit", dataIndex: "unit", render: (r) => (
        <select 
          className="rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 w-24" 
          value={r.unit || ""} 
          onChange={(e) => setGases(gases.map(g => g.id === r.id ? { ...g, unit: e.target.value } : g))}
        >
          <option value="">เลือกหน่วย</option>
          <option value="ppm">ppm</option>
          <option value="%">%</option>
          <option value="°C">°C</option>
          <option value="°F">°F</option>
          <option value="mg/m³">mg/m³</option>
          <option value="m/s">m/s</option>
          <option value="m³/h">m³/h</option>
          <option value="Pa">Pa</option>
          <option value="kPa">kPa</option>
          <option value="bar">bar</option>
          <option value="atm">atm</option>
          <option value="μg/m³">μg/m³</option>
          <option value="g/m³">g/m³</option>
          <option value="kg/h">kg/h</option>
          <option value="t/h">t/h</option>
          <option value="m³/s">m³/s</option>
          <option value="L/min">L/min</option>
          <option value="L/h">L/h</option>
          <option value="V">V</option>
          <option value="A">A</option>
          <option value="W">W</option>
          <option value="Hz">Hz</option>
          <option value="Ω">Ω</option>
        </select>
      ) },
      { key: "alarm", title: "Warning/Alarm", dataIndex: "alarm", render: (r) => <NumberField value={r.alarm ?? 80} onChange={(e) => setGases(gases.map(g => g.id === r.id ? { ...g, alarm: Number(e.target.value) || 80 } : g))} className="w-24" /> }
    ],
    add: () => setGases([...gases, { id: Date.now(), key: "", display: "", unit: "", enabled: true, alarm: 80, showCorrected: true }])
  }), [gases]);

  // แสดง skeleton loading ถ้ากำลังโหลดและไม่มีข้อมูล
  if (loading && devices.length === 0 && mapping.length === 0) {
    return <ConfigPageSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Main Card with Tabs */}
      <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  CEMS Configuration
                </h1>
                <p className="text-blue-100 text-sm">Continuous Emission Monitoring System</p>
              </div>
            </div>

            {/* Right side - Loading and Action buttons */}
            <div className="flex items-center gap-4">
        {loading && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white/20 rounded-full">
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-white text-sm font-medium">Loading...</span>
                </div>
              )}
              
              <div className="flex items-center gap-2">
          <button
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white font-medium rounded-lg transition-colors"
            onClick={reloadConfig}
          >
                  Refresh
          </button>
        </div>
            </div>
          </div>
        </div>

        {/* Message Display */}
        {message && (
          <div className="px-6 py-3 bg-blue-100 text-blue-800 border-b border-blue-200">
            {message}
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { key: 'devices', label: 'การเชื่อมต่อ' },
              { key: 'mapping', label: 'การแมปข้อมูล' },
              { key: 'gas', label: 'การตั้งค่าแก๊ส' },
              { key: 'status', label: 'Status/Alarm' }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
      </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'devices' && (
            <Section
              title="อุปกรณ์ที่เชื่อมต่อ (Devices)"
              right={
                <div className="flex items-center gap-2">
                  <button
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-colors"
                    onClick={saveDevices}
                  >
                    Save
                  </button>
                  <button
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
                    onClick={cDev.add}
                  >
                    Add Device
                  </button>
                </div>
              }
            >
        <div className="space-y-4">
          {devices.map(device => (
            <div key={device.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <h3 className="font-medium text-gray-900">{device.name}</h3>
                <p className="text-sm text-gray-600">{device.host}:{device.port} (Unit: {device.unit})</p>
              </div>
              <div className="flex gap-2">
                <button
                  className={`px-3 py-1 rounded text-sm ${
                    selectedDevice?.name === device.name 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                  onClick={() => setSelectedDevice(device)}
                >
                  {selectedDevice?.name === device.name ? 'Selected' : 'Select'}
                </button>
                <button
                  className="px-3 py-1 bg-yellow-500 hover:bg-yellow-600 text-white text-sm rounded transition-colors"
                  onClick={() => handleEditDevice(device)}
                >
                  Edit
                </button>
                <button
                  className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-sm rounded transition-colors"
                  onClick={() => handleDeleteDevice(device)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          {devices.length === 0 && (
            <p className="text-gray-500 text-center py-8">ไม่มีอุปกรณ์ที่ตั้งค่า</p>
          )}
        </div>
        
        {editingDevice && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-96">
              <h3 className="text-lg font-medium mb-4">แก้ไข Device</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ Device</label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={editForm.name}
                    onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">IP Address</label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={editForm.host}
                    onChange={(e) => setEditForm(prev => ({ ...prev, host: e.target.value }))}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
                    <input
                      type="number"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={editForm.port}
                      onChange={(e) => setEditForm(prev => ({ ...prev, port: Number(e.target.value) }))}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Slave ID</label>
                    <input
                      type="number"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={editForm.unit}
                      onChange={(e) => setEditForm(prev => ({ ...prev, unit: Number(e.target.value) }))}
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2 mt-6">
                <button
                  className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                  onClick={handleSaveEdit}
                >
                  บันทึก
                </button>
                <button
                  className="flex-1 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
                  onClick={handleCancelEdit}
                >
                  ยกเลิก
                </button>
              </div>
            </div>
          </div>
        )}
        
      </Section>
          )}

          {activeTab === 'mapping' && (
            <Section
              title="Mapping (สัญญาณอ่านจากอุปกรณ์)"
              right={
                <div className="flex items-center gap-2">
                  <button
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-colors"
                    onClick={saveMapping}
                  >
                    Save
                  </button>
                  <button
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
                    onClick={cMap.add}
                  >
                    Add Mapping
                  </button>
                </div>
              }
            >
        {!selectedDevice && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <p className="text-yellow-800">
              กรุณาเลือก Device ก่อนตั้งค่า Mapping
            </p>
          </div>
        )}
        {selectedDevice && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-blue-800">
              กำลังตั้งค่า Mapping สำหรับ: <strong>{selectedDevice.name}</strong>
            </p>
          </div>
        )}
        <DataTable cols={cMap.cols} rows={filteredMappings} onDelete={handleDelete} />
      </Section>
          )}

          {activeTab === 'gas' && (
            <Section
              title="Gas Settings (แสดงผล/ช่วงค่า/แจ้งเตือน)"
              right={
                <div className="flex items-center gap-2">
                  <button
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-colors"
                    onClick={saveGasSettings}
                  >
                    Save
                  </button>
                  <button
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
                    onClick={cGas.add}
                  >
                    Add Gas
                  </button>
                </div>
              }
            >
        <DataTable cols={cGas.cols} rows={gases} rowKey="id" onDelete={handleDelete} showDelete={true} />
      </Section>
          )}



          {false && activeTab === 'stack' && (
            <Section
              title="Stack Configuration (การตั้งค่า Stack)"
              right={
                <button
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-colors"
                  onClick={saveSystemParams}
                >
                  Save
                </button>
              }
            >
              <div className="space-y-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <Field label="รูปร่าง Stack" required>
                    <select
                      className="rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 w-64"
                      value={systemParams.stackShape}
                      onChange={(e) => updateSystemParam("stackShape", e.target.value)}
                    >
                      <option value="circular">วงกลม (Circular)</option>
                      <option value="circular_circumference">วงกลม - ใส่เส้นรอบวง</option>
                      <option value="rectangular">สี่เหลี่ยม (Rectangular)</option>
                      <option value="manual_area">ใส่พื้นที่โดยตรง</option>
                    </select>
                  </Field>
                </div>

                {systemParams.stackShape === "circular" && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <Field label="เส้นผ่านศูนย์กลาง (m)" required>
                      <NumberField
                        value={systemParams.stackDiameter}
                        onChange={(e) => updateSystemParam("stackDiameter", Number(e.target.value) || 1.0)}
                        className="w-40"
                      />
                    </Field>
                  </div>
                )}

                {systemParams.stackShape === "circular_circumference" && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <Field label="เส้นรอบวง (m)" required>
                      <NumberField
                        value={systemParams.stackCircumference || 0}
                        onChange={(e) => updateSystemParam("stackCircumference", Number(e.target.value) || 0)}
                        className="w-40"
                      />
                    </Field>
                  </div>
                )}

                {systemParams.stackShape === "rectangular" && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Field label="ความกว้าง (m)" required>
                        <NumberField
                          value={systemParams.stackWidth || 0}
                          onChange={(e) => updateSystemParam("stackWidth", Number(e.target.value) || 0)}
                          className="w-40"
                        />
                      </Field>
                      <Field label="ความยาว (m)" required>
                        <NumberField
                          value={systemParams.stackLength || 0}
                          onChange={(e) => updateSystemParam("stackLength", Number(e.target.value) || 0)}
                          className="w-40"
                        />
                      </Field>
                    </div>
                  </div>
                )}

                {systemParams.stackShape === "manual_area" && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <Field label="พื้นที่หน้าตัด (m²)" required>
                      <NumberField
                        value={systemParams.stackArea}
                        onChange={(e) => updateSystemParam("stackArea", Number(e.target.value) || 1.0)}
                        className="w-40"
                      />
                    </Field>
                  </div>
                )}

                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <h4 className="text-lg font-semibold text-blue-800 mb-4">
                    ผลการคำนวณ
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white rounded-lg p-3">
                      <Field label="พื้นที่หน้าตัด (m²)">
                        <span className="text-xl font-bold text-blue-600">
                          {systemParams.stackArea.toFixed(3)}
                        </span>
                      </Field>
                    </div>
                    <div className="bg-white rounded-lg p-3">
                      <Field label="เส้นผ่านศูนย์กลาง (m)">
                        <span className="text-xl font-bold text-blue-600">
                          {systemParams.stackDiameter.toFixed(3)}
                        </span>
                      </Field>
                    </div>
                  </div>
                </div>
              </div>
            </Section>
          )}
          {activeTab === 'status' && (
            <Section
              title="Status/Alarm Mapping (การตั้งค่า Status/Alarm)"
              right={
                <div className="flex items-center gap-2">
                  <button
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-colors"
                    onClick={saveStatusAlarmMapping}
                  >
                    Save
                  </button>
                  <button
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
                    onClick={() => addRow(statusAlarmMapping, setStatusAlarmMapping, {
                      name: "",
                      type: "status",
                      address: 0,
                      device: selectedDevice ? selectedDevice.name : "",
                      enabled: true
                    })}
                  >
                    Add Status/Alarm
                  </button>
                </div>
              }
            >
              {selectedDevice && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-blue-800">
                    กำลังตั้งค่า Status/Alarm สำหรับ: <strong>{selectedDevice.name}</strong>
                  </p>
                </div>
              )}
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-[700px] w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Name</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Type</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Address</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Device</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Enabled</th>
                        <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 w-24">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredStatusAlarmMappings.map((item, index) => (
                        <tr 
                          key={item.id} 
                          className={`hover:bg-gray-50 transition-colors ${
                            index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                          }`}
                        >
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-800">
                            <select
                              className="rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 w-56"
                              value={item.name || ""}
                              onChange={(e) => up(statusAlarmMapping, setStatusAlarmMapping)(item.id, "name", e.target.value)}
                            >
                              <option value="">Select {item.type || "status"}...</option>
                              {(item.type === "alarm" ? ALARM_OPTIONS : STATUS_OPTIONS)
                                .filter(option => {
                                  // กรองชื่อที่ใช้ไปแล้วออก (ยกเว้นชื่อปัจจุบันของ item นี้)
                                  const usedNames = statusAlarmMapping
                                    .filter(m => m.id !== item.id && m.name)
                                    .map(m => m.name);
                                  return !usedNames.includes(option);
                                })
                                .map(option => (
                                  <option key={option} value={option}>{option}</option>
                                ))}
                            </select>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-800">
                            <select
                              className="rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                              value={item.type || "status"}
                              onChange={(e) => {
                                const newType = e.target.value;
                                // เปลี่ยน type และรีเซ็ต name
                                up(statusAlarmMapping, setStatusAlarmMapping)(item.id, "type", newType);
                                up(statusAlarmMapping, setStatusAlarmMapping)(item.id, "name", "");
                              }}
                            >
                              <option value="status">Status</option>
                              <option value="alarm">Alarm</option>
                            </select>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-800">
                            <NumberField
                              value={item.address ?? 0}
                              onChange={(e) => up(statusAlarmMapping, setStatusAlarmMapping)(item.id, "address", Number(e.target.value) || 0)}
                            />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-800">
                            <select
                              className="rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                              value={item.device || ""}
                              onChange={(e) => up(statusAlarmMapping, setStatusAlarmMapping)(item.id, "device", e.target.value)}
                            >
                              <option value="">Select device...</option>
                              {devices.map(device => (
                                <option key={device.id} value={device.name}>{device.name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-800">
                            <Switch
                              checked={!!item.enabled}
                              onChange={(v) => up(statusAlarmMapping, setStatusAlarmMapping)(item.id, "enabled", v)}
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button 
                              className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded transition-colors" 
                              onClick={() => handleDelete(item)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                      {!filteredStatusAlarmMappings.length && (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center">
                            <div className="flex flex-col items-center gap-2">
                              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                                <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                              </div>
                              <div className="text-gray-500 font-medium">
                                {selectedDevice ? `No Status/Alarm mappings for ${selectedDevice.name}` : "No Status/Alarm mappings"}
                              </div>
                              <div className="text-gray-400 text-sm">Click "Add Status/Alarm" to create new entries</div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </Section>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal - ย้ายมาที่ root level */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-md mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">ยืนยันการลบ</h3>
            </div>
            
            <p className="text-gray-600 mb-6 whitespace-pre-line">
              {deleteConfirm.message}
            </p>
            
            <div className="flex gap-3">
              <button
                className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-medium"
                onClick={confirmDelete}
              >
                ลบ
              </button>
              <button
                className="flex-1 px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg transition-colors font-medium"
                onClick={cancelDelete}
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}
      
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

