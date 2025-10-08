import { useState, useEffect, useCallback } from "react";
import { DataLogsPageSkeleton } from "../components/SkeletonLoader";
import { useGasSettings } from "../hooks/useGasSettings";

export default function DataLogs() {
  // -------- Gas Settings --------
  const { gasSettings, loading: gasLoading } = useGasSettings();
  
  // -------- State (trimmed + consolidated) --------
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [preview, setPreview] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [isSearchResult, setIsSearchResult] = useState(false);

  // Search controls (compact)
  const [searchScope, setSearchScope] = useState("all"); // 'all' | 'field'
  const [searchField, setSearchField] = useState("SO2"); // used when scope==='field'
  
  // อัปเดต searchField เมื่อ gas settings เปลี่ยน
  useEffect(() => {
    if (gasSettings.length > 0 && !gasSettings.find(gas => gas.key === searchField)) {
      const firstEnabledGas = gasSettings.find(gas => gas.enabled);
      if (firstEnabledGas) {
        setSearchField(firstEnabledGas.key);
      }
    }
  }, [gasSettings, searchField]);

  // Sorting (kept minimal)
  const [sortColumn, setSortColumn] = useState("Timestamp");
  const [sortDirection, setSortDirection] = useState("desc");
  
  // Notification popup state
  const [notification, setNotification] = useState({ show: false, message: "", type: "info" });
  
  // Download modal state
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadSettings, setDownloadSettings] = useState({
    fromDate: '',
    toDate: '',
    downloadAll: true,
    selectedColumns: [],
    fileFormat: 'csv'
  });

  const API = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000";

  // Show notification function
  const showNotification = (message, type = "info") => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification({ show: false, message: "", type: "info" });
    }, 3000);
  };

  // -------- Fetch latest (unchanged behavior) --------
  const fetchData = useCallback(async () => {
    // ไม่ดึงข้อมูลใหม่ถ้ากำลังแสดงผลการค้นหา
    if (isSearchResult) {
      return;
    }
    
    try {
      setIsLoading(true);
      
      // ใช้ Promise.race แทน AbortController เพื่อหลีกเลี่ยง AbortError
      const fetchPromise = fetch(`${API}/api/influxdb/data/aggregate/stack1?hours=6&interval=1m`);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 10000); // เพิ่มเป็น 10 วินาที
      });
      
      const response = await Promise.race([fetchPromise, timeoutPromise]);
      const result = await response.json();

      const toLocalTs = (iso) => {
        const date = new Date(iso);
        // ปัดวินาทีทิ้งให้เป็นนาทีตรง
        date.setSeconds(0, 0);
        return new Intl.DateTimeFormat('th-TH-u-ca-gregory', {
          year: 'numeric', 
          month: '2-digit', 
          day: '2-digit',
          hour: '2-digit', 
          minute: '2-digit',
          hour12: false, 
          timeZone: 'Asia/Bangkok'
        }).format(date).replace(
          /(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s*(\d{2}):(\d{2})/,
          "$3-$2-$1 $4:$5"
        );
      };

      // จัดรูปแบบตัวเลข: 0 -> "0", จำนวนเต็ม -> ไม่มี .00, ทศนิยม -> 2 ตำแหน่ง
      const formatValue = (v) => {
        const n = Number(v);
        if (!isFinite(n) || n === 0) return "0";
        return Number.isInteger(n) ? String(n) : n.toFixed(2);
      };
      
      if (result.success && result.data) {
        const toLocalTs = (iso) => {
          const date = new Date(iso);
          return date
            .toLocaleString("th-TH", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              timeZone: "Asia/Bangkok",
              hour12: false,
            })
            .replace(
              /(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s*(\d{2}):(\d{2}):(\d{2})/,
              "$3-$2-$1 $4:$5:$6"
            );
        };

        // สร้างคอลัมน์แบบ dynamic จาก gas settings
        const formatted = result.data.map((item) => {
          const row = { Timestamp: toLocalTs(item.timestamp) };
          gasSettings.filter(g => g.enabled).forEach(g => {
            const col = `${g.display} (${g.unit})`;
            row[col] = item[g.key] ? Number(item[g.key]).toFixed(2) : "0.00";
          });
          return row;
        });
        setPreview(formatted);
        setTotalRecords(result.count || formatted.length || 0);
        // ใช้เวลาจากข้อมูลจริง (ข้อมูลล่าสุด)
        const latestTimestamp = formatted.length > 0 ? formatted[0].timestamp : null;
        setLastUpdate(latestTimestamp ? new Date(latestTimestamp) : new Date());
        // ไม่เปลี่ยน isSearchResult ถ้ากำลังแสดงผลการค้นหา
        if (!isSearchResult) {
          setIsSearchResult(false); // ข้อมูล 6 ชม.ล่าสุด
        }
      } else {
        // If no data, keep it simple: empty preview
        setPreview([]);
        setTotalRecords(0);
      }
    } catch (e) {
      console.error("Failed to fetch data", e);
      // แสดงข้อความแจ้งเตือนเมื่อเกิด error
      if (e.message.includes('timeout')) {
        showNotification("การเชื่อมต่อช้า กรุณาลองใหม่อีกครั้ง", "error");
      } else {
        showNotification("เกิดข้อผิดพลาดในการโหลดข้อมูล", "error");
      }
    } finally {
      setIsLoading(false);
    }
  }, [API, gasSettings, isSearchResult]);

  useEffect(() => {
    fetchData();
    // ไม่ทำ polling เมื่ออยู่ในโหมดค้นหา
    if (!isSearchResult) {
      const id = setInterval(fetchData, 60000);
      return () => clearInterval(id);
    }
  }, [fetchData, isSearchResult]);

  // --------- Backend search (compact API usage) ---------
  const searchInDatabase = useCallback(async () => {
    setIsLoading(true);
    try {
      // ถ้าไม่มีการค้นหาและไม่มีการเลือกคอลัมน์เฉพาะและไม่มีการเลือกวันที่ ให้แสดงข้อมูล 100 รายการล่าสุด
      if (!searchTerm && !from && !to && searchScope === "all") {
        const res = await fetch(`${API}/api/data/range?limit=100`);
        const result = await res.json();
        
        if (result.success && result.data) {
          const toLocalTs = (iso) => {
            const date = new Date(iso);
            return date
              .toLocaleString("th-TH", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                timeZone: "Asia/Bangkok",
                hour12: false,
              })
              .replace(
                /(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s*(\d{2}):(\d{2}):(\d{2})/,
                "$3-$2-$1 $4:$5:$6"
              );
          };

          // สร้างคอลัมน์แบบ dynamic จาก gas settings
          const formatted = result.data.map((item) => {
            const row = {
              Timestamp: toLocalTs(item.timestamp)
            };
            
            // เพิ่มคอลัมน์ตาม gas settings ที่ enabled
            gasSettings.filter(gas => gas.enabled).forEach(gas => {
              const columnName = `${gas.display} (${gas.unit})`;
              row[columnName] = item[gas.key] ? Number(item[gas.key]).toFixed(2) : "0.00";
            });
            
            return row;
          });
          setPreview(formatted);
          setTotalRecords(result.count || formatted.length || 0);
          // ใช้เวลาจากข้อมูลจริง (ข้อมูลล่าสุด)
          const latestTimestamp = formatted.length > 0 ? formatted[0].timestamp : null;
          setLastUpdate(latestTimestamp ? new Date(latestTimestamp) : new Date());
          setIsSearchResult(false); // ข้อมูล 100 รายการล่าสุด
          showNotification(`แสดงข้อมูล ${formatted.length} รายการล่าสุด`, "success");
          return;
        }
      }

      // การค้นหาปกติ
      const params = new URLSearchParams();
      if (from) {
        // เพิ่มเวลาเริ่มต้นของวัน (00:00:00) และ timezone UTC+7
        const fromDate = new Date(from + 'T00:00:00+07:00');
        params.append("from_date", fromDate.toISOString());
      }
      if (to) {
        // เพิ่มเวลาสิ้นสุดของวัน (23:59:59) และ timezone UTC+7
        const toDate = new Date(to + 'T23:59:59+07:00');
        params.append("to_date", toDate.toISOString());
      }

      if (searchScope === "all") {
        // ค้นหาทุกคอลัมน์ - แสดงข้อมูลทั้งหมด
        params.append("search_column", "all");
        params.append("search_value", "");
      } else if (searchScope === "field") {
        // เลือกคอลัมน์เฉพาะ - แสดงข้อมูลทั้งหมดในคอลัมน์นั้น
        params.append("search_column", searchField);
        params.append("search_value", "");
      }

      console.log("Search params:", params.toString());
      const res = await fetch(`${API}/api/data/search?${params}`);
      const result = await res.json();
      console.log("Search result:", result);

      const toLocalTs = (iso) => {
        const date = new Date(iso);
        return date
          .toLocaleString("th-TH", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            timeZone: "Asia/Bangkok",
            hour12: false,
          })
          .replace(
            /(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s*(\d{2}):(\d{2}):(\d{2})/,
            "$3-$2-$1 $4:$5:$6"
          );
      };

      if (result.success && result.data) {
        // สร้างคอลัมน์แบบ dynamic จาก gas settings
        const formatted = result.data.map((item) => {
          const row = {
            Timestamp: toLocalTs(item.timestamp)
          };
          
          // เพิ่มคอลัมน์ตาม gas settings ที่ enabled
          gasSettings.filter(gas => gas.enabled).forEach(gas => {
            const columnName = `${gas.display} (${gas.unit})`;
            row[columnName] = item[gas.key] ? Number(item[gas.key]).toFixed(2) : "0.00";
          });
          
          return row;
        });
        setPreview(formatted);
        setTotalRecords(result.count || formatted.length || 0);
        // ใช้เวลาจากข้อมูลจริง (ข้อมูลล่าสุด)
        const latestTimestamp = formatted.length > 0 ? formatted[0].timestamp : null;
        setLastUpdate(latestTimestamp ? new Date(latestTimestamp) : new Date());
        setIsSearchResult(true); // ผลการค้นหา
        
        // แสดงข้อความแจ้งเตือนผลการค้นหา
        if (searchScope === "all") {
          showNotification(`แสดงข้อมูล ${formatted.length} รายการ ทั้งหมด`, "success");
        } else if (searchScope === "field") {
          showNotification(`แสดงข้อมูล ${formatted.length} รายการ ในคอลัมน์ ${searchField}`, "success");
        } else if (from || to) {
          const dateRange = from && to ? `${from} ถึง ${to}` : from ? `ตั้งแต่ ${from}` : `จนถึง ${to}`;
          showNotification(`แสดงข้อมูล ${formatted.length} รายการ ในช่วงวันที่ ${dateRange}`, "success");
      } else {
          showNotification(`แสดงข้อมูล ${formatted.length} รายการล่าสุด`, "success");
        }
      }
    } catch (err) {
      console.error("Failed to search in database:", err);
      showNotification("เกิดข้อผิดพลาดในการค้นหาใน Database", "error");
    } finally {
      setIsLoading(false);
    }
  }, [from, to, searchScope, searchField, API, gasSettings]);

  // ------- Sorting (simple client-side visual sort) -------
  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const sortedPreview = (() => {
    if (!preview.length) return preview;
    let rows = [...preview];
    
    // ถ้าเลือกคอลัมน์เฉพาะ ให้กรองข้อมูลตามคอลัมน์นั้น
    if (searchScope === "field" && searchField) {
      const gas = gasSettings.find(g => g.key === searchField);
      if (gas) {
        const columnKey = `${gas.display} (${gas.unit})`;
        rows = rows.filter(row => row[columnKey] !== null && row[columnKey] !== undefined && row[columnKey] !== '');
      }
    }
    
    const asc = sortDirection === "asc";
    rows.sort((a, b) => {
      const va = a[sortColumn];
      const vb = b[sortColumn];
      // Timestamp string YYYY-MM-DD HH:mm:ss sorts lexicographically
      if (typeof va === "number" && typeof vb === "number") {
        return asc ? va - vb : vb - va;
      }
      return asc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
    return rows;
  })();

  // -------- Download Functions --------
  const handleDownload = async () => {
    try {
      setIsLoading(true);
      
      // สร้าง parameters สำหรับ API
      const params = new URLSearchParams();
      
      if (downloadSettings.fromDate) {
        const fromDate = new Date(downloadSettings.fromDate + 'T00:00:00+07:00');
        params.append("from_date", fromDate.toISOString());
      }
      
      if (downloadSettings.toDate) {
        const toDate = new Date(downloadSettings.toDate + 'T23:59:59+07:00');
        params.append("to_date", toDate.toISOString());
      }
      
      // เพิ่มข้อมูลคอลัมน์
      if (!downloadSettings.downloadAll && downloadSettings.selectedColumns.length > 0) {
        params.append("columns", downloadSettings.selectedColumns.join(","));
      }
      
      // เพิ่มรูปแบบไฟล์
      params.append("format", downloadSettings.fileFormat);
      
      // เรียก API
      const response = await fetch(`${API}/api/data/download?${params}`);
      const result = await response.json();
      
      console.log('Download response:', result);
      console.log('Response success:', result.success);
      console.log('Data length:', result.data ? result.data.length : 'No data');
      console.log('Filename:', result.filename);
      
      if (result.success) {
        // Handle different file formats
        let blob;
        
        if (downloadSettings.fileFormat === 'pdf') {
          // Decode base64 for PDF
          const binaryString = atob(result.data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          blob = new Blob([bytes], { type: 'application/pdf' });
        } else {
          // CSV format (text)
          blob = new Blob([result.data], { type: 'text/csv' });
        }
        
        // สร้างลิงก์ดาวน์โหลด
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = result.filename || `cems-data.${downloadSettings.fileFormat}`;
        link.style.display = 'none';
        
        // Add to DOM and trigger click
        document.body.appendChild(link);
        
        // Try multiple approaches
        try {
          link.click();
          console.log('Link clicked successfully');
        } catch (error) {
          console.error('Click failed:', error);
          // Fallback: open in new window
          window.open(url, '_blank');
        }
        
        // Cleanup
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }, 1000);
        
        showNotification('ดาวน์โหลดสำเร็จ!', 'success');
        setShowDownloadModal(false);
      } else {
        showNotification(result.message || 'เกิดข้อผิดพลาดในการดาวน์โหลด', 'error');
      }
      
    } catch (error) {
      console.error('Download failed:', error);
      showNotification('เกิดข้อผิดพลาดในการดาวน์โหลด', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const clearAll = () => {
    setFrom("");
    setTo("");
    setSearchScope("all");
    setSearchField("SO2");
    setSearchTerm("");
    setIsSearchResult(false); // รีเซ็ตเป็นข้อมูล 6 ชม.ล่าสุด
  };

  // -------- UI (compact) --------
  // แสดง skeleton loading ถ้ากำลังโหลด
  if ((isLoading && preview.length === 0) || gasLoading) {
    return <DataLogsPageSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Toolbar */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="flex flex-col gap-4">
            {/* Filters Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Date Range - Full width on mobile, half on tablet, third on desktop */}
              <div className="md:col-span-2 lg:col-span-1">
                <label className="text-xs font-medium text-slate-600 mb-1">ช่วงวันที่</label>
                <div className="flex flex-col sm:flex-row gap-2">
              <input
                    type="date"
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
                  <span className="flex items-center justify-center text-slate-500 text-sm">ถึง</span>
              <input
                    type="date"
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
                  {(from || to) && (
                    <button
                      type="button"
                      className="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg text-sm font-medium"
                      onClick={() => {
                        setFrom('');
                        setTo('');
                      }}
                      title="ล้างช่วงวันที่"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Search Mode */}
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1">โหมดการค้นหา</label>
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={searchScope}
                  onChange={(e) => setSearchScope(e.target.value)}
                >
                  <option value="all">ค้นหาทุกคอลัมน์</option>
                  <option value="field">ค้นหาเฉพาะคอลัมน์</option>
                </select>
              </div>

              {/* Column Selection - Only show when field search is selected */}
              {searchScope === "field" && (
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1">คอลัมน์</label>
                  <select
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    value={searchField}
                    onChange={(e) => setSearchField(e.target.value)}
                  >
                    {gasSettings.filter(gas => gas.enabled).map((gas) => (
                      <option key={gas.key} value={gas.key}>
                        {gas.display}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Search Term and Actions Row */}
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={searchInDatabase}
                  disabled={isLoading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm"
                  title="ค้นหาในฐานข้อมูล"
                >
                  {isLoading ? "ค้นหา..." : "ค้นหา"}
                </button>
              <button
                onClick={fetchData}
                disabled={isLoading}
                  className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg font-medium text-sm"
                  title="โหลดข้อมูลล่าสุด"
              >
                  รีเฟรช
              </button>
              <button
                  onClick={clearAll}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-medium border text-sm"
                  title="ล้างตัวกรอง"
                >
                  ล้าง
              </button>
            </div>
          </div>
        </div>

          {/* Tiny Export row (uses same from/to) */}
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-3">
              <span className="font-medium">บันทึกทั้งหมด:</span>
              <span className="font-semibold text-slate-800">{totalRecords}</span>
              {lastUpdate && (
                <span className="ml-4">
                  {isSearchResult ? "อัปเดตข้อมูลที่ค้นหา" : "อัปเดต 6 ชม.ล่าสุด"}: {lastUpdate.toLocaleString("th-TH")}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowDownloadModal(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-sm"
                title="ดาวน์โหลดข้อมูล"
              >
                ดาวน์โหลด
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <div className="max-h-[65vh] overflow-auto border border-slate-200 rounded-lg">
            <table className="min-w-[900px] w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                <tr>
                  {(() => {
                    const allColumns = Object.keys(sortedPreview[0] || {});
                    // ถ้าเลือกคอลัมน์เฉพาะ ให้แสดงเฉพาะคอลัมน์นั้น + Timestamp
                    if (searchScope === "field" && searchField) {
                      const gas = gasSettings.find(g => g.key === searchField);
                      if (gas) {
                        const columnKey = `${gas.display} (${gas.unit})`;
                        return allColumns.filter(col => col === 'Timestamp' || col === columnKey);
                      }
                    }
                    return allColumns;
                  })().map((h) => (
                    <th
                      key={h}
                      onClick={() => handleSort(h)}
                      className={`px-4 py-3 text-left text-xs font-bold uppercase tracking-wider cursor-pointer select-none ${
                        sortColumn === h ? "bg-emerald-50" : ""
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span>{h}</span>
                        {sortColumn === h && (
                          <svg
                            className={`w-3 h-3 ${sortDirection === "asc" ? "rotate-180" : ""}`}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {sortedPreview.map((row, i) => (
                  <tr
                    key={i}
                    className={`${i % 2 === 0 ? "bg-white" : "bg-slate-50"}`}
                  >
                    {(() => {
                      const allColumns = Object.keys(sortedPreview[0] || {});
                      // ถ้าเลือกคอลัมน์เฉพาะ ให้แสดงเฉพาะคอลัมน์นั้น + Timestamp
                      if (searchScope === "field" && searchField) {
                        const gas = gasSettings.find(g => g.key === searchField);
                        if (gas) {
                          const columnKey = `${gas.display} (${gas.unit})`;
                          return allColumns.filter(col => col === 'Timestamp' || col === columnKey);
                        }
                      }
                      return allColumns;
                    })().map((h) => (
                      <td
                        key={h}
                        className={`px-4 py-3 tabular-nums whitespace-nowrap ${
                          h === "Timestamp" ? "text-slate-600 font-semibold" : "text-slate-700"
                        }`}
                      >
                        {h === "Timestamp" ? row[h] : row[h] === 0 ? "0" : row[h]}
                      </td>
                    ))}
                  </tr>
                ))}
                {!sortedPreview.length && (
                  <tr>
                    <td className="px-4 py-6 text-center text-slate-500" colSpan={(() => {
                      const allColumns = Object.keys(sortedPreview[0] || {});
                      if (searchScope === "field" && searchField) {
                        const gas = gasSettings.find(g => g.key === searchField);
                        if (gas) {
                          const columnKey = `${gas.display} (${gas.unit})`;
                          return allColumns.filter(col => col === 'Timestamp' || col === columnKey).length;
                        }
                      }
                      return allColumns.length;
                    })()}>
                      ไม่มีข้อมูลที่จะแสดง
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Notification Popup */}
      {notification.show && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in">
          <div className={`rounded-lg shadow-lg border p-4 max-w-sm ${
            notification.type === "success" 
              ? "bg-green-50 border-green-200 text-green-800" 
              : notification.type === "error"
              ? "bg-red-50 border-red-200 text-red-800"
              : "bg-blue-50 border-blue-200 text-blue-800"
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${
                notification.type === "success" 
                  ? "bg-green-500" 
                  : notification.type === "error"
                  ? "bg-red-500"
                  : "bg-blue-500"
              }`}></div>
              <span className="text-sm font-medium">{notification.message}</span>
              <button
                onClick={() => setNotification({ show: false, message: "", type: "info" })}
                className="ml-auto text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Download Modal */}
      {showDownloadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-slate-800">ดาวน์โหลดข้อมูล</h3>
                <button
                  onClick={() => setShowDownloadModal(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                {/* Date Range */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">ช่วงวันที่</label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2"
                      value={downloadSettings.fromDate}
                      onChange={(e) => setDownloadSettings(prev => ({ ...prev, fromDate: e.target.value }))}
                    />
                    <span className="flex items-center text-slate-500 text-sm">ถึง</span>
                    <input
                      type="date"
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2"
                      value={downloadSettings.toDate}
                      onChange={(e) => setDownloadSettings(prev => ({ ...prev, toDate: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Download Options */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">ข้อมูลที่ต้องการ</label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="downloadType"
                        checked={downloadSettings.downloadAll}
                        onChange={() => setDownloadSettings(prev => ({ ...prev, downloadAll: true }))}
                        className="mr-2"
                      />
                      <span className="text-sm">โหลดทั้งหมด</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="downloadType"
                        checked={!downloadSettings.downloadAll}
                        onChange={() => setDownloadSettings(prev => ({ ...prev, downloadAll: false }))}
                        className="mr-2"
                      />
                      <span className="text-sm">โหลดเฉพาะคอลัมน์</span>
                    </label>
                  </div>
                </div>

                {/* Column Selection */}
                {!downloadSettings.downloadAll && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">เลือกคอลัมน์</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['SO2', 'NOx', 'O2', 'CO', 'Dust', 'Temperature', 'Velocity', 'Flowrate', 'Pressure'].map(col => (
                        <label key={col} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={downloadSettings.selectedColumns.includes(col)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setDownloadSettings(prev => ({ 
                                  ...prev, 
                                  selectedColumns: [...prev.selectedColumns, col] 
                                }));
                              } else {
                                setDownloadSettings(prev => ({ 
                                  ...prev, 
                                  selectedColumns: prev.selectedColumns.filter(c => c !== col) 
                                }));
                              }
                            }}
                            className="mr-2"
                          />
                          <span className="text-sm">{col}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* File Format */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">รูปแบบไฟล์</label>
                  <div className="flex gap-2">
                    {[
                      { value: 'csv', label: 'CSV' },
                      { value: 'pdf', label: 'PDF' }
                    ].map(format => (
                      <label key={format.value} className="flex items-center">
                        <input
                          type="radio"
                          name="fileFormat"
                          value={format.value}
                          checked={downloadSettings.fileFormat === format.value}
                          onChange={(e) => setDownloadSettings(prev => ({ ...prev, fileFormat: e.target.value }))}
                          className="mr-1"
                        />
                        <span className="text-sm">{format.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowDownloadModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-medium text-sm"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleDownload}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-sm disabled:opacity-50"
                >
                  {isLoading ? 'กำลังดาวน์โหลด...' : 'ดาวน์โหลด'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
