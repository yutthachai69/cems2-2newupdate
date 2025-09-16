// src/pages/Graph.jsx
import { useEffect, useRef, useState, useCallback } from "react";

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
  const trimmed = series.map(s => {
    const raw = (s.data || []).filter(p =>
      (!windowStart || p.t >= windowStart) &&
      (!windowEnd   || p.t <= windowEnd)
    );
    return {
      ...s,
      data: raw.slice(-maxPoints).filter(p => p && p.t && Number.isFinite(p.y))
    };
  });

  const allTimes = trimmed.flatMap(s => s.data.map(p => p.t));
  if (allTimes.length === 0) {
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
    if (pts.length === 0) {
      return;
    }

    // พื้นที่ + เส้น วาดเฉพาะถ้ามีอย่างน้อย 2 จุด
    if (pts.length >= 2) {
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

export default function Graph() {
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
  const [liveWindowMs, setLiveWindowMs] = useState(5 * 60 * 1000); // 5 นาทีเริ่มต้น
  
  const prevRangeRef = useRef(timeRange);
  const lastTsRef = useRef({});
  const fetchingRef = useRef(false);
  const modalCanvasRef = useRef(null);
  
  const [series, setSeries] = useState([
    { name: "SO2", unit: "ppm", data: [], color: "#10b981" },
    { name: "NOx", unit: "ppm", data: [], color: "#3b82f6" },
    { name: "O2", unit: "%", data: [], color: "#eab308" },
    { name: "CO", unit: "ppm", data: [], color: "#f59e0b" },
    { name: "Dust", unit: "mg/m³", data: [], color: "#ef4444" },
    { name: "Temperature", unit: "°C", data: [], color: "#f97316" },
    { name: "Velocity", unit: "m/s", data: [], color: "#8b5cf6" },
    { name: "Flowrate", unit: "m³/h", data: [], color: "#06b6d4" },
    { name: "Pressure", unit: "Pa", data: [], color: "#ec4899" },
  ]);

  const API = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000";
  
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

    // เก็บข้อมูลเก่าไว้มากขึ้น - เพิ่ม buffer สำหรับการแสดงผล
    const bufferPoints = Math.max(50, Math.floor(maxPoints * 0.3)); // เก็บข้อมูลเก่าเพิ่ม 30% หรืออย่างน้อย 50 จุด
    if (pruned.length > maxPoints) {
      // เก็บข้อมูลเก่าไว้มากขึ้นโดยการ slice จากจุดที่เก่ากว่า
      const keepOldData = Math.max(bufferPoints, Math.floor(maxPoints * 0.4));
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
            // ดึงข้อมูลย้อนหลังตาม liveWindowMs จาก SQLite
            const windowAgo = new Date(Date.now() - liveWindowMs);
            const historicalResponse = await fetch(`${API}/api/sqlite/data/range?start_date=${windowAgo.toISOString()}&end_date=${new Date().toISOString()}&limit=10000`);
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
          const sampleMs = 5000; // 5 วินาที
          const maxPtsInWindow = Math.ceil(liveWindowMs / sampleMs) + 20;

          // อัปเดตข้อมูลแต่ละ series (เพิ่มจุดใหม่)
          setSeries(prev => prev.map(s => {
            let value = 0;
            
            // ดึงค่าจากข้อมูลที่ได้รับ หรือใช้ Mock data ถ้าไม่มีข้อมูลจริง
            if (stackData.data && Object.keys(stackData.data).length > 0) {
              switch(s.name) {
                case "SO2": value = stackData.data.SO2 ?? 0; break;
                case "NOx": value = stackData.data.NOx ?? 0; break;
                case "O2": value = stackData.data.O2 ?? 0; break;
                case "CO": value = stackData.data.CO ?? 0; break;
                case "Dust": value = stackData.data.Dust ?? 0; break;
                case "Temperature": value = stackData.data.Temperature ?? 0; break;
                case "Velocity": value = stackData.data.Velocity ?? 0; break;
                case "Flowrate": value = stackData.data.Flowrate ?? 0; break;
                case "Pressure": value = stackData.data.Pressure ?? 0; break;
                default: value = 0;
              }
            } else {
              // Mock data สำหรับทดสอบกราฟ
              const mockValues = {
                "SO2": 5.0 + Math.sin(now / 10000) * 2,
                "NOx": 3.0 + Math.cos(now / 15000) * 1.5,
                "O2": 8.0 + Math.sin(now / 20000) * 1,
                "CO": 2.0 + Math.cos(now / 12000) * 0.8,
                "Dust": 1.5 + Math.sin(now / 18000) * 0.5,
                "Temperature": 25.0 + Math.sin(now / 25000) * 3,
                "Velocity": 12.0 + Math.cos(now / 16000) * 2,
                "Flowrate": 1000.0 + Math.sin(now / 22000) * 100,
                "Pressure": -50.0 + Math.cos(now / 14000) * 10
              };
              value = mockValues[s.name] || 0;
            }

            const ts = stackData.timestamp
              ? new Date(stackData.timestamp).getTime()
              : now; // ใช้ now ที่ประกาศไว้ด้านบน ให้ทุกซีรีส์อ้างอิงเวลาเดียวกัน

            // ตรวจสอบว่าข้อมูลใหม่หรือไม่ (เว้นช่วงรับข้อมูลอย่างน้อย 5 วินาที)
            const lastPoint = s.data[s.data.length - 1];
            const minStepMs = 5000; // 5 วินาที
            
            if (lastPoint) {
              // ข้ามถ้าเวลาและค่าเหมือนเดิม
              if (lastPoint.t === ts && lastPoint.y === Number(value)) {
                return s;
              }
              // ข้ามถ้าข้อมูลถี่เกินไป (น้อยกว่า 5 วินาที)
              if ((ts - lastPoint.t) < minStepMs) {
                return s;
              }
            }
            lastTsRef.current[s.name] = ts;

            // เพิ่มจุดใหม่เข้าไปในข้อมูลเก่า (เก็บข้อมูลเก่าไว้)
            const next = [...s.data, { t: ts, y: Number(value) || 0 }];
            
            // จำกัดเฉพาะหน้าต่าง live + บีบจำนวนจุด (แต่เก็บข้อมูลเก่าไว้)
            const windowed = pruneWindow(next, now, liveWindowMs, maxPtsInWindow);

            // กันโตแบบสะสมระยะยาว (เผื่อ live นาน ๆ) - แต่เก็บข้อมูลเก่าไว้มากขึ้น
            const cap = 10000; // ลด cap เป็น 10000 จุดเพื่อประหยัด memory
            const compacted = windowed.length > cap ? windowed.slice(-Math.floor(cap * 0.8)) : windowed; // เก็บข้อมูลเก่าไว้ 80%


            return { ...s, data: compacted };
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
        // โหมด Historical: ดึงข้อมูลจาก SQLite
        let startDate = null;
        
        switch(timeRange) {
          case "1h":
            // ใช้ข้อมูลจาก 2025-09-12 (ข้อมูลที่มีใน DB)
            startDate = new Date("2025-09-12T00:00:00.000Z");
            break;
          case "6h":
            // ใช้ข้อมูลจาก 2025-09-12 (ข้อมูลที่มีใน DB)
            startDate = new Date("2025-09-12T00:00:00.000Z");
            break;
          case "1d":
            // ใช้ข้อมูลจาก 2025-09-12 (ข้อมูลที่มีใน DB)
            startDate = new Date("2025-09-12T00:00:00.000Z");
            break;
          case "5d":
            // ใช้ข้อมูลจาก 2025-09-12 (ข้อมูลที่มีใน DB)
            startDate = new Date("2025-09-12T00:00:00.000Z");
            break;
          case "1m":
            // ใช้ข้อมูลจาก 2025-09-12 (ข้อมูลที่มีใน DB)
            startDate = new Date("2025-09-12T00:00:00.000Z");
            break;
          case "6m":
            // ใช้ข้อมูลจาก 2025-09-12 (ข้อมูลที่มีใน DB)
            startDate = new Date("2025-09-12T00:00:00.000Z");
            break;
          case "1y":
            // ใช้ข้อมูลจาก 2025-09-12 (ข้อมูลที่มีใน DB)
            startDate = new Date("2025-09-12T00:00:00.000Z");
            break;
          default:
            startDate = null;
        }
        
        // กำหนด endDate เป็นวันที่ข้อมูลใน DB (2025-09-12)
        const endDate = new Date("2025-09-12T23:59:59.999Z");
        
        let url = `${API}/api/sqlite/data/range?limit=50000`; // เพิ่ม limit เป็น 50000
        if (startDate) {
          url += `&start_date=${startDate.toISOString()}`;
        }
        url += `&end_date=${endDate.toISOString()}`;
        
        response = await fetch(url);
        result = await response.json();
        
      }
      
      if (result.success && result.data && Array.isArray(result.data) && result.data.length > 0) {
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
            switch(s.name) {
              case "SO2": value = d.SO2; break;
              case "NOx": value = d.NOx; break;
              case "O2": value = d.O2; break;
              case "CO": value = d.CO; break;
              case "Dust": value = d.Dust; break;
              case "Temperature": value = d.Temperature; break;
              case "Velocity": value = d.Velocity; break;
              case "Flowrate": value = d.Flowrate; break;
              case "Pressure": value = d.Pressure; break;
              default: value = 0;
            }
            
            return { 
              t: d.timestamp, 
              y: Number(value) || 0  // กัน NaN/undefined
            };
          }).filter(d => 
            d.t && 
            Number.isFinite(d.t) && 
            Number.isFinite(d.y)
          );
          
          // รวมข้อมูลเก่ากับข้อมูลใหม่ (เก็บข้อมูลเก่าไว้)
          const existingData = s.data || [];
          const combinedData = [...existingData, ...seriesData];
          
          // ลบข้อมูลซ้ำ (ถ้ามี)
          const uniqueData = combinedData.filter((item, index, self) => 
            index === self.findIndex(t => t.t === item.t)
          );
          
          // เรียงลำดับตามเวลา
          const sortedData = uniqueData.sort((a, b) => a.t - b.t);
          
          return {
            ...s,
            data: sortedData
          };
        }));
        
        // สำหรับ historical data ให้แสดงเป็น connected เสมอ
        setIsConnected(true);
        setLastUpdate(new Date());
      } else {
        setIsConnected(false);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
      setIsConnected(false);
      // แสดงข้อความ error ให้ผู้ใช้ทราบ
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        console.warn("Network error - check API connection");
      }
    } finally {
      fetchingRef.current = false;
    }
  }, [selectedStack, timeRange, liveWindowMs, isFirstLiveLoad, API]);

  // ดึงข้อมูลเริ่มต้น
  useEffect(() => {
    // รีเซ็ตก็ต่อเมื่อเพิ่ง "สลับ" มา realtime เท่านั้น
    if (timeRange === "realtime" && prevRangeRef.current !== "realtime") {
      // ไม่ล้างข้อมูลทันที แต่ให้ fetchData ดึงข้อมูลย้อนหลังก่อน
      setIsFirstLiveLoad(true); // ตั้งค่าให้เป็นครั้งแรก
    }
    prevRangeRef.current = timeRange;
    fetchData();
  }, [selectedStack, timeRange, fetchData]);

  // อัพเดทข้อมูลเรียลไทม์ (ทุกโหมด) - อัปเดตทุก 5 วินาที
  useEffect(() => {
    if (!running) return;
    const interval = timeRange === "realtime" ? 5000 : 10000; // อัปเดตทุก 5 วินาทีสำหรับ realtime, 10 วินาทีสำหรับ historical
    const id = setInterval(fetchData, interval);
    return () => clearInterval(id);
  }, [running, selectedStack, timeRange, liveWindowMs, fetchData]);

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
        // baselineValue: 3620554.57  // ตัวอย่าง: ค่าปิดก่อนหน้า (ถ้าต้องการเส้นประเทียบ)
      });
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

  // วาดกราฟใน Modal เมื่อเปิด
  useEffect(() => {
    if (!modalOpen || !modalSeries) return;
    const modalCanvas = modalCanvasRef.current;
    if (!modalCanvas) return;

    const lastT = modalSeries.data?.at(-1)?.t ?? Date.now();
    const ws = timeRange === "realtime" ? lastT - liveWindowMs : null;
    const we = timeRange === "realtime" ? lastT : null;

    drawRealtimeChart(modalCanvas, [modalSeries], {
      title: `${modalSeries.name} Real-time Monitoring`,
      yUnit: modalSeries.unit,
      maxPoints: 300,
      chartTimeRange: timeRange,
      showBaseline: false,
      markerMode: "all",           // แสดงจุดทั้งหมดใน Modal
      markerRadius: 2.2,          // ขนาดจุดเล็กกว่าใน Modal
      windowStart: ws,
      windowEnd: we
    });
  }, [modalOpen, modalSeries, timeRange, liveWindowMs]);

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

          {/* Bottom Row - Legend */}
          <div className="flex flex-wrap items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Parameters:</label>
            <div className="flex flex-wrap items-center gap-3">
            {series.map((s) => (
              <div key={s.name} className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full flex-shrink-0" 
                  style={{ backgroundColor: s.color }}
                ></div>
                <span className="text-sm text-gray-600 whitespace-nowrap">{s.name}</span>
              </div>
            ))}
            </div>
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
                    <h3 className="text-lg font-semibold text-gray-900">{s.name}</h3>
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
                  {modalSeries.name} Real-time Monitoring
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
