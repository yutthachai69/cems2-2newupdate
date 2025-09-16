import { useState } from "react";

const API = import.meta.env.VITE_BACKEND_URL || "http://127.0.0.1:8000";

function Field({ label, value, onChange, suffix, description, min = 0, max = 9999 }) {
  return (
    <div className="space-y-2">
      <label className="flex items-center justify-between">
        <div>
          <span className="text-sm font-medium text-gray-700">{label}</span>
          {description && (
            <p className="text-xs text-gray-500 mt-1">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={min}
            max={max}
            className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
            value={value}
            onChange={(e) => onChange(Number(e.target.value) || 0)}
          />
          <span className="text-sm text-gray-500 min-w-[40px]">{suffix}</span>
        </div>
      </label>
    </div>
  );
}

export default function Blowback() {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    every: 30,
    period: 5,
    hold: 10,
    pulseOn: 2,
    pulseOff: 3,
  });

  const set = (k) => (v) => setForm((s) => ({ ...s, [k]: v }));

  const triggerManual = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API}/api/blowback/manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      if (!res.ok) throw new Error(await res.text());
      alert("ส่งคำสั่ง Blowback แล้ว");
    } catch (e) {
      console.error(e);
      alert("ส่งคำสั่งไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    // ไม่ให้ค่าติดลบ (0 อนุญาต)
    if (
      form.every < 0 ||
      form.period < 0 ||
      form.hold < 0 ||
      form.pulseOn < 0 ||
      form.pulseOff < 0
    ) {
      alert("ค่าต้องไม่ติดลบ");
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`${API}/api/blowback/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: true,
          interval_minutes: form.every,
          duration_seconds: form.period,
          pressure_threshold: 100.0,
          auto_mode: true
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      alert("บันทึกการตั้งค่า Blowback แล้ว");
    } catch (e) {
      console.error(e);
      alert("บันทึกการตั้งค่าไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                Blowback System Control
              </h1>
              <p className="text-gray-600 text-sm">Manual control and automatic settings for blowback operation</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-sm text-gray-500">Status</div>
                <div className="text-sm font-medium text-green-600">Active</div>
              </div>
              <button
                onClick={triggerManual}
                disabled={loading}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Processing..." : "Manual Blowback"}
              </button>
            </div>
          </div>
        </div>

        {/* Manual Control */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Manual Control</h2>
            <p className="text-gray-600 text-sm">Trigger blowback operation manually for immediate cleaning</p>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <div>
                  <div className="text-sm font-medium text-blue-900">Manual Blowback Ready</div>
                  <div className="text-xs text-blue-700">Click button to start immediate blowback cycle</div>
                </div>
              </div>
              <button
                onClick={triggerManual}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Processing..." : "Start Blowback"}
              </button>
            </div>
          </div>
        </div>

        {/* Settings */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Automatic Settings</h2>
            <p className="text-gray-600 text-sm">Configure automatic blowback operation parameters</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <Field 
                label="Blowback Every" 
                value={form.every} 
                onChange={set("every")} 
                suffix="Min." 
                description="Interval between automatic blowback cycles"
                min={1}
                max={1440}
              />
              <Field 
                label="Period" 
                value={form.period} 
                onChange={set("period")} 
                suffix="Min." 
                description="Duration of each blowback cycle"
                min={1}
                max={60}
              />
              <Field 
                label="Hold Value" 
                value={form.hold} 
                onChange={set("hold")} 
                suffix="Sec." 
                description="Time to hold pressure during blowback"
                min={1}
                max={300}
              />
            </div>
            
            <div className="space-y-4">
              <Field 
                label="Pulse ON" 
                value={form.pulseOn} 
                onChange={set("pulseOn")} 
                suffix="Sec." 
                description="Duration of pulse activation"
                min={1}
                max={60}
              />
              <Field 
                label="Pulse OFF" 
                value={form.pulseOff} 
                onChange={set("pulseOff")} 
                suffix="Sec." 
                description="Duration between pulses"
                min={1}
                max={60}
              />
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                <span className="font-medium">Next Auto Blowback:</span> In {form.every} minutes
              </div>
              <button
                onClick={saveSettings}
                disabled={loading}
                className="px-6 py-2 bg-gray-800 hover:bg-gray-900 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </div>
        </div>

        {/* Status Information */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">System Status</h2>
            <p className="text-gray-600 text-sm">Current blowback system operational information</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <div>
                  <div className="text-sm font-medium text-green-900">System Status</div>
                  <div className="text-xs text-green-700">Operational</div>
                </div>
              </div>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <div>
                  <div className="text-sm font-medium text-blue-900">Last Blowback</div>
                  <div className="text-xs text-blue-700">2 hours ago</div>
                </div>
              </div>
            </div>
            
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                <div>
                  <div className="text-sm font-medium text-orange-900">Next Scheduled</div>
                  <div className="text-xs text-orange-700">In {form.every} minutes</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
