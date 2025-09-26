from pydantic import BaseModel, field_validator
from typing import Optional, List, Union, Dict
from datetime import datetime

class LogEntry(BaseModel):
    id: str
    timestamp: datetime
    stack_id: str
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
            if field_name not in ['id', 'timestamp', 'stack_id', 'data']:
                self.data[field_name] = field_value

class LogFilter(BaseModel):
    start_date: Optional[Union[datetime, str]] = None
    end_date: Optional[Union[datetime, str]] = None
    stack_id: Optional[str] = None
    limit: int = 1000
    
    @field_validator('start_date', 'end_date', mode='before')
    @classmethod
    def parse_date(cls, v):
        if v is None:
            return None
        if isinstance(v, datetime):
            return v
        if isinstance(v, str):
            # Try different date formats
            try:
                # Format: "2/2/2568" -> "2025-02-02"
                if '/' in v:
                    parts = v.split('/')
                    if len(parts) == 3:
                        day, month, year = parts
                        # Convert Buddhist year to Christian year
                        christian_year = int(year) - 543
                        return datetime(christian_year, int(month), int(day))
                # ISO format: "2025-02-02"
                return datetime.fromisoformat(v.replace('Z', '+00:00'))
            except:
                return None
        return None

class LogResponse(BaseModel):
    logs: List[LogEntry]
    total_count: int
    filtered_count: int
    