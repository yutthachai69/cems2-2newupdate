from datetime import datetime
import random
from typing import List, Dict
from app.domain.data_model import DataPoint, StackData, DataResponse
from app.services.modbus_data_service import ModbusDataService
from app.services.config_service import ConfigService
from app.services.websocket_service import WebSocketService
from app.domain.websocket_model import DataMessage
from app.services.influxdb_service import InfluxDBService

class DataService:
    def __init__(self, websocket_service: WebSocketService = None, config_service=None):
        self.stacks = {
            "stack1": {"name": "Stack 1", "status": "disconnected"}
        }
        self.modbus_data_service = ModbusDataService(config_service)
        self.config_service = config_service or ConfigService()
        self.websocket_service = websocket_service
        self.use_modbus = True  # เปิด Modbus แต่จะไม่ error เมื่อหา device ไม่เจอ
        self.influxdb_service = InfluxDBService()
        self.use_influxdb = True  # ใช้ InfluxDB เป็นหลัก

    def get_latest_data(self, stack_id: str = "stack1") -> StackData:
        # 1. ลองดึงข้อมูลจาก Modbus/Sensor ก่อน
        if self.use_modbus:
            try:
                # ดึงข้อมูลจาก Modbus ตามการตั้งค่าใน Config
                modbus_data = self.modbus_data_service.get_data_from_devices()
                if modbus_data:
                    # print(f"DEBUG: DataService received modbus_data: {modbus_data}")
                    # แปลงข้อมูล Modbus เป็น StackData
                    stack_data = self._convert_modbus_to_stack_data(modbus_data, stack_id)
                    # print(f"DEBUG: DataService created stack_data: {stack_data}")
                    # บันทึกลง InfluxDB
                    if self.use_influxdb:
                        self.save_data_to_influxdb(stack_data)
                    return stack_data
                else:
                    # print("DEBUG: No Modbus data available, trying InfluxDB fallback")
                    pass
            except Exception as e:
                # print(f"Modbus error: {e}")
                pass
        
        # 2. ถ้าไม่มีข้อมูลจาก Modbus ให้ดึงจาก InfluxDB
        influxdb_data = self.influxdb_service.get_latest_cems_data(stack_id)
        if influxdb_data:
            data_point = DataPoint(**influxdb_data["data"])
            corrected_data = DataPoint(**influxdb_data["corrected_data"])
            
            # กรองข้อมูลให้แสดงเฉพาะที่มี mapping
            filtered_data = self._filter_data_by_mappings(data_point)
            filtered_corrected = self._filter_data_by_mappings(corrected_data)
            
            return StackData(
                stack_id=influxdb_data["stack_id"],
                stack_name=influxdb_data["stack_name"],
                data=filtered_data,
                corrected_data=filtered_corrected,
                status=influxdb_data["status"]
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
        
        return StackData(
            stack_id=stack_id,
            stack_name=self.stacks[stack_id]["name"],
            data=default_data,
            corrected_data=default_data,
            status="no data available"
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
        
        # สร้าง data dict แบบ dynamic จาก modbus_data
        data_dict = {}
        for param_name in available_params:
            data_dict[param_name] = modbus_data.get(param_name, 0.0)
        
        # สร้าง DataPoint แบบ dynamic
        data = DataPoint(
            timestamp=current_time,
            data=data_dict,
            # Backward compatibility fields
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

    def save_data_to_influxdb(self, stack_data: StackData):
        """บันทึกข้อมูลลง InfluxDB"""
        try:
            # ✅ ใช้ to_dict() เพื่อแปลง fixed + extra_params เป็น dict
            data_dict = stack_data.data.to_dict()
            
            corrected_dict = {}
            if stack_data.corrected_data:
                corrected_dict = stack_data.corrected_data.to_dict()
            
            success = self.influxdb_service.save_cems_data(
                stack_id=stack_data.stack_id,
                stack_name=stack_data.stack_name,
                data=data_dict,
                corrected_data=corrected_dict,
                status=stack_data.status,
                device_name="modbus_device"
            )
            
            if success:
                # print(f"DEBUG: Saved data to InfluxDB: {stack_data.stack_id}")
                pass
            else:
                # print(f"DEBUG: Failed to save data to InfluxDB: {stack_data.stack_id}")
                pass
        except Exception as e:
            # print(f"DEBUG: Error saving data to InfluxDB: {str(e)}")
            pass


    def _calculate_corrected_values(self, data: DataPoint) -> DataPoint:
        """คำนวณค่าที่ปรับแก้แล้วสำหรับ O2 7%"""
        # print(f"DEBUG: Calculating corrected values for O2={data.O2}%")
        
        # ตรวจสอบค่าที่ไม่ถูกต้อง
        if data.O2 <= 0 or data.O2 >= 21:
            # print("DEBUG: O2 <= 0 or >= 21, returning original data")
            return data
        
        # ป้องกันการหารด้วยศูนย์
        if abs(21.0 - data.O2) < 0.1:
            # print("DEBUG: O2 too close to 21%, returning original data")
            return data
        
        correction_factor = (21.0 - 7.0) / (21.0 - data.O2)
        
        # ตรวจสอบค่า correction factor ที่ไม่สมเหตุสมผล
        if correction_factor <= 0 or correction_factor > 10:
            # print(f"DEBUG: Invalid correction factor {correction_factor}, returning original data")
            return data
            
        # print(f"DEBUG: Correction factor = {correction_factor}")
        
        # ✅ สร้าง corrected data point
        corrected = DataPoint(timestamp=data.timestamp)
        
        # ✅ รายการ parameters ที่ต้อง O2 correction (emission gases)
        params_to_correct = ["SO2", "NOx", "CO", "Dust", "HCl", "NH3", "SO3", "H2S", "NO", "NO2"]
        
        # ✅ รายการ parameters ที่ไม่ต้อง correction (physical parameters)
        params_no_correct = ["O2", "Temperature", "Velocity", "Flowrate", "Pressure", "Humidity"]
        
        # ✅ ดึงข้อมูลทั้งหมด (fixed + extra_params)
        all_data = data.to_dict()
        
        for param_name, value in all_data.items():
            if param_name in params_no_correct:
                # ไม่ต้อง correct - copy ค่าเดิม
                corrected.set(param_name, value)
            elif param_name in params_to_correct:
                # ต้อง correct
                if value != 0:
                    corrected.set(param_name, round(value * correction_factor, 1))
                else:
                    corrected.set(param_name, 0.0)
            else:
                # Parameters ที่ไม่รู้จัก - ไม่ correct (ปลอดภัย)
                corrected.set(param_name, value)
        
        # print(f"DEBUG: Corrected values calculated for {len(all_data)} parameters")
        return corrected

    def get_available_stacks(self) -> List[dict]:
        return [{"id": k, "name": v["name"], "status": v["status"]} for k, v in self.stacks.items()]

    def toggle_modbus(self, enabled: bool):
        self.use_modbus = enabled

    def toggle_influxdb(self, enabled: bool):
        self.use_influxdb = enabled

    def test_modbus_connection(self, device_id: str) -> Dict:
        return self.modbus_data_service.test_connection(device_id)

    def test_influxdb_connection(self) -> bool:
        """ทดสอบการเชื่อมต่อ InfluxDB"""
        return self.influxdb_service.test_connection()

    def get_data_range(self, start_time: datetime = None, end_time: datetime = None, 
                      stack_id: str = None, limit: int = 1000) -> List[Dict]:
        """ดึงข้อมูลในช่วงเวลาที่กำหนด"""
        return self.influxdb_service.get_cems_data_range(start_time, end_time, stack_id, limit)

    def search_data(self, start_time: datetime = None, end_time: datetime = None, 
                   search_column: str = None, search_value: str = None, 
                   stack_id: str = None, limit: int = 1000) -> List[Dict]:
        """ค้นหาข้อมูล"""
        return self.influxdb_service.search_cems_data(start_time, end_time, search_column, search_value, stack_id, limit)

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