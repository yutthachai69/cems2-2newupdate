from pymodbus.client import ModbusTcpClient
from pymodbus.payload import BinaryPayloadDecoder
from pymodbus.constants import Endian

class ModbusClient:
    def __init__(self, host="127.0.0.1", port=502, unit=1):
        self.client = ModbusTcpClient(host, port)
        self.unit = unit

    def connect(self):
        return self.client.connect()

    def read_value(self, address: int, data_type: str):
        if data_type == 'float32':
            # ต้องอ่าน 2 registers สำหรับ float32
            count = 2
            resp = self.client.read_holding_registers(address=address, count=count, unit=self.unit)
            if resp.isError():
                return None
            
            decoder = BinaryPayloadDecoder.fromRegisters(resp.registers, Endian.Big, Endian.Little)
            return decoder.decode_32bit_float()
        
        elif data_type == 'int16':
            # อ่าน 1 register สำหรับ int16
            count = 1
            resp = self.client.read_holding_registers(address=address, count=count, unit=self.unit)
            if resp.isError():
                return None
            
            return resp.registers[0]
        
        # สามารถเพิ่มเงื่อนไขสำหรับ data_type อื่นๆ ได้
        else:
            print("Unsupported data type")
            return None

# ตัวอย่างการใช้งาน
client = ModbusClient()
if client.connect():
    # อ่านค่า float32 จาก address 0
    temperature = client.read_value(address=0, data_type='float32')
    print(f"Temperature (Float32): {temperature}")

    # อ่านค่า int16 จาก address 2
    status_code = client.read_value(address=2, data_type='int16')
    print(f"Status (Int16): {status_code}")

    client.close()