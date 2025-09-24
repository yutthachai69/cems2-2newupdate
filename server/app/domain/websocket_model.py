from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime

class WebSocketMessage(BaseModel):
    type: str
    data: Dict[str, Any]
    timestamp: datetime

class DataMessage(BaseModel):
    type: str = "data"
    data: list  # List of StackData
    timestamp: datetime

class StatusMessage(BaseModel):
    status: str
    message: Optional[str] = None
    timestamp: datetime