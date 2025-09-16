from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class BlowbackSettings(BaseModel):
    enable: bool = True
    interval_minutes: int = 30
    duration_seconds: int = 60
    pressure_threshold: float = 100.0
    auto_mode: bool = False

class BlowbackStatus(BaseModel):
    is_running: bool = False
    last_run: Optional[datetime] = None
    next_run: Optional[datetime] = None
    current_pressure: float = 0.0
    status_message: str = "Ready"

class BlowbackRequest(BaseModel):
    action: str 
    duration_seconds: Optional[int] = None