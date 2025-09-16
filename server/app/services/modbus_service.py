from pymodbus.client import ModbusTcpClient
from pymodbus.exceptions import ModbusException
import struct
import logging
from typing import Optional, List, Dict

logger = logging.getLogger(__name__)

class ModbusService:
    def __init__(self):
        self.clients: Dict[str, ModbusTcpClient] = {}
        self.connections: Dict[str, bool] = {}

    def connect_device(self, device_id: str, host: str, port: int, unit: int) -> bool:
        """เชื่อมต่อกับ Modbus device"""
        try:
            client = ModbusTcpClient(host=host, port=port)
            if client.connect():
                self.clients[device_id] = client
                self.connections[device_id] = True
                logger.info(f"Connected to device {device_id} at {host}:{port}")
                return True
            else:
                logger.error(f"Failed to connect to device {device_id}")
                return False
        except Exception as e:
            logger.error(f"Connection error for device {device_id}: {e}")
            return False

    def disconnect_device(self, device_id: str) -> bool:
        """ตัดการเชื่อมต่อกับ device"""
        try:
            if device_id in self.clients:
                self.clients[device_id].close()
                del self.clients[device_id]
                self.connections[device_id] = False
                logger.info(f"Disconnected from device {device_id}")
                return True
            return False
        except Exception as e:
            logger.error(f"Disconnect error for device {device_id}: {e}")
            return False
    
    def is_connected(self, device_id: str) -> bool:
        """ตรวจสอบสถานะการเชื่อมต่อ"""
        return self.connections.get(device_id, False)

    def read_register(self, device_id: str, address: int, count: int = 1, unit: int = 1) -> Optional[List[int]]:
        """อ่าน holding registers"""
        try:
            if device_id not in self.clients:
                logger.error(f"Device {device_id} not connected")
                return None
                
            client = self.clients[device_id]
            result = client.read_holding_registers(address=address, count=count, unit=unit)
            
            if result.isError():
                logger.error(f"Modbus error reading register {address}: {result}")
                return None
                
            return result.registers
            
        except ModbusException as e:
            logger.error(f"Modbus exception reading register {address}: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error reading register {address}: {e}")
            return None

    def read_float32(self, device_id: str, address: int, endian: str = "big") -> Optional[float]:
        """อ่าน float32 จาก 2 registers"""
        try:
            registers = self.read_register(device_id, address, count=2)
            if registers is None or len(registers) < 2:
                return None
                
            # แปลง registers เป็น bytes
            if endian == "big":
                # Big Endian: register1 (high) + register2 (low)
                data = struct.pack("!HH", registers[0], registers[1])
            else:
                # Little Endian: register2 (low) + register1 (high)
                data = struct.pack("!HH", registers[1], registers[0])
            
            # แปลง bytes เป็น float
            return struct.unpack("!f", data)[0]
            
        except Exception as e:
            logger.error(f"Error reading float32 at address {address}: {e}")
            return None

    def read_int16(self, device_id: str, address: int) -> Optional[int]:
        """อ่าน int16 จาก 1 register"""
        try:
            registers = self.read_register(device_id, address, count=1)
            if registers is None or len(registers) < 1:
                return None
                
            # แปลง uint16 เป็น int16
            value = registers[0]
            if value > 32767:  # ถ้าเกิน int16 max
                value = value - 65536  # แปลงเป็น negative
                
            return value
            
        except Exception as e:
            logger.error(f"Error reading int16 at address {address}: {e}")
            return None

    def test_connection(self, host: str, port: int, unit: int = 1) -> Dict:
        """ทดสอบการเชื่อมต่อ"""
        try:
            client = ModbusTcpClient(host=host, port=port)
            if client.connect():
                # ทดสอบอ่าน register 0
                result = client.read_holding_registers(0, 1, unit=unit)
                client.close()
                
                if result.isError():
                    return {
                        "success": False,
                        "message": f"Modbus error: {result}"
                    }
                else:
                    return {
                        "success": True,
                        "message": "Connection successful"
                    }
            else:
                return {
                    "success": False,
                    "message": "Failed to connect to Modbus server"
                }
                
        except Exception as e:
            return {
                "success": False,
                "message": f"Connection error: {str(e)}"
            }

    def get_client(self, device_id: str) -> Optional[ModbusTcpClient]:
        """ดึง client สำหรับ device ที่เชื่อมต่อแล้ว"""
        return self.clients.get(device_id)