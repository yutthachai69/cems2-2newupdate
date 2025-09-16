from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.exc import SQLAlchemyError
from app.models.sqlite_models import *
from typing import Optional, List, Dict
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

class SQLiteService:
    def __init__(self, db_path: str = "cems.db"):
        self.db_path = db_path
        self.engine = create_engine(f"sqlite:///{db_path}", echo=False)
        self.Session = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)

        # create tables
        Base.metadata.create_all(bind=self.engine)
    
    def get_db(self) -> Session:
        db = self.Session()
        try:
            return db
        finally:
            pass

    def close_db(self, db: Session):
        db.close()

    # CEMS Data operations
    def save_cems_data(self, data: Dict) -> bool:
        db = self.get_db()
        try:
            cems_record = CEMSData(**data)
            db.add(cems_record)
            db.commit()
            return True
        except SQLAlchemyError as e:
            logger.error(f"Error saving cems data: {e}")
            db.rollback()
            return False
        finally:
            self.close_db(db)

    def get_latest_data(self, stack_id: str = "stack1") -> Optional[Dict]:
        db = self.get_db()
        try:
            result = db.query(CEMSData).filter(
                CEMSData.stack_id == stack_id
            ).order_by(CEMSData.timestamp.desc()).first()

            if result:
                return {
                    "stack_id": result.stack_id,
                    "stack_name": result.stack_name,
                    "data": {
                        "timestamp": result.timestamp,
                        "SO2": result.SO2,
                        "NOx": result.NOx,
                        "O2": result.O2,
                        "CO": result.CO,
                        "Dust": result.Dust,
                        "Temperature": result.Temperature,
                        "Velocity": result.Velocity,
                        "Flowrate": result.Flowrate,
                        "Pressure": result.Pressure
                    },
                    "corrected_data": {
                        "timestamp": result.timestamp,
                        "SO2": result.SO2Corr,
                        "NOx": result.NOxCorr,
                        "O2": result.O2,
                        "CO": result.COCorr,
                        "Dust": result.DustCorr,
                        "Temperature": result.Temperature,
                        "Velocity": result.Velocity,
                        "Flowrate": result.Flowrate,
                        "Pressure": result.Pressure
                    },
                    "status": result.status,
                }
            return None
        except SQLAlchemyError as e:
            logger.error(f"Error getting latest cems data: {e}")
            return None
        finally:
            self.close_db(db)

    def get_data_range(self, start_date: Optional[datetime] = None, end_date: Optional[datetime] = None,
                       stack_id: Optional[str] = None, limit: int = 1000) -> List[Dict]:
        db = self.get_db()
        try:
            query = db.query(CEMSData)
            
            # เพิ่มเงื่อนไขกรองตามวันที่ถ้ามี
            if start_date:
                query = query.filter(CEMSData.timestamp >= start_date)
            if end_date:
                query = query.filter(CEMSData.timestamp <= end_date)
            if stack_id:
                query = query.filter(CEMSData.stack_id == stack_id)
                
            result = query.order_by(CEMSData.timestamp.desc()).limit(limit).all()

            return [{
                "timestamp": r.timestamp,
                "stack_id": r.stack_id,
                "SO2": r.SO2,
                "NOx": r.NOx,
                "O2": r.O2,
                "CO": r.CO,
                "Dust": r.Dust,
                "Temperature": r.Temperature,
                "Velocity": r.Velocity,
                "Flowrate": r.Flowrate,
                "Pressure": r.Pressure
            } for r in result]
        except SQLAlchemyError as e:
            logger.error(f"Error getting cems data range: {e}")
            return []
        finally:
            self.close_db(db)

    def search_data(self, start_date: Optional[datetime] = None, end_date: Optional[datetime] = None,
                   search_column: Optional[str] = None, search_value: Optional[str] = None,
                   stack_id: Optional[str] = None, limit: int = 1000) -> List[Dict]:
        """Search CEMS data with text search filters"""
        db = self.get_db()
        try:
            query = db.query(CEMSData)
            
            # Date filters
            if start_date:
                query = query.filter(CEMSData.timestamp >= start_date)
            if end_date:
                query = query.filter(CEMSData.timestamp <= end_date)
            if stack_id:
                query = query.filter(CEMSData.stack_id == stack_id)
            
            # Text search filters
            if search_column:
                if search_column == "all" and search_value:
                    # Search in all text columns
                    search_filter = db.or_(
                        CEMSData.SO2.like(f"%{search_value}%"),
                        CEMSData.NOx.like(f"%{search_value}%"),
                        CEMSData.O2.like(f"%{search_value}%"),
                        CEMSData.CO.like(f"%{search_value}%"),
                        CEMSData.Dust.like(f"%{search_value}%"),
                        CEMSData.Temperature.like(f"%{search_value}%"),
                        CEMSData.Velocity.like(f"%{search_value}%"),
                        CEMSData.Flowrate.like(f"%{search_value}%"),
                        CEMSData.Pressure.like(f"%{search_value}%")
                    )
                    query = query.filter(search_filter)
                elif search_column != "all":
                    # Search in specific column
                    column_map = {
                        "SO2": CEMSData.SO2,
                        "NOx": CEMSData.NOx,
                        "O2": CEMSData.O2,
                        "CO": CEMSData.CO,
                        "Dust": CEMSData.Dust,
                        "Temperature": CEMSData.Temperature,
                        "Velocity": CEMSData.Velocity,
                        "Flowrate": CEMSData.Flowrate,
                        "Pressure": CEMSData.Pressure
                    }
                    if search_column in column_map:
                        if search_value:
                            # มีคำค้น - ค้นหาตามคำค้น
                            query = query.filter(column_map[search_column].like(f"%{search_value}%"))
                        else:
                            # ไม่มีคำค้น - แสดงข้อมูลทั้งหมดในคอลัมน์นั้น (กรองเฉพาะคอลัมน์)
                            # กรองให้แสดงเฉพาะข้อมูลที่มีค่าในคอลัมน์นั้น (ไม่เป็น null)
                            query = query.filter(column_map[search_column].isnot(None))
                
            result = query.order_by(CEMSData.timestamp.desc()).limit(limit).all()
            
            # Debug log
            print(f"DEBUG: search_column={search_column}, search_value='{search_value}', result_count={len(result)}")

            return [{
                "timestamp": r.timestamp,
                "stack_id": r.stack_id,
                "SO2": r.SO2,
                "NOx": r.NOx,
                "O2": r.O2,
                "CO": r.CO,
                "Dust": r.Dust,
                "Temperature": r.Temperature,
                "Velocity": r.Velocity,
                "Flowrate": r.Flowrate,
                "Pressure": r.Pressure
            } for r in result]
        except SQLAlchemyError as e:
            logger.error(f"Error searching cems data: {e}")
            return []
        finally:
            self.close_db(db)

    # Device Config operations
    def save_device_config(self, device_data: Dict) -> bool:
        db = self.get_db()
        try:
            device_record = DeviceConfig(**device_data)
            db.add(device_record)
            db.commit()
            return True
        except SQLAlchemyError as e:
            logger.error(f"Error saving device config: {e}")
            db.rollback()
            return False
        finally:
            self.close_db(db)

    def get_device_configs(self) -> List[Dict]:
        db = self.get_db()
        try:
            devices = db.query(DeviceConfig).all()
            return [{
                "id": d.id,
                "name": d.name,
                "host": d.host,
                "port": d.port,
                "unit": d.unit,
                "mode": d.mode,
                "enabled": d.enabled
            } for d in devices]
        except SQLAlchemyError as e:
            logger.error(f"Error getting device configs: {e}")
            return []
        finally:
            self.close_db(db)

    # Mapping Config operations
    def save_mapping_config(self, mapping_data: Dict) -> bool:
        db = self.get_db()
        try:
            mapping = MappingConfig(**mapping_data)
            db.add(mapping)
            db.commit()
            return True
        except SQLAlchemyError as e:
            logger.error(f"Error saving mapping config: {e}")
            db.rollback()
            return False
        finally:
            self.close_db(db)

    def get_mapping_configs(self) -> List[Dict]:
        db = self.get_db()
        try:
            mappings = db.query(MappingConfig).all()
            return [{
                "id": m.id,
                "name": m.name,
                "unit": m.unit,
                "address": m.address,
                "dataType": m.data_type,
                "format": m.format,
                "count": m.count,
                "device": m.device_name,
                "enabled": m.enabled
            } for m in mappings]
        except SQLAlchemyError as e:
            logger.error(f"Error getting mapping configs: {e}")
            return []
        finally:
            self.close_db(db)

    # System Log operations
    def log_system_event(self, level: str, message: str, source: str = None, stack_id: str = None):
        """บันทึก log ระบบ"""
        db = self.get_db()
        try:
            log_entry = SystemLog(
                level=level,
                message=message,
                source=source,
                stack_id=stack_id
            )
            db.add(log_entry)
            db.commit()
        except SQLAlchemyError as e:
            logger.error(f"Error logging system event: {e}")
            db.rollback()
        finally:
            self.close_db(db)

    def get_system_logs(self, start_date: datetime = None, end_date: datetime = None,
                       level: str = None, limit: int = 1000) -> List[Dict]:
        db = self.get_db()
        try:
            query = db.query(SystemLog)

            if start_date:
                query = query.filter(SystemLog.timestamp >= start_date)
            if end_date:
                query = query.filter(SystemLog.timestamp <= end_date)
            if level:
                query = query.filter(SystemLog.level == level)

            logs = query.order_by(SystemLog.timestamp.desc()).limit(limit).all()

            return [{
                "timestamp": l.timestamp,
                "level": l.level,
                "message": l.message,
                "source": l.source,
                "stack_id": l.stack_id
            } for l in logs]
        except SQLAlchemyError as e:
            logger.error(f"Error getting system logs: {e}")
            return []
        finally:
            self.close_db(db)
