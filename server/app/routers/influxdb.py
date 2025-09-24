from fastapi import APIRouter, HTTPException, Query
from app.services.influxdb_service import InfluxDBService
from datetime import datetime, timedelta
from typing import List, Optional

router = APIRouter(prefix="/api/influxdb", tags=["influxdb"])

@router.get("/data/latest/{stack_id}")
async def get_latest_cems_data(stack_id: str):
    """ดึงข้อมูล CEMS ล่าสุดจาก InfluxDB"""
    service = InfluxDBService()
    data = service.get_latest_cems_data(stack_id)
    if not data:
        raise HTTPException(status_code=404, detail="Data not found")
    return {"success": True, "data": data}

@router.get("/data/latest")
async def get_all_latest_data():
    """ดึงข้อมูลล่าสุดของทุก stack"""
    service = InfluxDBService()
    data = service.get_all_latest_data()
    return {"success": True, "data": data}

@router.get("/data/range")
async def get_data_range(
    start_time: Optional[datetime] = Query(None, description="Start time (ISO format)"),
    end_time: Optional[datetime] = Query(None, description="End time (ISO format)"),
    stack_id: Optional[str] = Query(None, description="Stack ID to filter"),
    limit: int = Query(1000, description="Maximum number of records")
):
    """ดึงข้อมูลในช่วงเวลาที่กำหนด"""
    service = InfluxDBService()
    data = service.get_cems_data_range(start_time, end_time, stack_id, limit)
    return {"success": True, "data": data, "count": len(data)}

@router.get("/data/search")
async def search_data(
    start_time: Optional[datetime] = Query(None, description="Start time (ISO format)"),
    end_time: Optional[datetime] = Query(None, description="End time (ISO format)"),
    search_column: Optional[str] = Query(None, description="Column to search in"),
    search_value: Optional[str] = Query(None, description="Value to search for"),
    stack_id: Optional[str] = Query(None, description="Stack ID to filter"),
    limit: int = Query(1000, description="Maximum number of records")
):
    """ค้นหาข้อมูล"""
    service = InfluxDBService()
    data = service.search_cems_data(start_time, end_time, search_column, search_value, stack_id, limit)
    return {"success": True, "data": data, "count": len(data)}

@router.get("/data/aggregated")
async def get_aggregated_data(
    stack_id: str = Query(..., description="Stack ID"),
    hours: int = Query(24, description="Number of hours to aggregate"),
    interval: str = Query("1h", description="Aggregation interval (1h, 30m, etc.)")
):
    """ดึงข้อมูลที่รวมแล้ว (aggregated)"""
    service = InfluxDBService()
    data = service.get_aggregated_data(stack_id, hours, interval)
    return {"success": True, "data": data, "count": len(data)}

@router.get("/test-connection")
async def test_connection():
    """ทดสอบการเชื่อมต่อ InfluxDB"""
    service = InfluxDBService()
    is_connected = service.test_connection()
    if is_connected:
        return {"success": True, "message": "InfluxDB connection successful"}
    else:
        raise HTTPException(status_code=500, detail="InfluxDB connection failed")

@router.get("/data/history/{stack_id}")
async def get_historical_data(stack_id: str, hours: int = 24):
    service = InfluxDBService()
    return service.get_historical_data(stack_id, hours)

@router.get("/data/range/{stack_id}")
async def get_data_by_range(
    stack_id: str,
    start_time: str,
    end_time: str
):

    try:
        start_dt = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
        end_dt = datetime.fromisoformat(end_time.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid time format")
    
    service = InfluxDBService()
    return service.get_data_by_range(stack_id, start_dt, end_dt)

@router.get("/data/aggregate/{stack_id}")
async def get_aggregate_data(
    stack_id: str,
    hours: int = 24,
    interval: str = "1h"
):
    """ดึงข้อมูลแบบ aggregated จาก InfluxDB"""
    try:
        service = InfluxDBService()
        data = service.get_aggregated_data(stack_id, hours, interval)
        return {"success": True, "data": data, "count": len(data)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting aggregate data: {str(e)}")

@router.post("/data/save/{stack_id}")
async def save_data(stack_id: str, data: dict):
    service = InfluxDBService()
    success = service.save_modbus_data(stack_id, data)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save data")
    return {"message": "Data saved successfully"}