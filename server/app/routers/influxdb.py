from fastapi import APIRouter, HTTPException
from app.services.influxdb_service import InfluxDBService
from datetime import datetime, timedelta
from typing import List, Optional

router = APIRouter(prefix="/api/influxdb", tags=["influxdb"])

@router.get("/data/latest/{stack_id}")
async def get_latest_data(stack_id: str):
    service = InfluxDBService()
    data = service.get_latest_data(stack_id)
    if not data:
        raise HTTPException(status_code=404, detail="Data not found")
    return data

@router.get("/data/latest")
async def get_all_latest_data():
    service = InfluxDBService()
    return service.get_all_latest_data()

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

    service = InfluxDBService()
    return service.get_aggregate_data(stack_id, hours, interval)

@router.post("/data/save/{stack_id}")
async def save_data(stack_id: str, data: dict):
    service = InfluxDBService()
    success = service.save_modbus_data(stack_id, data)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save data")
    return {"message": "Data saved successfully"}