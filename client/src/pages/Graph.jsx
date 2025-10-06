// src/pages/Graph.jsx
import { useEffect, useRef, useState, useCallback } from "react";
import { GraphPageSkeleton } from "../components/SkeletonLoader";
import { useGasSettings } from "../hooks/useGasSettings";

// ---- Canvas helpers: roundRect fallback ----
function drawRoundRect(ctx, x, y, w, h, r = 6) {
  const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  // ไม่ closePath ที่นี่ ปล่อยให้คนเรียกควบคุม fill/stroke เอง
}

/** ยูทิลวาดกราฟเส้นแบบเรียลไทม์ (สไตล์ Google Finance) */
function drawRealtimeChart(
  canvas,
  series,
  {
    title = "Realtime Chart",
    yUnit = "ppm",
    maxPoints = 120,
    chartTimeRange = "1h", // eslint-disable-line no-unused-vars
    showBaseline = false,      // เปิด/ปิดเส้นอ้างอิง (previous close)
    baselineValue = null,      // ค่าที่อยากอ้างอิง (ถ้ามี)
    markerMode = "auto",       // "auto" | "all" | "none"
    markerPixelGap = 28,       // ระยะห่างขั้นต่ำระหว่างจุด (px) เมื่อใช้ auto
    markerRadius = 2.5,        // ขนาดจุด
    windowStart = null,        // เวลาเริ่มของหน้าต่างที่ต้องการแสดง (ms)
    windowEnd = null           // เวลาสิ้นสุดของหน้าต่างที่ต้องการแสดง (ms)
  } = {}
) {
  const ctx = canvas.getContext("2d");

  // === HiDPI ===
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || 600;
  const height = canvas.clientHeight || 300;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // === BG ===
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, width, height);

  const pad = { l: 60, r: 70, t: 40, b: 40 };
  const plotW = width - pad.l - pad.r;
  const plotH = height - pad.t - pad.b;

  // === เตรียมข้อมูล ===
  console.log('🔍 drawRealtimeChart - Input series:', series);
  const trimmed = series.map(s => {
    const raw = (s.data || []).filter(p =>
      (!windowStart || p.t >= windowStart) &&
      (!windowEnd   || p.t <= windowEnd)
    );
    const filtered = raw.slice(-maxPoints).filter(p => p && p.t && Number.isFinite(p.y));
    console.log(`📈 ${s.name} - Raw data: ${raw.length}, Filtered: ${filtered.length}`);
    return {
      ...s,
      data: filtered
    };
  });

  const allTimes = trimmed.flatMap(s => s.data.map(p => p.t));
  console.log('⏰ All times length:', allTimes.length);
  if (allTimes.length === 0) {
    console.log('❌ No data points available - showing "No data available"');
    ctx.fillStyle = "#94a3b8";
    ctx.font = "13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("No data available", width / 2, height / 2);
    return;
  }

  const Xmin = Math.min(...allTimes);
  const Xmax = Math.max(...allTimes);
  const Xrange = Math.max(1, Xmax - Xmin);

  const allVals = trimmed.flatMap(s => s.data.map(p => p.y));
  let Ymin = 0; // เริ่มจาก 0 เสมอ
  let Ymax = Math.max(...allVals);
  if (Ymax === 0) { Ymax = 10; } // ถ้าค่าสูงสุดเป็น 0 ให้แสดงเป็น 10
  
  // คำนวณช่วงค่าให้เป็นเลขลงตัว (0, 5, 10, 15, 20, ...)
  const step = Math.ceil(Ymax / 7) * 5; // หาขั้นที่เหมาะสม (5, 10, 15, 20, ...)
  Ymax = Math.ceil(Ymax / step) * step; // ปัดขึ้นเป็นเลขลงตัว
  const Yrange = Ymax - Ymin;

  const xScale = t => pad.l + (plotW * (t - Xmin)) / Xrange;
  const yScale = v => pad.t + plotH * (1 - (v - Ymin) / Yrange);

  // === กริดแนวนอน (ค่า) + labels ซ้าย ===
  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 1;
  
  // ใช้ค่าเดียวกันกับที่คำนวณไว้แล้ว
  const maxVal = Ymax; // ใช้ค่า Ymax ที่คำนวณไว้แล้ว
  const hLines = maxVal / step; // จำนวนเส้นกริด
  
  ctx.fillStyle = "#64748b";
  ctx.font = "11px system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  for (let i = 0; i <= hLines; i++) {
    const y = pad.t + (plotH * i) / hLines;
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(width - pad.r, y);
    ctx.stroke();

    const val = maxVal - (maxVal * i) / hLines;
    // แสดงเป็นเลขเต็มถ้าเป็นเลขลงตัว
    const displayVal = val % 1 === 0 ? val.toString() : val.toFixed(1);
    ctx.fillText(displayVal, pad.l - 8, y);
  }

  // === กริดแนวตั้ง (เวลา) + labels ล่าง ===
  const vLines = 6;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (let i = 0; i <= vLines; i++) {
    const t = Xmin + (Xrange * i) / vLines;
    const x = xScale(t);
    ctx.beginPath();
    ctx.moveTo(x, pad.t);
    ctx.lineTo(x, height - pad.b);
    ctx.stroke();

    const d = new Date(t);
    let lbl;
    if (Xrange <= 24 * 60 * 60 * 1000) {
      lbl = d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", hour12: false });
    } else if (Xrange <= 7 * 24 * 60 * 60 * 1000) {
      lbl = d.toLocaleDateString("th-TH", { month: "short", day: "numeric" });
    } else {
      lbl = d.toLocaleDateString("th-TH", { month: "short", year: "2-digit" });
    }
    ctx.fillStyle = "#64748b";
    ctx.fillText(lbl, x, height - pad.b + 6);
  }

  // === หัวเรื่อง/หน่วย ===
  ctx.fillStyle = "#f8fafc";
  ctx.font = "16px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(title, pad.l, pad.t - 14);
  
  ctx.font = "12px system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(yUnit, width - pad.r, pad.t - 14);

  // === baseline (เช่น previous close) ===
  if (showBaseline && baselineValue != null) {
    const by = yScale(baselineValue);
    ctx.save();
    ctx.strokeStyle = "#64748b";
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(pad.l, by);
    ctx.lineTo(width - pad.r, by);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`อ้างอิง: ${baselineValue}`, pad.l + 6, by - 6);
    ctx.restore();
  }

  // === วาดเส้นซีรีส์ (สไตล์การเงิน: เส้นลื่น + พื้นที่จาง) ===
  const palette = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#22d3ee", "#8b5cf6", "#f97316", "#ec4899"];

  trimmed.forEach((s, i) => {
    const color = s.color || palette[i % palette.length];
    const pts = [...s.data].sort((a, b) => a.t - b.t);
    console.log(`🎨 Drawing ${s.name} - Points: ${pts.length}, Color: ${color}`);
    
    if (pts.length === 0) {
      console.log(`❌ No points to draw for ${s.name}`);
      return;
    }

    // พื้นที่ + เส้น วาดเฉพาะถ้ามีอย่างน้อย 2 จุด
    if (pts.length >= 2) {
      console.log(`✅ Drawing line for ${s.name} with ${pts.length} points`);
      // พื้นที่ใต้กราฟ
      const grad = ctx.createLinearGradient(0, pad.t, 0, height - pad.b);
      grad.addColorStop(0, color + "55");
      grad.addColorStop(1, color + "0A");
      ctx.beginPath();
      ctx.moveTo(xScale(pts[0].t), yScale(pts[0].y));
      for (let k = 1; k < pts.length; k++) {
        ctx.lineTo(xScale(pts[k].t), yScale(pts[k].y));
      }
      ctx.lineTo(xScale(pts[pts.length - 1].t), height - pad.b);
      ctx.lineTo(xScale(pts[0].t), height - pad.b);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // เส้นกราฟ
      ctx.beginPath();
      ctx.moveTo(xScale(pts[0].t), yScale(pts[0].y));
      for (let k = 1; k < pts.length; k++) {
        ctx.lineTo(xScale(pts[k].t), yScale(pts[k].y));
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // --- MARKERS (adaptive) ---
      if (markerMode !== "none") {
        let lastMarkX = -Infinity;
        for (let k = 0; k < pts.length; k++) {
          const px = xScale(pts[k].t);
          const py = yScale(pts[k].y);

          const shouldDraw =
            markerMode === "all" ||
            px - lastMarkX >= markerPixelGap;       // ห่างพอในโหมด auto (ไม่รวมจุดล่าสุด)

          if (shouldDraw) {
            lastMarkX = px;
            ctx.beginPath();
            ctx.fillStyle = color;
            ctx.arc(px, py, markerRadius, 0, Math.PI * 2);
            ctx.fill();
            // ขอบจางๆ ให้ดูคม
            ctx.strokeStyle = "#0b1220";
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }
    }

    // จุด/เส้นแนวตั้งตำแหน่งล่าสุด + ป้ายราคาด้านขวา
    const last = pts[pts.length - 1];
    const lx = xScale(last.t);
    const ly = yScale(last.y);

    // เส้นแนวตั้งที่ตำแหน่งล่าสุด
    ctx.save();
    ctx.strokeStyle = "#94a3b8";
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(lx, pad.t);
    ctx.lineTo(lx, height - pad.b);
    ctx.stroke();
    ctx.restore();

    // จุดล่าสุด
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(lx, ly, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // ป้ายราคาด้านขวา (price pill)
    const label = `${last.y.toFixed(2)} ${yUnit || ""}`.trim();
    const pillY = ly;
    const pillX = width - pad.r + 6;
    const padX = 8;
    ctx.font = "12px system-ui, sans-serif";
    const textW = ctx.measureText(label).width;
    const pillW = textW + padX * 2;
    const pillH = 22;

    // เส้นต่อจากจุด -> ป้าย
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(pillX - 6, pillY);
    ctx.stroke();

    // กล่องป้าย
    ctx.fillStyle = "#0b1220";
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    drawRoundRect(ctx, pillX, pillY - pillH / 2, pillW, pillH, 6);
    ctx.fill();
    ctx.stroke();
      
    // ข้อความในป้าย
    ctx.fillStyle = "#e2e8f0";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(label, pillX + padX, pillY);
  });

  // ชื่อซีรีส์ด้านล่างซ้าย + ค่าล่าสุดรวม ๆ
  trimmed.forEach((s, i) => {
    const color = s.color || palette[i % palette.length];
    const last = s.data[s.data.length - 1];
    if (!last) return;
    ctx.fillStyle = color;
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(s.name, pad.l + 8 + i * 110, height - 14);
  });
}

// Function to convert timeRange string to milliseconds
const getTimeRangeMs = (timeRange) => {
  const now = Date.now();
  switch (timeRange) {
    case "1h": return 60 * 60 * 1000;        // 1 ชั่วโมง
    case "6h": return 6 * 60 * 60 * 1000;    // 6 ชั่วโมง  
    case "1d": return 24 * 60 * 60 * 1000;   // 1 วัน
    case "5d": return 5 * 24 * 60 * 60 * 1000; // 5 วัน
    case "1m": return 30 * 24 * 60 * 60 * 1000; // 1 เดือน (30 วัน)
    case "6m": return 6 * 30 * 24 * 60 * 60 * 1000; // 6 เดือน (180 วัน)
    case "1y": return 365 * 24 * 60 * 60 * 1000; // 1 ปี (365 วัน)
    default: return 24 * 60 * 60 * 1000; // default 1 วัน
  }
};

export default function Graph() {
  const { gasSettings, loading: gasLoading } = useGasSettings();
  const canvasRefs = useRef({});
  const [running, setRunning] = useState(true);
  const [timeRange, setTimeRange] = useState("realtime");
  const [selectedStack, setSelectedStack] = useState("stack1");
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [isFirstLiveLoad, setIsFirstLiveLoad] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSeries, setModalSeries] = useState(null);
  const [tooltip, setTooltip] = useState({ show: false, x: 0, y: 0, data: null });
  const [liveWindowMs, setLiveWindowMs] = useState(2 * 60 * 1000); // 2 นาทีเริ่มต้น (ตามตัวอย่าง)
  
  const prevRangeRef = useRef(timeRange);
  // const lastTsRef = useRef({}); // ไม่ใช้แล้ว
  const fetchingRef = useRef(false);
  const modalCanvasRef = useRef(null);
  
  const loadSeriesFromStorage = () => {
    try {
      const savedSeries = localStorage.getItem('graph_series_data');
      if (savedSeries) {
        const parsed = JSON.parse(savedSeries);
        // ตรวจสอบว่าข้อมูลไม่เก่าเกินไป (ไม่เกิน 2 ชั่วโมง)
        const now = Date.now();
        const filtered = parsed.map(s => ({
          ...s,
          data: s.data.filter(d => (now - d.t) < 2 * 60 * 60 * 1000) // เก็บข้อมูลไม่เกิน 2 ชั่วโมง
        }));
        return filtered;
      }
    } catch (error) {
      console.warn('Failed to load series from localStorage:', error);
    }
    return null;
  };

  // สร้าง series จาก gas settings แบบ dynamic
  const createSeriesFromGasSettings = useCallback(() => {
    console.log('🏗️ Creating series from gas settings:', gasSettings);
    const colors = ["#10b981", "#3b82f6", "#eab308", "#f59e0b", "#ef4444", "#f97316", "#8b5cf6", "#06b6d4", "#ec4899"];
    const newSeries = gasSettings.map((gas, index) => ({
      name: gas.key,
      display: gas.display,
      unit: gas.unit,
      data: [],
      color: colors[index % colors.length],
      enabled: gas.enabled
    }));
    console.log('✅ Created series:', newSeries);
    return newSeries;
  }, [gasSettings]);

  const [series, setSeries] = useState([]);

  // อัปเดต series เมื่อ gas settings เปลี่ยน
  useEffect(() => {
    if (gasSettings.length > 0) {
      const newSeries = createSeriesFromGasSettings();
      setSeries(newSeries);
      console.log('Updated series from gas settings:', newSeries);
    }
  }, [gasSettings, createSeriesFromGasSettings]);

  const saveSeriesToStorage = (seriesData) => {
    try {
      localStorage.setItem('graph_series_data', JSON.stringify(seriesData));
      console.log('💾 Saved series data to localStorage');
    } catch (error) {
      console.warn('Failed to save series to localStorage:', error);
    }
  };

  const API = "http://127.0.0.1:8000";
const WS_URL = "ws://127.0.0.1:8000";
  
  // ตรวจสอบว่า API URL ถูกต้องหรือไม่
  if (!API || API === "undefined") {
    console.warn("API URL is not properly configured");
  }

  // ฟังก์ชันตัดข้อมูลเก่า + บีบจำนวนจุด (เก็บข้อมูลเก่าไว้มากขึ้น)
  const pruneWindow = (points, now, windowMs, maxPoints) => {
    const cutoff = now - windowMs;
    let pruned = points.filter(p => 
      p && 
      p.t && 
      Number.isFinite(p.t) && 
      Number.isFinite(p.y) && 
      p.t >= cutoff
    );

    // เก็บข้อมูลเก่าไว้มากขึ้น - เพิ่ม buffer สำหรับการแสดงผล (ตามตัวอย่าง)
    const bufferPoints = Math.max(20, Math.floor(maxPoints * 0.2)); // ลด buffer เป็น 20% เพื่อให้เหมือนตัวอย่าง
    if (pruned.length > maxPoints) {
      // เก็บข้อมูลเก่าไว้มากขึ้นโดยการ slice จากจุดที่เก่ากว่า
      const keepOldData = Math.max(bufferPoints, Math.floor(maxPoints * 0.3));
      pruned = [...points.slice(-keepOldData), ...pruned.slice(-(maxPoints - keepOldData))];
    }
    
    // กันกรณีเหลือแค่ 1 จุด ทำให้ไม่มีเส้น
    if (pruned.length < 2 && points.length >= 2) {
      pruned = points.slice(-Math.min(10, points.length)).filter(p => p && p.t && Number.isFinite(p.t) && Number.isFinite(p.y));
    }
    
    
    return pruned;
  };

  // ฟังก์ชันเปิด Modal
  const openModal = (series) => {
    setModalSeries(series);
    setModalOpen(true);
  };

  // ฟังก์ชันปิด Modal
  const closeModal = () => {
    setModalOpen(false);
    setModalSeries(null);
  };

  // ฟังก์ชันจัดการ Tooltip
  const handleMouseMove = (e, series) => {
    const canvas = canvasRefs.current[series.name];
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const lastT = (series.data?.at(-1)?.t) ?? Date.now();
    const ws = timeRange === "realtime" ? lastT - liveWindowMs : null;
    const we = timeRange === "realtime" ? lastT : null;
    const viewSeries = ws
      ? { ...series, data: (series.data || []).filter(p => p.t >= ws && p.t <= we) }
      : series;

    // คำนวณข้อมูลจากตำแหน่งเมาส์
    const data = getDataFromPosition(x, y, viewSeries);
    
    if (data) {
      setTooltip({
        show: true,
        x: e.clientX,
        y: e.clientY,
        data: data
      });
    }
  };

  const handleMouseLeave = () => {
    setTooltip({ show: false, x: 0, y: 0, data: null });
  };

  // ฟังก์ชันคำนวณข้อมูลจากตำแหน่งเมาส์
  const getDataFromPosition = (mouseX, mouseY, series) => {
    if (!series || !series.data || series.data.length === 0) return null;

    const canvas = canvasRefs.current[series.name];
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    const pad = { l: 60, r: 70, t: 40, b: 40 };
    const plotW = width - pad.l - pad.r;

    // ถ้าเมาส์อยู่นอกพื้นที่ plot → ไม่โชว์ tooltip
    if (mouseX < pad.l || mouseX > width - pad.r || mouseY < pad.t || mouseY > height - pad.b) {
      return null;
    }

    const times = series.data.map(p => p.t).filter(t => Number.isFinite(t));
    if (times.length === 0) return null;
    
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    if (!Number.isFinite(minTime) || !Number.isFinite(maxTime) || maxTime <= minTime) return null;

    const tAtMouse = minTime + ((mouseX - pad.l) / plotW) * (maxTime - minTime);

    // หา nearest ด้วย binary search จะนิ่งกว่า (ข้อมูลเรียงเวลาอยู่แล้ว)
    const arr = series.data;
    let lo = 0, hi = arr.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (arr[mid].t < tAtMouse) lo = mid + 1; else hi = mid;
    }
    // เปรียบเทียบจุด lo และ lo-1
    let idx = lo;
    if (lo > 0 && Math.abs(arr[lo - 1].t - tAtMouse) < Math.abs(arr[lo].t - tAtMouse)) idx = lo - 1;
    const closest = arr[idx];
    if (!closest) return null;

    const d = new Date(closest.t);
    return {
      time: d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
      value: Number(closest.y) || 0,
      unit: series.unit,
      name: series.name
    };
  };

  // ฟังก์ชันสำหรับดึงข้อมูลจาก API
  const fetchData = useCallback(async () => {
    if (fetchingRef.current) return;  // กันซ้อน
    fetchingRef.current = true;
    try {
      let response, result;
      
      if (timeRange === "realtime") {
        // โหมด Real-time: ดึงข้อมูลล่าสุดจาก Modbus
        response = await fetch(`${API}/api/data/latest/${selectedStack}`);
        result = await response.json();
        
        if (result.success && result.data && Array.isArray(result.data) && result.data.length > 0) {
          const stackData = result.data[0];
          const now = Date.now(); // ใช้เวลาตัวเดียวกันทั้งฟังก์ชัน
          
          // ถ้าเป็นครั้งแรกที่เข้าสู่โหมด Live ให้ดึงข้อมูลย้อนหลังตาม liveWindowMs
          if (isFirstLiveLoad) {
            // ดึงข้อมูลย้อนหลังตาม liveWindowMs จาก InfluxDB
            const windowAgo = new Date(Date.now() - liveWindowMs);
            const historicalResponse = await fetch(`${API}/api/data/range?stack_id=${selectedStack}&start_time=${windowAgo.toISOString()}&end_time=${new Date().toISOString()}&limit=10000`);
            const historicalResult = await historicalResponse.json();
            
            if (historicalResult.success && historicalResult.data && Array.isArray(historicalResult.data) && historicalResult.data.length > 0) {
              // แปลงข้อมูลย้อนหลังเป็นรูปแบบกราฟ
              const historicalData = historicalResult.data.map(item => ({
                timestamp: new Date(item.timestamp).getTime(),
                SO2: item.SO2 || 0,
                NOx: item.NOx || 0,
                O2: item.O2 || 0,
                CO: item.CO || 0,
                Dust: item.Dust || 0,
                Temperature: item.Temperature || 0,
                Velocity: item.Velocity || 0,
                Flowrate: item.Flowrate || 0,
                Pressure: item.Pressure || 0,
              }));
              
              
              // อัปเดตข้อมูลย้อนหลัง
              setSeries(prev => prev.map(s => {
                const dataPoints = historicalData.map(item => ({
                  t: item.timestamp,
                  y: Number(item[s.name]) || 0
                })).filter(d => 
                  d.t && 
                  Number.isFinite(d.t) && 
                  Number.isFinite(d.y)
                ).sort((a, b) => a.t - b.t); // เรียงลำดับตามเวลา
                
                return {
                  ...s,
                  data: dataPoints
                };
              }));
            }
            setIsFirstLiveLoad(false); // ตั้งค่าให้ไม่ใช่ครั้งแรกแล้ว
          }
          
          // ก่อน map: ประเมิน max จุดที่ต้องการเก็บในหน้าต่าง live
          // const sampleMs = 5000; // 5 วินาที
          // const maxPtsInWindow = Math.ceil(liveWindowMs / sampleMs) + 20; // ไม่ใช้แล้ว

          // อัปเดตข้อมูลแต่ละ series (เพิ่มจุดใหม่)
          setSeries(prev => prev.map(s => {
            let value = 0;
            
            // ดึงค่าจากข้อมูลที่ได้รับ
            if (stackData.data && Object.keys(stackData.data).length > 0) {
              value = stackData.data[s.name] ?? 0;
            } else {
              // ไม่มีข้อมูลจริง - ใช้ค่า 0
              value = 0;
            }

            // ✅ ใช้เวลา server ถ้ามี (fallback เป็น now)
            const ts = (() => {
              const iso = stackData.timestamp || stackData.data?.timestamp;
              const t = iso ? Date.parse(iso) : NaN;
              return Number.isFinite(t) ? t : now;
            })();

            const data = [...(s.data || [])];
            const last = data[data.length - 1];

            // ✅ ถ้าเวลาเท่ากันเท่านั้น → อัปเดตจุดล่าสุด; ถ้าไม่เท่ากันให้ push ต่อเนื่อง
            if (last && ts === last.t) {
              data[data.length - 1] = { t: ts, y: Number(value) };
            } else {
              data.push({ t: ts, y: Number(value) });
            }

            // ✅ เก็บข้อมูลเก่าไว้มากขึ้น + แสดงต่อเนื่อง (ตามตัวอย่าง 1-2 นาที)
            const maxPtsInWindow = Math.ceil(liveWindowMs / 1000) + 50; // ลดจาก 200 เป็น 50 เพื่อให้เหมือนตัวอย่าง
            const pruned = pruneWindow(data, ts, liveWindowMs, maxPtsInWindow);
            
            return { ...s, data: pruned };
          }));
          
          // ตรวจสอบสถานะการเชื่อมต่อ
          const status = stackData.status || "unknown";
          if (status === "no devices configured") {
            setIsConnected(false);
          } else {
            setIsConnected(true);
          }
          setLastUpdate(new Date());
          return;
        }
      } else {
        // โหมด Historical: ดึงข้อมูลจาก InfluxDB ตาม timeRange
        console.log(`Historical mode - fetching data for ${timeRange}`);
        
        const timeRangeMs = getTimeRangeMs(timeRange);
        // แก้ไข timestamp year mismatch - ใช้ปี 2025 ให้ตรงกับ InfluxDB
        const now = new Date();
        const currentYear = 2025; // ตรงกับข้อมูลใน InfluxDB
        const startTime = new Date(currentYear, now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds());
        startTime.setTime(startTime.getTime() - timeRangeMs);
        const endTime = new Date(currentYear, now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds());
        
        console.log(`Fetching historical data from ${startTime.toISOString()} to ${endTime.toISOString()}`);
        
        const response = await fetch(`${API}/api/data/range?stack_id=${selectedStack}&start_time=${startTime.toISOString()}&end_time=${endTime.toISOString()}&limit=10000`);
        const result = await response.json();
        
        if (result.success && result.data && Array.isArray(result.data) && result.data.length > 0) {
          console.log(`Received ${result.data.length} historical data points`);
          
          // แปลงข้อมูล historical เป็นรูปแบบกราฟ
          const historicalData = result.data.map(item => ({
            timestamp: new Date(item.timestamp).getTime(),
            ...item // ใช้ข้อมูลทั้งหมดจาก API
          }));
          
          // อัปเดต series data
          setSeries(prevSeries => prevSeries.map(s => {
            const seriesData = historicalData.map(item => ({
              t: item.timestamp,
              y: item[s.name] || 0
            }));
            return { ...s, data: seriesData };
          }));
          
          setIsConnected(true);
          setLastUpdate(new Date());
          console.log("Historical data loaded successfully");
        } else {
          console.warn("No historical data found or API error:", result);
          setIsConnected(false);
        }
        return;
      }
      
      // ใช้ WebSocket เท่านั้น - ไม่มี HTTP fallback
      if (false) { // ปิดการใช้งาน HTTP
        // แปลงข้อมูลจาก SQLite เป็นรูปแบบกราฟ
        let graphData = result.data.map(item => ({
          timestamp: new Date(item.timestamp).getTime(), // ใช้เวลาจาก backend
          SO2: item.SO2 || 0,
          NOx: item.NOx || 0,
          O2: item.O2 || 0,
          CO: item.CO || 0,
          Dust: item.Dust || 0,
          Temperature: item.Temperature || 0,
          Velocity: item.Velocity || 0,
          Flowrate: item.Flowrate || 0,
          Pressure: item.Pressure || 0,
        }));
        
        // ใช้ข้อมูลจริงเท่านั้น ไม่สร้าง Mock data
        console.log(`ข้อมูลจริงมี ${graphData.length} จุด`);
        
        // แสดงข้อมูลช่วงเวลาที่มีจริง
        if (graphData.length > 0) {
          const firstTime = new Date(Math.min(...graphData.map(d => d.timestamp)));
          const lastTime = new Date(Math.max(...graphData.map(d => d.timestamp)));
          console.log(`ข้อมูลมีตั้งแต่: ${firstTime.toLocaleString()} ถึง: ${lastTime.toLocaleString()}`);
        }
        
        
        // อัปเดตข้อมูลแต่ละ series (เก็บข้อมูลเก่าไว้)
        setSeries(prev => prev.map(s => {
          const seriesData = graphData.map(d => {
            let value = 0;
            
            // ดึงค่าจากข้อมูลที่ได้รับ
            value = d[s.name] || 0;
            
            return { 
              t: d.timestamp, 
              y: Number(value) || 0  // กัน NaN/undefined
            };
          }).filter(d => 
            d.t && 
            Number.isFinite(d.t) && 
            Number.isFinite(d.y)
          );
          
          console.log(`Historical ${s.name} data points:`, seriesData.length);
          
          // ใช้ข้อมูลใหม่เท่านั้น (ไม่รวมข้อมูลเก่า)
          return {
            ...s,
            data: seriesData
          };
        }));
        
        // สำหรับ historical data ให้แสดงเป็น connected เสมอ
        setIsConnected(true);
        setLastUpdate(new Date());
      } else {
        console.warn("No historical data found");
        setIsConnected(false);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
      console.error("Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      setIsConnected(false);
      // แสดงข้อความ error ให้ผู้ใช้ทราบ
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        console.warn("Network error - check API connection");
      }
    } finally {
      fetchingRef.current = false;
    }
  }, [selectedStack, timeRange, liveWindowMs, isFirstLiveLoad, API]);

  // บันทึกข้อมูลลง localStorage เมื่อ series เปลี่ยนแปลง
  useEffect(() => {
    if (series && series.length > 0) {
      // บันทึกเฉพาะเมื่อมีข้อมูลจริง
      const hasData = series.some(s => s.data && s.data.length > 0);
      if (hasData) {
        saveSeriesToStorage(series);
      }
    }
  }, [series]);

  // ดึงข้อมูลเริ่มต้น
  useEffect(() => {
    // ลองโหลดข้อมูลจาก localStorage ก่อน
    const savedSeries = loadSeriesFromStorage();
    if (savedSeries && savedSeries.length > 0) {
      setSeries(savedSeries);
      setIsFirstLiveLoad(false); // ไม่ต้องดึงข้อมูลย้อนหลังเพราะมีข้อมูลแล้ว
      console.log('📂 Loaded series data from localStorage');
    } else {
      // ถ้าไม่มีข้อมูลใน localStorage ให้ดึงข้อมูลใหม่
      if (timeRange === "realtime" && prevRangeRef.current !== "realtime") {
        setIsFirstLiveLoad(true);
      }
      fetchData();
    }
    prevRangeRef.current = timeRange;
  }, [selectedStack, timeRange, fetchData]);

  // WebSocket connection for real-time data
  useEffect(() => {
    if (timeRange !== "realtime" || !running) return;

    let ws = null;
    let reconnectTimeout = null;
    let isMounted = true;

    const connect = () => {
      // ป้องกันการเชื่อมต่อเมื่อ component unmount
      if (!isMounted) {
        console.log("Component unmounted, skipping WebSocket connection");
        return;
      }
      
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        return;
      }

      console.log("🔌 Graph connecting to WebSocket:", `${WS_URL}/ws/data`);
      ws = new WebSocket(`${WS_URL}/ws/data`);

      ws.onopen = () => {
        console.log("Graph WebSocket connected");
        setIsConnected(true);
        // Send initial data request
        try {
          ws.send(JSON.stringify({ type: "get_latest_data" }));
          console.log("📤 Graph sent initial data request");
        } catch (error) {
          console.error("❌ Error sending initial data request:", error);
        }
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type !== "data" || !message.data?.length) return;
            const stackData = message.data[0];
          const raw = stackData.data || {};
          const corrected = stackData.corrected_data || {};

          // ✅ ใช้เวลา server ถ้ามี (fallback เป็น now)
          const ts = (() => {
            const iso = raw.timestamp || corrected.timestamp || null;
            const t = iso ? Date.parse(iso) : NaN;
            return Number.isFinite(t) ? t : Date.now();
          })();

          setSeries(prev => prev.map(s => {
            // ดึงค่าตามชื่อซีรีส์
                let value = 0;
            if (s.name.includes("Corr")) {
              const base = s.name.replace("Corr", "");
              value = Number(corrected?.[base] ?? 0);
                  } else {
              value = Number(raw?.[s.name] ?? 0);
            }
            if (!Number.isFinite(value) || Math.abs(value) > 1e6) value = 0; // กันค่าเพี้ยน

            const data = [...(s.data || [])];
            const last = data[data.length - 1];

            // ✅ ถ้าเวลาเท่ากันเท่านั้น → อัปเดตจุดล่าสุด; ถ้าไม่เท่ากันให้ push ต่อเนื่อง
            if (last && ts === last.t) {
              data[data.length - 1] = { t: ts, y: value };
            } else {
              data.push({ t: ts, y: value });
            }

            // ✅ เก็บข้อมูลเก่าไว้มากขึ้น + แสดงต่อเนื่อง (ตามตัวอย่าง 1-2 นาที)
            const maxPtsInWindow = Math.ceil(liveWindowMs / 1000) + 50; // ลดจาก 200 เป็น 50 เพื่อให้เหมือนตัวอย่าง
            const pruned = pruneWindow(data, ts, liveWindowMs, maxPtsInWindow);
            return { ...s, data: pruned };
          }));
            
            setLastUpdate(new Date());
            setIsConnected(true);
        } catch (e) {
          console.error("WS parse error", e);
        }
      };

      ws.onerror = (e) => {
        if (!isMounted) return;
        console.warn("⚠️ Graph WebSocket error:", e);
        setIsConnected(false);
         // ไม่ reconnect ทันที ให้รอ onclose
      };

      ws.onclose = (e) => {
        if (!isMounted) return;
        console.warn("🔌 Graph WebSocket closed", {
          code: e.code,
          reason: e.reason,
          wasClean: e.wasClean
        });
        ws = null;
        setIsConnected(false);
        
        // Only reconnect if not a clean close and component is still mounted
        if (e.code !== 1000 && isMounted) {
           console.log("🔄 Graph scheduling reconnect in 5s...");
           reconnectTimeout = setTimeout(connect, 5000); // เพิ่มเวลาเป็น 5 วินาที
        }
      };
    };

    connect();

    return () => {
      console.log("🧹 Graph cleaning up WebSocket connection");
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
  }, [timeRange, selectedStack, WS_URL, liveWindowMs, running]);

  // บันทึกข้อมูลเมื่อ component unmount
  useEffect(() => {
    return () => {
      if (series && series.length > 0) {
        const hasData = series.some(s => s.data && s.data.length > 0);
        if (hasData) {
          saveSeriesToStorage(series);
          console.log('💾 Saved series data on component unmount');
        }
      }
    };
  }, [series]);

  // Polling สำหรับโหมด historical (ที่ไม่ใช่ realtime)
  useEffect(() => {
    if (timeRange === "realtime" || !running) return;
    
    const interval = 30000; // อัปเดตทุก 30 วินาทีสำหรับ historical
    const id = setInterval(fetchData, interval);
    return () => clearInterval(id);
  }, [running, selectedStack, timeRange, fetchData]);

  // รีเฟรชข้อมูลเมื่อเปลี่ยน Live Window
  useEffect(() => {
    if (timeRange === "realtime") {
      setIsFirstLiveLoad(true); // ตั้งค่าให้ดึงข้อมูลย้อนหลังใหม่
      // ใช้ setTimeout เพื่อหลีกเลี่ยง race condition
      const timeoutId = setTimeout(() => {
        fetchData();
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [liveWindowMs, timeRange, fetchData]);

  // วาดกราฟแต่ละตัว
  useEffect(() => {
    console.log('🎨 Drawing graphs for series:', series.length);
    series.forEach((s) => {
      console.log(`📊 Drawing ${s.name}:`, {
        dataLength: s.data?.length || 0,
        hasCanvas: !!canvasRefs.current[s.name],
        firstDataPoint: s.data?.[0],
        lastDataPoint: s.data?.at(-1)
      });
      
      const canvas = canvasRefs.current[s.name];
      if (!canvas) {
        console.warn(`❌ No canvas found for ${s.name}`);
        return;
      }
      const lastT = s.data?.at(-1)?.t ?? Date.now();
      const ws = timeRange === "realtime" ? lastT - liveWindowMs : null;
      const we = timeRange === "realtime" ? lastT : null;

      drawRealtimeChart(canvas, [s], { 
        title: `${s.name} Real-time Monitoring`, 
        yUnit: s.unit, 
        maxPoints: Math.max(Math.ceil(liveWindowMs/10000) + 20, 120),
        chartTimeRange: timeRange,
        showBaseline: false,         // ถ้ามีค่าปิดอ้างอิงค่อยเปิด true
        markerMode: "auto",          // แสดงจุดแบบ adaptive
        markerPixelGap: 28,          // ระยะห่างขั้นต่ำ 28px
        markerRadius: 2.5,           // ขนาดจุด 2.5px
        windowStart: ws,
        windowEnd: we
        // baselineValue: 3620554.57  // ตัวอย่าง: ค่าปิดก่อนหน้า (ถ้าต้องการเส้นประเทียบ)
      });
      console.log(`✅ Drew chart for ${s.name}`);
    });
  }, [series, timeRange, liveWindowMs]);

  // รีวาดเมื่อหน้าต่างย่อ/ขยาย
  useEffect(() => {
    const onResize = () => {
      series.forEach((s) => {
        const canvas = canvasRefs.current[s.name];
        if (!canvas) return;
        const lastT = s.data?.at(-1)?.t ?? Date.now();
        const ws = timeRange === "realtime" ? lastT - liveWindowMs : null;
        const we = timeRange === "realtime" ? lastT : null;

        drawRealtimeChart(canvas, [s], { 
          title: `${s.name} Real-time Monitoring`, 
          yUnit: s.unit, 
          maxPoints: Math.max(Math.ceil(liveWindowMs/10000) + 20, 120),
          chartTimeRange: timeRange,
          showBaseline: false,         // ถ้ามีค่าปิดอ้างอิงค่อยเปิด true
          markerMode: "auto",          // แสดงจุดแบบ adaptive
          markerPixelGap: 28,          // ระยะห่างขั้นต่ำ 28px
          markerRadius: 2.5,           // ขนาดจุด 2.5px
          windowStart: ws,
          windowEnd: we
        });
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [series, timeRange, liveWindowMs]);

  // Sync modalSeries กับ series หลักเมื่อมีข้อมูลใหม่
  useEffect(() => {
    if (modalOpen && modalSeries) {
      // หา series ที่ตรงกับ modalSeries จาก series หลัก
      const currentSeries = series.find(s => s.name === modalSeries.name);
      if (currentSeries) {
        setModalSeries(currentSeries); // อัปเดต modalSeries ด้วยข้อมูลใหม่
      }
    }
  }, [series, modalOpen, modalSeries]);

  // วาดกราฟใน Modal เมื่อเปิด
  useEffect(() => {
    if (!modalOpen || !modalSeries) return;
    const modalCanvas = modalCanvasRef.current;
    if (!modalCanvas) return;

    const lastT = modalSeries.data?.at(-1)?.t ?? Date.now();
    const ws = timeRange === "realtime" ? lastT - liveWindowMs : null;
    const we = timeRange === "realtime" ? lastT : null;

    drawRealtimeChart(modalCanvas, [modalSeries], {
      title: `${modalSeries.display || modalSeries.name} Real-time Monitoring`,
      yUnit: modalSeries.unit,
      maxPoints: 300,
      chartTimeRange: timeRange,
      showBaseline: false,
      markerMode: "all",           // แสดงจุดทั้งหมดใน Modal
      markerRadius: 2.2,          // ขนาดจุดเล็กกว่าใน Modal
      windowStart: ws,
      windowEnd: we
    });
  }, [modalOpen, modalSeries, timeRange, liveWindowMs, series]);

  // แสดง skeleton loading ถ้ากำลังโหลดและไม่มีข้อมูล
  if (gasLoading || (!isConnected && series.length === 0)) {
    return <GraphPageSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                Real-time Data Monitoring
              </h1>
              <p className="text-gray-600 text-sm">Live emission data visualization - Individual parameter charts</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm text-gray-600">{isConnected ? 'Connected' : 'Disconnected'}</span>
              </div>
              {lastUpdate && (
                <div className="text-sm text-gray-500">
                  Last Update: {lastUpdate.toLocaleTimeString('th-TH', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  })}
                </div>
              )}
                <button
                  onClick={() => setRunning((v) => !v)}
                className={`px-4 py-2 font-medium rounded-lg transition-colors ${
                    running 
                      ? 'bg-red-600 hover:bg-red-700 text-white' 
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                >
                  {running ? "Pause" : "Resume"}
                </button>
                <button
                  onClick={fetchData}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                >
                  Refresh
                </button>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          {/* Status Bar */}
          <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm font-medium text-gray-700">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              {lastUpdate && (
                <div className="text-sm text-gray-600">
                  Last Update: {lastUpdate.toLocaleTimeString('th-TH', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  })}
                </div>
              )}
            </div>
            <div className="text-sm text-gray-600">
              Total Data Points: {series.reduce((total, s) => total + s.data.length, 0)} | 
              Update Interval: {timeRange === "realtime" ? "5s" : "10s"} |
              Live Window: {liveWindowMs / 1000 / 60} min |
              Status: {running ? "Running" : "Paused"} |
              Mode: {timeRange === "realtime" ? "Live" : "Historical"}
            </div>
          </div>
          
          {/* Top Row - Stack and Time Range */}
          <div className="flex flex-wrap items-center gap-6 mb-4">
            {/* Stack Selector */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Stack:</label>
              <select
                value={selectedStack}
                onChange={(e) => setSelectedStack(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
              >
                <option value="stack1">Stack 1</option>
                <option value="stack2">Stack 2</option>
                <option value="stack3">Stack 3</option>
              </select>
            </div>

            {/* Time Range Selector */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Time Range:</label>
              <div className="flex bg-gray-100 rounded-lg p-1">
                {["realtime", "1h", "6h", "1d", "5d", "1m", "6m", "1y"].map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                      timeRange === range
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {range === "realtime" ? "Live" : 
                     range === "1h" ? "1 ชั่วโมง" :
                     range === "6h" ? "6 ชั่วโมง" :
                     range === "1d" ? "1 วัน" :
                     range === "5d" ? "5 วัน" :
                     range === "1m" ? "1 เดือน" :
                     range === "6m" ? "6 เดือน" :
                     range === "1y" ? "1 ปี" : range}
                  </button>
                ))}
              </div>
            </div>

            {/* Live Window Selector (แสดงเฉพาะเมื่อเป็น Live) */}
            {timeRange === "realtime" && (
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Live window:</label>
                <div className="flex bg-gray-100 rounded-lg p-1">
                  {[120_000, 300_000, 600_000, 1200_000].map(w => (
                    <button
                      key={w}
                      onClick={() => setLiveWindowMs(w)}
                      className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                        liveWindowMs === w 
                          ? 'bg-white text-blue-600 shadow-sm' 
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {w === 120_000 ? '2 นาที' : 
                       w === 300_000 ? '5 นาที' : 
                       w === 600_000 ? '10 นาที' : 
                       w === 1200_000 ? '20 นาที' : `${w/1000/60} นาที`}
                    </button>
                  ))}
                </div>
              </div>
            )}
            </div>

        </div>

        {/* Individual Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {series.map((s) => {
            const latest = s.data.at(-1);
            const previous = s.data.at(-2);
            const change = latest && previous ? latest.y - previous.y : 0;
            const changePercent = previous ? (change / previous.y) * 100 : 0;
            
            return (
              <div 
                key={s.name} 
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => openModal(s)}
              >
                {/* Chart Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ backgroundColor: s.color }}
                    ></div>
                    <h3 className="text-lg font-semibold text-gray-900">{s.display || s.name}</h3>
                    <span className="text-sm text-gray-500">({s.unit})</span>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900">
                      {latest ? latest.y.toFixed(1) : '-'}
                    </div>
                    <div className={`text-sm font-medium ${
                      change >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {change >= 0 ? '↗' : '↘'} {change >= 0 ? '+' : ''}{change.toFixed(1)} ({changePercent >= 0 ? '+' : ''}{changePercent.toFixed(1)}%)
                    </div>
                    <div className="text-xs text-gray-500">
                      {latest ? new Date(latest.t).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'No data'}
                    </div>
                  </div>
                </div>

                {/* Chart */}
                <div 
                  className="bg-slate-900 rounded-lg p-4 relative"
                  onMouseMove={(e) => handleMouseMove(e, s)}
                  onMouseLeave={handleMouseLeave}
                >
                  <div className="h-[300px] w-full">
                    <canvas 
                      ref={(el) => { canvasRefs.current[s.name] = el; }}
                      className="h-full w-full block rounded" 
                    />
                  </div>
                  <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
                    คลิกเพื่อขยาย
                  </div>
                  {/* Real-time indicator */}
                  {running && timeRange === "realtime" && (
                    <div className="absolute top-2 left-2 bg-green-500 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                      Live
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tooltip */}
      {tooltip.show && tooltip.data && (
        <div 
          className="fixed bg-gray-900 text-white px-3 py-2 rounded-lg shadow-lg text-sm z-40 pointer-events-none"
          style={{
            left: tooltip.x + 10,
            top: tooltip.y - 10,
            transform: 'translateY(-100%)'
          }}
        >
          <div className="font-semibold">{tooltip.data.name}</div>
          <div className="text-gray-300">
            <div>เวลา: {tooltip.data.time}</div>
            <div>ค่า: {tooltip.data.value.toFixed(2)} {tooltip.data.unit}</div>
          </div>
        </div>
      )}

      {/* Modal */}
      {modalOpen && modalSeries && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div 
                  className="w-4 h-4 rounded-full" 
                  style={{ backgroundColor: modalSeries.color }}
                ></div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {modalSeries.display || modalSeries.name} Real-time Monitoring
                </h2>
                <span className="text-lg text-gray-500">({modalSeries.unit})</span>
              </div>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              <div 
                className="bg-slate-900 rounded-lg p-4"
                onMouseMove={(e) => handleMouseMove(e, modalSeries)}
                onMouseLeave={handleMouseLeave}
              >
                <div className="h-[500px] w-full">
                  <canvas 
                    ref={modalCanvasRef}
                    className="modal-canvas h-full w-full block rounded" 
                  />
                </div>
              </div>
              
              {/* Modal Footer */}
              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  คลิกที่กราฟเพื่อดูรายละเอียดเพิ่มเติม
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">ค่าล่าสุด:</span> 
                    {modalSeries.data.length > 0 ? modalSeries.data[modalSeries.data.length - 1].y.toFixed(2) : "0.00"} {modalSeries.unit}
                  </div>
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">สถานะ:</span> 
                    <span className={isConnected ? "text-green-600" : "text-red-600"}>
                      {isConnected ? "Connected" : "Disconnected"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
