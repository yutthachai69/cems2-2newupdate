from pydantic import BaseModel
from typing import Optional, List, Dict

class DeviceConfig(BaseModel):
    id: Optional[int] = None
    name: str
    host: str
    port: int
    unit: int
    enabled: bool = True

class MappingConfig(BaseModel):
    id: Optional[int] = None
    name: str
    unit: str
    address: int
    dataType: str = "float32"
    format: str = "AB CD"
    count: int = 2
    device: str

class GasConfig(BaseModel):
    parameter: str
    unit: str
    minValue: float
    maxValue: float
    enabled: bool = True

class SystemConfig(BaseModel):
    dataUpdateInterval: int = 1000
    maxDataPoints: int = 60
    autoSave: bool = True

class StackConfig(BaseModel):
    stackId: str
    stackName: str
    diameter: float
    height: float
    temperature: float
    pressure: float

class ThresholdConfig(BaseModel):
    parameter: str
    warningThreshold: float
    dangerThreshold: float

class DeviceCreate(BaseModel):
    name: str
    mode: str = "TCP"
    host: str
    port: int = 502
    unit: int = 1

class DeviceUpdate(BaseModel):
    name: Optional[str] = None
    mode: Optional[str] = None
    host: Optional[str] = None
    port: Optional[int] = None
    unit: Optional[int] = None

class MappingCreate(BaseModel):
    name: str
    unit: str
    address: int
    dataType: str = "float32"
    format: str = "AB CD"
    count: int = 2
    device: str

class GasSettings(BaseModel):
    key: str
    display: str
    unit: str
    enabled: bool = True
    min: float = 0
    max: float = 100
    alarm: float = 80

class SystemParams(BaseModel):
    logInterval: int = 1
    reconnectInterval: int = 5
    temperatureThreshold: float = 80
    pressureThreshold: float = 1000
    velocityThreshold: float = 30
    stackArea: float = 1.0
    stackDiameter: float = 1.0
    stackShape: str = "circular"
    stackCircumference: Optional[float] = None
    stackWidth: Optional[float] = None
    stackLength: Optional[float] = None

class Threshold(BaseModel):
    SO2: Dict[str, float]
    NOx: Dict[str, float]
    O2: Dict[str, float]
    CO: Dict[str, float]
    Dust: Dict[str, float]
    Temperature: Dict[str, float]
    Velocity: Dict[str, float]
    Flowrate: Dict[str, float]
    Pressure: Dict[str, float]

class ThresholdConfig(BaseModel):
    parameter: str
    unit: str
    warningThreshold: float
    dangerThreshold: float
    enabled: bool = True