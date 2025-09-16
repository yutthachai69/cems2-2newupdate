from typing import List, Optional
from datetime import datetime
from app.domain.status_model import StatusItem, AlarmItem, StatusResponse
from app.services.status_alarm_sevice import StatusAlarmService
from app.services.config_service import ConfigService

class StatusService:
    def __init__(self, config_service=None):
        self.config_service = config_service or ConfigService()
        self.status_alarm_service = StatusAlarmService(config_service=self.config_service)
    
    def get_status(self) -> StatusResponse:
        # รายการเริ่มต้น (เหมือนเต้าเสียบที่ว่าง) - ย้ายมาที่ต้นฟังก์ชัน
        default_status_items = [
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
            "Hold Current Value",
        ]
        
        default_alarm_items = [
            "Temperature Controller Alarm",
            "Analyzer Malfunction", 
            "Sample Probe Alarm",
            "Alarm Light",
        ]
        
        # ลองอ่านข้อมูลจาก Modbus ก่อน
        try:
            modbus_data = self.status_alarm_service.read_status_alarm_data()
            print(f"DEBUG: StatusService received modbus_data: {modbus_data}")
            
            # ถ้ามีข้อมูล Modbus ให้ใช้
            if modbus_data:
                modbus_statuses = []
                modbus_alarms = []
                
                for item in modbus_data:
                    if item["type"] == "status":
                        modbus_statuses.append(StatusItem(
                            id=f"{item['name'].lower().replace(' ', '_')}_modbus",
                            name=item["name"],
                            status="on" if item["value"] == 1 else "off",  # 1=ON, 0=OFF
                            category=self._get_category_by_name(item["name"]),
                            description=f"Modbus: {item['name']} = {item['value']} ({'ON' if item['value'] == 1 else 'OFF'})",
                            last_updated=datetime.now()
                        ))
                    elif item["type"] == "alarm":
                        modbus_alarms.append(AlarmItem(
                            id=f"{item['name'].lower().replace(' ', '_')}_modbus",
                            message=item["name"],
                            severity="high" if item["value"] == 1 else "low",  # 1=Active, 0=Inactive
                            timestamp=datetime.now(),
                            acknowledged=item["value"] == 0  # 0=OFF (acknowledged), 1=ON (not acknowledged)
                        ))
                
                active_alarms = len([alarm for alarm in modbus_alarms if not alarm.acknowledged])
                print(f"DEBUG: StatusService processed {len(modbus_alarms)} modbus alarms, {active_alarms} active")
                
                # รวมการ์ดจาก Modbus กับการ์ดเริ่มต้น
                all_statuses = modbus_statuses.copy()
                all_alarms = modbus_alarms.copy()
                
                # เพิ่มการ์ดเริ่มต้นที่ยังไม่มีใน Modbus
                for i, name in enumerate(default_status_items):
                    exists = any(status.name == name for status in modbus_statuses)
                    if not exists:
                        all_statuses.append(StatusItem(
                            id=f"default_status_{i}",
                            name=name,
                            status="off",  # Default เป็น OFF รอการแมพ
                            category=self._get_category_by_name(name),
                            description=f"Default OFF - Waiting for Modbus mapping: {name}",
                            last_updated=datetime.now()
                        ))
                
                for i, name in enumerate(default_alarm_items):
                    exists = any(alarm.message == name for alarm in modbus_alarms)
                    if not exists:
                        all_alarms.append(AlarmItem(
                            id=f"default_alarm_{i}",
                            message=name,
                            severity="low",
                            timestamp=datetime.now(),
                            acknowledged=True  # Default เป็น inactive รอการแมพ
                        ))
                
                return StatusResponse(
                    system_status="online",
                    active_alarms=active_alarms,
                    statuses=all_statuses,
                    alarms=all_alarms
                )
            
        except Exception as e:
            print(f"Error reading Modbus data: {e}")
        
        # ถ้าไม่มีข้อมูล Modbus ให้แสดงการ์ดทั้งหมดไว้รอ (เหมือนเต้าเสียบที่ว่าง)
        
        # สร้าง status items ทั้งหมด (แสดงเป็น OFF ไว้รอ - รอการแมพ)
        default_statuses = []
        for i, name in enumerate(default_status_items):
            default_statuses.append(StatusItem(
                id=f"default_status_{i}",
                name=name,
                status="off",  # Default เป็น OFF รอการแมพ
                category=self._get_category_by_name(name),
                description=f"Default OFF - Waiting for Modbus mapping: {name}",
                last_updated=datetime.now()
            ))
        
        # สร้าง alarm items ทั้งหมด (แสดงเป็น inactive ไว้รอ - รอการแมพ)
        default_alarms = []
        for i, name in enumerate(default_alarm_items):
            default_alarms.append(AlarmItem(
                id=f"default_alarm_{i}",
                message=name,
                severity="low",
                timestamp=datetime.now(),
                acknowledged=True  # Default เป็น inactive รอการแมพ
            ))
        
        # ลองอ่านข้อมูลจาก SQLite เพื่อแสดงค่าจริงถ้ามี
        try:
            from app.services.sqlite_service import SQLiteService
            sqlite_service = SQLiteService()
            latest_data = sqlite_service.get_latest_data()
            
            if latest_data:
                # ตรวจสอบค่าที่ผิดปกติและสร้าง alarms จริง
                real_alarms = []
                
                if latest_data.get("SO2", 0) > 10:
                    real_alarms.append(AlarmItem(
                        id="high_so2_alarm",
                        message="High SO2 concentration detected",
                        severity="high",
                        timestamp=datetime.now(),
                        acknowledged=False
                    ))
                
                if latest_data.get("Temperature", 0) > 50:
                    real_alarms.append(AlarmItem(
                        id="high_temp_alarm", 
                        message="High temperature detected",
                        severity="medium",
                        timestamp=datetime.now(),
                        acknowledged=False
                    ))
                
                # รวม alarms จริงกับ alarms เริ่มต้น
                all_alarms = default_alarms + real_alarms
                active_alarms = len([alarm for alarm in real_alarms if not alarm.acknowledged])
                
                return StatusResponse(
                    system_status="online",
                    active_alarms=active_alarms,
                    statuses=default_statuses,
                    alarms=all_alarms
                )
                
        except Exception as e:
            print(f"Error reading SQLite data: {e}")
        
        # ถ้าไม่มีข้อมูล SQLite ให้แสดงการ์ดทั้งหมดเป็น OFF
        return StatusResponse(
            system_status="offline",
            active_alarms=0,
            statuses=default_statuses,
            alarms=default_alarms
        )

    def get_alarms(self) -> List[AlarmItem]:
        return []

    def acknowledge_alarm(self, alarm_id: str) -> bool:
        return True

    def _get_category_by_name(self, name: str) -> str:
        """กำหนด category ตามชื่อ"""
        if "maintenance" in name.lower():
            return "maintenance"
        elif "calibration" in name.lower():
            return "calibration"
        elif "blowback" in name.lower():
            return "blowback"
        elif "sampling" in name.lower():
            return "sampling"
        elif "analyzer" in name.lower():
            return "analyzer"
        elif "alarm" in name.lower():
            return "alarm"
        else:
            return "system"