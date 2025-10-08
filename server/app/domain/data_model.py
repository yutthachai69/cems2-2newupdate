from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class DataPoint(BaseModel):
    timestamp: datetime
    
    # ✅ Fixed fields เดิม (backward compatible)
    SO2: float = 0.0
    NOx: float = 0.0
    O2: float = 0.0
    CO: float = 0.0
    Dust: float = 0.0
    Temperature: float = 0.0
    Velocity: float = 0.0
    Flowrate: float = 0.0
    Pressure: float = 0.0
    
    # ✅ Dynamic fields สำหรับ parameters ใหม่ (HCl, NH3, SO3, ...)
    extra_params: Dict[str, float] = {}
    
    class Config:
        arbitrary_types_allowed = True
    
    def get(self, key: str, default: float = 0.0) -> float:
        """ดึงค่า parameter - ลอง fixed field ก่อน แล้วค่อยลอง extra_params"""
        # ถ้ามี fixed field ใช้ fixed
        if key in ['SO2', 'NOx', 'O2', 'CO', 'Dust', 'Temperature', 'Velocity', 'Flowrate', 'Pressure']:
            return getattr(self, key, default)
        # ไม่งั้นใช้ extra_params
        return self.extra_params.get(key, default)
    
    def set(self, key: str, value: float):
        """ตั้งค่า parameter - ถ้ามี fixed field ใช้ fixed ไม่งั้นใช้ extra_params"""
        # ถ้ามี fixed field ใช้ fixed
        if key in ['SO2', 'NOx', 'O2', 'CO', 'Dust', 'Temperature', 'Velocity', 'Flowrate', 'Pressure']:
            setattr(self, key, value)
        # ไม่งั้นใช้ extra_params
        else:
            self.extra_params[key] = value
    
    def to_dict(self) -> Dict[str, float]:
        """แปลงเป็น dict รวม fixed + extra_params"""
        result = {
            "SO2": self.SO2,
            "NOx": self.NOx,
            "O2": self.O2,
            "CO": self.CO,
            "Dust": self.Dust,
            "Temperature": self.Temperature,
            "Velocity": self.Velocity,
            "Flowrate": self.Flowrate,
            "Pressure": self.Pressure
        }
        # เพิ่ม extra_params (HCl, NH3, SO3, ...)
        result.update(self.extra_params)
        return result
    
    def keys(self):
        """คืนค่า keys ทั้งหมด (fixed + extra)"""
        return self.to_dict().keys()
    
    def items(self):
        """คืนค่า items ทั้งหมด (fixed + extra)"""
        return self.to_dict().items()

class StackData(BaseModel):
    stack_id: str
    stack_name: str
    data: DataPoint
    corrected_data: Optional[DataPoint] = None 
    status: str = "connected"

class DataResponse(BaseModel):
    success: bool
    data:Optional[List[StackData]] = None
    message:Optional[str] = None