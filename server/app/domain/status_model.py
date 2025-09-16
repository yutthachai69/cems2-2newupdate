from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class StatusItem(BaseModel):
    id: str
    name: str
    status: str
    category: str
    description: Optional[str] = None
    last_updated: datetime

class AlarmItem(BaseModel):
    id: str
    message: str
    severity: str
    timestamp: datetime
    acknowledged: bool = False

class StatusResponse(BaseModel):
    system_status: str
    active_alarms: int
    statuses: List[StatusItem]
    alarms: List[AlarmItem]