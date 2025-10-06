from datetime import datetime
from typing import List, Dict, Optional
from app.services.modbus_service import ModbusService
from app.services.config_service import ConfigService
from app.domain.data_model import DataPoint, StackData, DataResponse
import logging

logger = logging.getLogger(__name__)

class ModbusDataService:
    def __init__(self, config_service=None):
        self.modbus_service = ModbusService()
        self.config_service = config_service or ConfigService()
        self.device_configs = {}  # จะถูกโหลดจาก Config
        self.connected_devices = set()
        
        # เพิ่ม cache เพื่อลดการอ่าน Modbus ซ้ำ
        self._data_cache = {}
        self._cache_timeout = 2  # cache 2 วินาที
        self._last_cache_time = 0
        
        # โหลดการตั้งค่าจาก Config
        self._load_configs()

    def _load_configs(self):
        """โหลดการตั้งค่า devices และ mappings จาก ConfigService"""
        try:
            devices = self.config_service.get_devices()
            mappings = self.config_service.get_mappings()
            
            # เปิด debug log เพื่อดูการโหลด config
            print(f"DEBUG: Loaded {len(devices)} devices: {[d.name for d in devices]}")
            print(f"DEBUG: Loaded {len(mappings)} mappings: {[m.name for m in mappings]}")
            
            # สร้าง device_configs จาก devices และ mappings
            self.device_configs = {}
            
            for device in devices:
                device_id = device.name  # ใช้ device.name เป็น device_id

                # หา mappings ที่เกี่ยวข้องกับ device นี้
                device_mappings = {}
                for mapping in mappings:
                    if mapping.device == device.name:
                         device_mappings[mapping.name] = {
                             "address": mapping.address,
                             "dataType": mapping.dataType,
                             "endian": "big"  # default
                                }
                
                self.device_configs[device_id] = {
                    "host": device.host,
                    "port": device.port,
                    "unit": device.unit,
                    "mappings": device_mappings
                }
                
            logger.info(f"Loaded {len(self.device_configs)} device configurations")
            
        except Exception as e:
            logger.error(f"Failed to load configs: {e}")
            self.device_configs = {}

    def reload_configs(self):
        """โหลดการตั้งค่าใหม่ (เรียกใช้เมื่อมีการอัพเดท Config)"""
        self._load_configs()
        # ตัดการเชื่อมต่อทั้งหมดเพื่อเชื่อมต่อใหม่
        self.connected_devices.clear()

    def connect_device(self, device_id: str) -> bool:
        if device_id not in self.device_configs:
            logger.error(f"Device {device_id} not found in config")
            return False

        config = self.device_configs[device_id]
        success = self.modbus_service.connect_device(
            device_id=device_id,
            host=config["host"],
            port=config["port"],
            unit=config["unit"]
        )
        if success:
            self.connected_devices.add(device_id)
            logger.info(f"Connected to device {device_id}")
        else:
            logger.error(f"Failed to connect to device {device_id}")
        return success

    def disconnect_device(self, device_id: str) -> bool:
        success = self.modbus_service.disconnect_device(device_id)
        if success:
            self.connected_devices.discard(device_id)
        return success

    def read_parameter(self, device_id: str, parameter: str) -> Optional[float]:
        # ลด debug logs - แสดงเฉพาะเมื่อมี error
        # print(f"Reading parameter {parameter} from device {device_id}")
        
        if device_id not in self.device_configs:
            # print(f"Device {device_id} not found in configs")
            return None

        if device_id not in self.connected_devices:
            # print(f"Device {device_id} not connected, attempting to connect...")
            if not self.connect_device(device_id):
                # print(f"Failed to connect to device {device_id}")
                return None

        config = self.device_configs[device_id]
        if parameter not in config["mappings"]:
            print(f"Parameter {parameter} not found in config for device {device_id}")
            logger.error(f"Parameter {parameter} not found in config for device {device_id}")
            return None

        mapping = config["mappings"][parameter]
        address = mapping["address"]
        data_type = mapping["dataType"]
        endian = mapping.get("endian", "big")
        
        # ลด debug logs - แสดงเฉพาะเมื่อมี error
        # print(f"Reading {parameter}: address={address}, dataType={data_type}, endian={endian}")

        try:
            if data_type == "float32":
                value = self.modbus_service.read_float32(device_id, address, endian)
            elif data_type == "int16":
                value = self.modbus_service.read_int16(device_id, address)
            else:
                print(f"Unsupported data type {data_type} for parameter {parameter} on device {device_id}")
                logger.error(f"Unsupported data type {data_type} for parameter {parameter} on device {device_id}")
                return None

            # ลด debug logs - แสดงเฉพาะเมื่อมี error
            # print(f"Read {parameter} = {value}")
            return value
        except Exception as e:
            # ไม่แสดง error log เมื่อ device ไม่เชื่อมต่อได้ (ยังไม่ได้เปิด Modbus)
            if "No connection could be made" not in str(e):
                print(f"Error reading parameter {parameter} on device {device_id}: {e}")
                logger.error(f"Error reading parameter {parameter} on device {device_id}: {e}")
            return None

    def get_cems_data(self, device_id: str) -> Optional[DataPoint]:
        if device_id not in self.device_configs:
            logger.error(f"Device {device_id} not found in config")
            return None

        try:
            # ลด debug logs - แสดงเฉพาะเมื่อมี error
            # print(f"Reading CEMS data for device: {device_id}")
            # print(f"Device configs: {list(self.device_configs.keys())}")
            # print(f"Connected devices: {list(self.connected_devices)}")
            
            # อ่านเฉพาะ parameters ที่มีใน mappings
            config = self.device_configs[device_id]
            available_mappings = list(config["mappings"].keys())
            # print(f"Available mappings: {available_mappings}")
            
            # กำหนดค่าเริ่มต้น
            so2 = nox = o2 = co = dust = temperature = velocity = flowrate = pressure = 0.0
            
            # อ่านเฉพาะที่มีใน mappings
            if "SO2" in available_mappings:
                so2 = self.read_parameter(device_id, "SO2") or 0.0
            if "NOx" in available_mappings:
                nox = self.read_parameter(device_id, "NOx") or 0.0
            if "O2" in available_mappings:
                o2 = self.read_parameter(device_id, "O2") or 0.0
            if "CO" in available_mappings:
                co = self.read_parameter(device_id, "CO") or 0.0
            if "Dust" in available_mappings:
                dust = self.read_parameter(device_id, "Dust") or 0.0
            if "Temperature" in available_mappings:
                temperature = self.read_parameter(device_id, "Temperature") or 0.0
            if "Velocity" in available_mappings:
                velocity = self.read_parameter(device_id, "Velocity") or 0.0
            if "Flowrate" in available_mappings:
                flowrate = self.read_parameter(device_id, "Flowrate") or 0.0
            if "Pressure" in available_mappings:
                pressure = self.read_parameter(device_id, "Pressure") or 0.0
            
            # ลด debug logs - แสดงเฉพาะเมื่อมี error
            # print(f"Read values: SO2={so2}, NOx={nox}, O2={o2}, CO={co}, Dust={dust}")
            # print(f"Read values: Temp={temperature}, Velocity={velocity}, Flowrate={flowrate}, Pressure={pressure}")

            # ใช้เวลาปัจจุบันที่ถูกต้อง (Thailand Time UTC+7)
            from datetime import timezone, timedelta
            thailand_tz = timezone(timedelta(hours=7))
            current_time = datetime.now(thailand_tz)
            # ลด debug logs - แสดงเฉพาะเมื่อมี error
            # print(f"DEBUG: Creating data point at {current_time} (Thailand Time)")
            
            return DataPoint(
                timestamp=current_time,
                SO2=round(so2, 1),
                NOx=round(nox, 1),
                O2=round(o2, 1),
                CO=round(co, 1),
                Dust=round(dust, 1),
                Temperature=round(temperature, 1),
                Velocity=round(velocity, 1),
                Flowrate=round(flowrate, 1),
                Pressure=round(pressure, 1)
            )
        except Exception as e:
            logger.error(f"Error getting CEMS data for device {device_id}: {e}")
            return None

    def get_all_stacks_data(self) -> List[DataPoint]:
        results = []
        for device_id in self.device_configs.keys():
            data = self.get_cems_data(device_id)
            if data:
                stack_data = StackData(
                    stack_id=device_id,
                    stack_name=f"Stack {device_id}",
                    data=data,
                    status="connected" if device_id in self.connected_devices else "disconnected"
                )
                results.append(stack_data)
        return results

    def get_data_from_devices(self) -> Dict:
        """ดึงข้อมูลจากอุปกรณ์ Modbus ทั้งหมด"""
        try:
            # โหลด configs ก่อนเสมอ
            self._load_configs()
            
            data = {}
            
            # ดึงข้อมูลจากแต่ละ device
            for device_name, device_config in self.device_configs.items():
                try:
                    # เชื่อมต่อ Modbus
                    success = self.modbus_service.connect_device(
                        device_name, 
                        device_config['host'], 
                        device_config['port'], 
                        device_config['unit']
                    )
                    if success:
                        # ดึงข้อมูลตาม mapping
                        client = self.modbus_service.get_client(device_name)
                        device_data = self._read_device_data(client, device_name)
                        
                        # รวมข้อมูลเข้าด้วยกัน (ไม่เขียนทับ)
                        for key, value in device_data.items():
                            if key not in data:  # ถ้ายังไม่มี key นี้
                                data[key] = value
                            else:
                                # ถ้ามี key เดียวกัน ให้ใช้ค่าที่ไม่เป็น 0
                                if value != 0.0:
                                    data[key] = value
                        
                        # เปิด debug log เพื่อดูข้อมูลที่อ่านได้
                        print(f"DEBUG: Read data from {device_name}: {device_data}")
                    else:
                        print(f"DEBUG: Failed to connect to {device_name}")
                        pass
                except Exception as e:
                    # ไม่แสดง error log เมื่อ device ไม่เชื่อมต่อได้ (ยังไม่ได้เปิด Modbus)
                    if "No connection could be made" not in str(e):
                        print(f"DEBUG: Error reading from {device_name}: {e}")
            
            # เปิด debug log เพื่อดูข้อมูลรวม
            print(f"DEBUG: Combined data from all devices: {data}")
            return data if data else None
            
        except Exception as e:
            # ไม่แสดง error log เมื่อ device ไม่เชื่อมต่อได้ (ยังไม่ได้เปิด Modbus)
            if "No connection could be made" not in str(e):
                print(f"DEBUG: Error in get_data_from_devices: {e}")
            return None

    def _read_device_data(self, client, device_name: str) -> Dict:
        """อ่านข้อมูลจาก device หนึ่งตัว"""
        data = {}
        
        # หา mappings สำหรับ device นี้
        device_mappings = [m for m in self.config_service.get_mappings() if m.device == device_name]
        
        for mapping in device_mappings:
            try:
                # อ่านข้อมูลจาก Modbus (เป็น float32 ตาม format AB CD)
                result = client.read_holding_registers(mapping.address, 2)  # อ่าน 2 registers สำหรับ float32
                if result.registers and len(result.registers) >= 2:
                    # แปลงเป็น float32 ตาม format AB CD
                    value = self._registers_to_float32(result.registers, mapping.format)
                    data[mapping.name] = value
                    # เปิด debug log เพื่อดูข้อมูลที่อ่านได้
                    print(f"DEBUG: Read {mapping.name} from address {mapping.address}: {result.registers} -> {value}")
                            
            except Exception as e:
                print(f"DEBUG: Error reading {mapping.name} from {device_name}: {e}")
        
        return data

    def _registers_to_float32(self, registers: List[int], format: str) -> float:
        """แปลง registers เป็น float32 ตาม format AB CD"""
        try:
            if len(registers) == 2:
                # แปลงจาก 2 registers (AB CD format)
                if format == "AB CD":
                    # Big-endian: AB = registers[0], CD = registers[1]
                    combined = (registers[0] << 16) | registers[1]
                else:
                    # Little-endian: CD = registers[0], AB = registers[1]
                    combined = (registers[1] << 16) | registers[0]
                
                # แปลงเป็น float32
                import struct
                # ใช้ big-endian format
                float_bytes = struct.pack('>I', combined)
                value = struct.unpack('>f', float_bytes)[0]
                return value
            else:
                return 0.0
        except Exception as e:
            print(f"DEBUG: Error converting registers to float32: {e}")
            return 0.0

    def test_connection(self, device_name: str) -> Dict:
        """ทดสอบการเชื่อมต่อกับ device ตามชื่อ"""
        try:
            # หา device ที่มีชื่อตรงกัน
            devices = self.config_service.get_devices()
            target_device = None
            
            for device in devices:
                if device.name == device_name:
                    target_device = device
                    break
            
            if not target_device:
                return {
                    "success": False,
                    "message": f"Device '{device_name}' not found in configuration"
                }
            
            # ทดสอบการเชื่อมต่อ
            result = self.modbus_service.test_connection(
                host=target_device.host,
                port=target_device.port,
                unit=target_device.unit
            )
            
            return result
            
        except Exception as e:
            return {
                "success": False,
                "message": f"Connection test error: {str(e)}"
            }

    def read_coil_status(self, device_name: str, address: int) -> int:
        max_retries = 3
        retry_delay = 1  # seconds
        
        for attempt in range(max_retries):
            try:
                device = self.config_service.get_device_by_name(device_name)
                if not device:
                    raise Exception(f"Device '{device_name}' not found")
                
                # เชื่อมต่อ Modbus
                device_id = f"{device.host}:{device.port}"
                client = self.modbus_service.get_client(device_id)
                if not client:
                    success = self.modbus_service.connect_device(device_id, device.host, device.port, device.unit)
                    if success:
                        client = self.modbus_service.get_client(device_id)
                    else:
                        raise Exception(f"Failed to connect to device {device_id}")
                
                if not client:
                    raise Exception(f"No client available for device {device_id}")
                
                # อ่านค่า coil status พร้อม timeout (เปลี่ยนจาก discrete inputs เป็น coils)
                result = client.read_coils(address, 1, unit=device.unit)
                
                if result.isError():
                    raise Exception(f"Modbus read error: {result}")
                
                # คืนค่า 0 หรือ 1
                return 1 if result.bits[0] else 0
                
            except Exception as e:
                print(f"Attempt {attempt + 1}/{max_retries} - Error reading coil status from {device_name} address {address}: {e}")
                
                if attempt < max_retries - 1:
                    print(f"Retrying in {retry_delay} seconds...")
                    import time
                    time.sleep(retry_delay)
                    retry_delay *= 2  # Exponential backoff
                else:
                    print(f"All {max_retries} attempts failed")
                    raise e