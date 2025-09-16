from datetime import datetime
import random
from typing import List, Dict
from app.domain.data_model import DataPoint, StackData, DataResponse
from app.services.modbus_data_service import ModbusDataService
from app.services.config_service import ConfigService
from app.services.websocket_service import WebSocketService
from app.domain.websocket_model import DataMessage
from app.services.sqlite_service import SQLiteService

class DataService:
    def __init__(self, websocket_service: WebSocketService = None, config_service=None):
        self.stacks = {
            "stack1": {"name": "Stack 1", "status": "disconnected"}
        }
        self.modbus_data_service = ModbusDataService(config_service)
        self.config_service = config_service or ConfigService()
        self.websocket_service = websocket_service
        self.use_modbus = True  # เปิด Modbus เพื่อรับข้อมูล real-time
        self.sqlite_service = SQLiteService()

    def get_latest_data(self, stack_id: str = "stack1") -> StackData:
        # 1. ลองดึงข้อมูลจาก Modbus/Sensor ก่อน
        if self.use_modbus:
            try:
                # ดึงข้อมูลจาก Modbus ตามการตั้งค่าใน Config
                modbus_data = self.modbus_data_service.get_data_from_devices()
                if modbus_data:
                    # แปลงข้อมูล Modbus เป็น StackData
                    stack_data = self._convert_modbus_to_stack_data(modbus_data, stack_id)
                    # บันทึกลง SQLite
                    self.save_data_to_sqlite(stack_data)
                    return stack_data
                else:
                    print("DEBUG: No Modbus data available, trying SQLite fallback")
            except Exception as e:
                print(f"Modbus error: {e}")
        
        # 2. ถ้าไม่มีข้อมูลจาก Modbus ให้ดึงจาก SQLite แต่แสดงเฉพาะที่มี mapping
        sqlite_data = self.sqlite_service.get_latest_data(stack_id)
        if sqlite_data:
            data_point = DataPoint(**sqlite_data["data"])
            corrected_data = DataPoint(**sqlite_data["corrected_data"])
            
            # กรองข้อมูลให้แสดงเฉพาะที่มี mapping
            filtered_data = self._filter_data_by_mappings(data_point)
            filtered_corrected = self._filter_data_by_mappings(corrected_data)
            
            return StackData(
                stack_id=sqlite_data["stack_id"],
                stack_name=sqlite_data["stack_name"],
                data=filtered_data,
                corrected_data=filtered_corrected,
                status=sqlite_data["status"]
            )
        # 3. ไม่มีข้อมูลเลย - สร้างข้อมูลเริ่มต้น
        print("DEBUG: No data available, creating default data")
        from datetime import timezone, timedelta
        thailand_tz = timezone(timedelta(hours=7))
        current_time = datetime.now(thailand_tz)
        default_data = DataPoint(
            timestamp=current_time,
            SO2=0.0, NOx=0.0, O2=0.0, CO=0.0, Dust=0.0,
            Temperature=0.0, Velocity=0.0, Flowrate=0.0, Pressure=0.0
        )
        
    def _filter_data_by_mappings(self, data_point: DataPoint) -> DataPoint:
        """กรองข้อมูลให้แสดงเฉพาะที่มี mapping"""
        # ดึงรายการ mappings ที่มีอยู่
        mappings = self.config_service.get_mappings()
        available_params = [m.name for m in mappings]
        
        # สร้าง DataPoint ใหม่โดยแสดงเฉพาะที่มี mapping
        filtered_data = DataPoint(
            timestamp=data_point.timestamp,
            SO2=data_point.SO2 if "SO2" in available_params else 0.0,
            NOx=data_point.NOx if "NOx" in available_params else 0.0,
            O2=data_point.O2 if "O2" in available_params else 0.0,
            CO=data_point.CO if "CO" in available_params else 0.0,
            Dust=data_point.Dust if "Dust" in available_params else 0.0,
            Temperature=data_point.Temperature if "Temperature" in available_params else 0.0,
            Velocity=data_point.Velocity if "Velocity" in available_params else 0.0,
            Flowrate=data_point.Flowrate if "Flowrate" in available_params else 0.0,
            Pressure=data_point.Pressure if "Pressure" in available_params else 0.0
        )
        
        return filtered_data

    def _convert_modbus_to_stack_data(self, modbus_data: dict, stack_id: str) -> StackData:
        """แปลงข้อมูล Modbus เป็น StackData"""
        # ดึงข้อมูลจาก Modbus ตาม mapping ที่ตั้งค่าไว้
        # ใช้เวลาปัจจุบันที่ถูกต้อง (Local Time - Thailand UTC+7)
        from datetime import timezone, timedelta
        thailand_tz = timezone(timedelta(hours=7))
        current_time = datetime.now(thailand_tz)
        print(f"DEBUG: Creating data point at {current_time} (Thailand Time)")
        
        # สร้างข้อมูลจาก Modbus แต่แสดงเฉพาะที่มี mapping
        mappings = self.config_service.get_mappings()
        available_params = [m.name for m in mappings]
        
        data = DataPoint(
            timestamp=current_time,
            SO2=modbus_data.get("SO2", 0) if "SO2" in available_params else 0,
            NOx=modbus_data.get("NOx", 0) if "NOx" in available_params else 0,
            O2=modbus_data.get("O2", 0) if "O2" in available_params else 0,
            CO=modbus_data.get("CO", 0) if "CO" in available_params else 0,
            Dust=modbus_data.get("Dust", 0) if "Dust" in available_params else 0,
            Temperature=modbus_data.get("Temperature", 0) if "Temperature" in available_params else 0,
            Velocity=modbus_data.get("Velocity", 0) if "Velocity" in available_params else 0,
            Flowrate=modbus_data.get("Flowrate", 0) if "Flowrate" in available_params else 0,
            Pressure=modbus_data.get("Pressure", 0) if "Pressure" in available_params else 0
        )
        
        # คำนวณค่าที่ปรับแก้แล้ว
        corrected_data = self._calculate_corrected_values(data)
        
        return StackData(
            stack_id=stack_id,
            stack_name=self.stacks[stack_id]["name"],
            data=data,
            corrected_data=corrected_data,
            status="connected (modbus)"
        )

    def save_data_to_sqlite(self, stack_data: StackData):
        """บันทึกข้อมูลลง SQLite"""
        try:
            data_dict = {
                "stack_id": stack_data.stack_id,
                "stack_name": stack_data.stack_name,
                "SO2": stack_data.data.SO2,
                "NOx": stack_data.data.NOx,
                "O2": stack_data.data.O2,
                "CO": stack_data.data.CO,
                "Dust": stack_data.data.Dust,
                "Temperature": stack_data.data.Temperature,
                "Velocity": stack_data.data.Velocity,
                "Flowrate": stack_data.data.Flowrate,
                "Pressure": stack_data.data.Pressure,
                "SO2Corr": stack_data.corrected_data.SO2 if stack_data.corrected_data else 0,
                "NOxCorr": stack_data.corrected_data.NOx if stack_data.corrected_data else 0,
                "COCorr": stack_data.corrected_data.CO if stack_data.corrected_data else 0,
                "DustCorr": stack_data.corrected_data.Dust if stack_data.corrected_data else 0,
                "status": stack_data.status,
                "device_name": "modbus_device"
            }
            self.sqlite_service.save_cems_data(data_dict)
            print(f"DEBUG: Saved data to SQLite: {stack_data.stack_id}")
        except Exception as e:
            print(f"DEBUG: Error saving data to SQLite: {str(e)}")

    def _calculate_corrected_values(self, data: DataPoint) -> DataPoint:
        """คำนวณค่าที่ปรับแก้แล้วสำหรับ O2 7%"""
        print(f"DEBUG: Calculating corrected values for O2={data.O2}%")
        if data.O2 <= 0:
            print("DEBUG: O2 <= 0, returning original data")
            return data
        
        correction_factor = 21.0 / (21.0 - data.O2)
        print(f"DEBUG: Correction factor = {correction_factor}")
        
        corrected = DataPoint(
            timestamp=data.timestamp,
            SO2=round(data.SO2 * correction_factor, 1),
            NOx=round(data.NOx * correction_factor, 1),
            O2=data.O2,
            CO=round(data.CO * correction_factor, 1),
            Dust=round(data.Dust * correction_factor, 1),
            Temperature=data.Temperature,
            Velocity=data.Velocity,
            Flowrate=data.Flowrate,
            Pressure=data.Pressure
        )
        print(f"DEBUG: Corrected values: SO2={corrected.SO2}, NOx={corrected.NOx}, CO={corrected.CO}, Dust={corrected.Dust}")
        return corrected

    def get_available_stacks(self) -> List[dict]:
        return [{"id": k, "name": v["name"], "status": v["status"]} for k, v in self.stacks.items()]

    def toggle_modbus(self, enabled: bool):
        self.use_modbus = enabled

    def test_modbus_connection(self, device_id: str) -> Dict:
        return self.modbus_data_service.test_connection(device_id)

    def _send_websocket_data(self, stack_data: StackData):
        """ส่งข้อมูลผ่าน WebSocket"""
        if not self.websocket_service:
            return
            
        try:
            message = DataMessage(
                data=[stack_data],
                timestamp=datetime.now()
            )
            import asyncio
            asyncio.create_task(self.websocket_service.send_message(message))
        except Exception as e:
            print(f"WebSocket send error: {e}")