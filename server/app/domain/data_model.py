from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class DataPoint(BaseModel):
    timestamp: datetime
    SO2: float
    NOx: float
    O2: float
    CO: float
    Dust: float
    Temperature: float
    Velocity: float
    Flowrate: float
    Pressure: float

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