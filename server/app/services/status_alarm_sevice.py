from typing import List, Dict, Any
from datetime import datetime
from app.services.modbus_data_service import ModbusDataService
from app.services.config_service import ConfigService

class StatusAlarmService:
    def __init__(self, config_service=None):
        self.config_service = config_service or ConfigService()
        self.modbus_service = ModbusDataService(self.config_service)
        # เพิ่ม cache เพื่อลดการอ่าน Modbus ซ้ำ
        self._cache = {}
        self._cache_timeout = 0.1  # ลดเป็น 0.1 วินาที เพื่อให้ real-time มากขึ้น
        self._last_cache_time = 0
        # เพิ่มระบบติดตามการเปลี่ยนแปลง
        self._last_mappings_hash = None
        self._last_mapping_count = 0
    
    def read_status_alarm_data(self) -> List[Dict[str, Any]]:
        """อ่านข้อมูล status/alarm จาก Modbus ตาม mapping"""
        try:
            # ล้าง cache เพื่อบังคับให้อ่านข้อมูลใหม่ทุกครั้ง
            self.clear_cache()
            
            # ตรวจสอบ cache ก่อน
            import time
            current_time = time.time()
            if (current_time - self._last_cache_time) < self._cache_timeout and self._cache:
                return self._cache
            
            # โหลด status/alarm mapping
            mappings = self._load_status_alarm_mapping()
            
            # ตรวจสอบว่ามีการเปลี่ยนแปลง mapping หรือไม่
            current_mapping_count = len(mappings)
            current_mappings_hash = hash(str(sorted([(m.get('name', ''), m.get('address', 0), m.get('device', '')) for m in mappings])))
            
            # ถ้าไม่มี mapping หรือไม่มี device config ให้ return empty
            if not mappings or not self.config_service.get_devices():
                print("INFO: No status/alarm mappings or device configs found")
                return []
            
            # ถ้า mapping ไม่เปลี่ยนและมี cache ให้ใช้ cache
            if (self._last_mappings_hash == current_mappings_hash and 
                self._last_mapping_count == current_mapping_count and 
                self._cache):
                return self._cache
            
            results = []
            
            for mapping in mappings:
                if not mapping.get("enabled", True):
                    continue
                    
                try:
                    # อ่านค่า digital จาก Modbus
                    device_name = mapping["device"]
                    address = mapping["address"]
                    
                    # บังคับให้ reconnect Modbus ทุกครั้ง
                    self.modbus_service.disconnect_device(device_name)
                    
                    # อ่านค่า coil status (0 หรือ 1)
                    value = self.modbus_service.read_coil_status(device_name, address)
                    print(f"DEBUG: Read {mapping['name']} from {device_name} address {address} = {value}")
                    
                    results.append({
                        "id": mapping["id"],
                        "name": mapping["name"],
                        "type": mapping["type"],
                        "device": device_name,
                        "address": address,
                        "value": value,
                        "status": "ON" if value == 1 else "OFF",
                        "timestamp": datetime.now(),
                        "enabled": mapping.get("enabled", True)
                    })
                    
                except Exception as e:
                    print(f"Error reading {mapping['name']}: {e}")
                    results.append({
                        "id": mapping["id"],
                        "name": mapping["name"],
                        "type": mapping["type"],
                        "device": device_name,
                        "address": address,
                        "value": 0,
                        "status": "ERROR",
                        "timestamp": datetime.now(),
                        "enabled": mapping.get("enabled", True),
                        "error": str(e)
                    })
            
            # บันทึก cache และข้อมูล mapping
            self._cache = results
            self._last_cache_time = current_time
            self._last_mappings_hash = current_mappings_hash
            self._last_mapping_count = current_mapping_count
            
            print(f"DEBUG: StatusAlarmService returning {len(results)} items")
            for item in results:
                print(f"  - {item['name']}: value={item['value']}, status={item['status']}")
            return results
            
        except Exception as e:
            print(f"ERROR: Error reading status/alarm data: {e}")
            return []
    
    def _load_status_alarm_mapping(self) -> List[Dict[str, Any]]:
        """โหลด status/alarm mapping จากไฟล์"""
        try:
            import json
            import os
            
            STATUS_ALARM_FILE = "config/status_alarm.json"
            if os.path.exists(STATUS_ALARM_FILE):
                with open(STATUS_ALARM_FILE, "r", encoding="utf-8") as f:
                    return json.load(f)
            return []
        except Exception as e:
            print(f"Error loading status/alarm mapping: {e}")
            return []
    
    def clear_cache(self):
        """ล้าง cache เพื่อบังคับให้อ่านข้อมูลใหม่"""
        self._cache = {}
        self._last_cache_time = 0