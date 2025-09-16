from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import create_engine
from datetime import datetime

Base = declarative_base()

class CEMSData(Base):
    __tablename__ = "cems_data"
    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, default=datetime.now)
    stack_id = Column(String(50), nullable=False)
    stack_name = Column(String(100))

    SO2 = Column(Float, default=0.0)
    NOx = Column(Float, default=0.0)
    O2 = Column(Float, default=0.0)
    CO = Column(Float, default=0.0)
    Dust = Column(Float, default=0.0)
    Temperature = Column(Float, default=0.0)
    Velocity = Column(Float, default=0.0)
    Flowrate = Column(Float, default=0.0)
    Pressure = Column(Float, default=0.0)

    # corrected data
    SO2Corr = Column(Float, default=0.0)
    NOxCorr = Column(Float, default=0.0)
    COCorr = Column(Float, default=0.0)
    DustCorr = Column(Float, default=0.0)

    # status
    status = Column(String(50), default="connected")
    device_name = Column(String(100))

class DeviceConfig(Base):
    __tablename__ = "device_configs"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), unique=True, nullable=False)
    host = Column(String(50), nullable=False)
    port = Column(Integer, nullable=False)
    unit = Column(Integer, nullable=False)
    mode = Column(String(50), default="TCP")
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

class MappingConfig(Base):
    __tablename__ = "mapping_configs"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    unit = Column(String(20), nullable=False)
    address = Column(Integer, nullable=False)
    data_type = Column(String(20), default="float32")
    format = Column(String(20), default="AB CD")
    count = Column(Integer, default=2)
    device_name = Column(String(100), nullable=False)
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

class SystemLog(Base):
    __tablename__ = "system_logs"
    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, default=datetime.now)
    level = Column(String(20), nullable=False)
    message = Column(Text, nullable=False)
    source = Column(String(100))
    stack_id = Column(String(50))