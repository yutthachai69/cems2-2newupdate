from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class DataPoint(BaseModel):
    timestamp: datetime
    # Dynamic fields - ใช้ Dict เพื่อรองรับ parameters ที่เพิ่มใหม่
    data: Dict[str, float] = {}
    
    # Backward compatibility - ยังคงมี fields เดิม
    SO2: float = 0.0
    NOx: float = 0.0
    O2: float = 0.0
    CO: float = 0.0
    Dust: float = 0.0
    Temperature: float = 0.0
    Velocity: float = 0.0
    Flowrate: float = 0.0
    Pressure: float = 0.0
    
    def __init__(self, **data):
        super().__init__(**data)
        # อัปเดต data dict จาก fields
        for field_name, field_value in data.items():
            if field_name != 'timestamp' and field_name != 'data':
                self.data[field_name] = field_value

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