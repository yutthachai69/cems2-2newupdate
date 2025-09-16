from pydantic import BaseModel
from typing import Optional, Dict
from datetime import datetime

class SystemInfo(BaseModel):
    version: str
    uptime: str
    memory_usage: float
    cpu_usage: float
    disk_usage: float
    last_update: datetime

class HealthStatus(BaseModel):
    status: str
    services: Dict[str, str]
    last_check: datetime
    message: Optional[str] = None