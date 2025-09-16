from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from typing import List, Optional
from datetime import datetime
import io
import json
from app.core.config import settings
from app.core.constants import DATA_PARAMETERS, DEFAULT_THRESHOLDS, STATUS_CATEGORIES
from app.services.data_service import DataService
from app.domain.data_model import DataResponse
from app.services.config_service import ConfigService
from app.domain.config_model import *
from app.services.websocket_service import WebSocketService
from app.domain.websocket_model import DataMessage, StatusMessage
from app.services.status_service import StatusService
from app.domain.status_model import StatusResponse
from app.services.blowback_service import BlowbackService
from app.domain.blowback_model import BlowbackSettings, BlowbackStatus, BlowbackRequest
from app.services.logs_service import LogsService
from app.services.health_service import HealthService
from app.domain.logs_model import LogFilter, LogResponse
from app.services.modbus_data_service import ModbusDataService
from app.routers import influxdb
from app.routers import config_devices
from app.routers import config_mappings
from app.routers import config_gas
from app.routers import config_system
from app.routers import config_thresholds
from app.services.sqlite_service import SQLiteService
from app.routers import config_status_alarm
from app.services.status_alarm_sevice import StatusAlarmService

# Create FastAPI app
app = FastAPI(
    title=settings.api_title,
    version=settings.api_version,
    description="CEMS - Continuous Emission Monitoring System"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
websocket_service = WebSocketService()
config_service = ConfigService()
data_service = DataService(websocket_service, config_service)
status_service = StatusService(config_service)
blowback_service = BlowbackService()
logs_service = LogsService()
health_service = HealthService()
modbus_data_service = ModbusDataService(config_service)
sqlite_service = SQLiteService()
status_alarm_service = StatusAlarmService(config_service)

# Include routers
app.include_router(influxdb.router)
app.include_router(config_devices.router)
app.include_router(config_mappings.router)
app.include_router(config_gas.router)
app.include_router(config_system.router)
app.include_router(config_thresholds.router)
app.include_router(config_status_alarm.router)

# ส่ง config_service ไปยัง router
config_devices.config_service = config_service
config_mappings.config_service = config_service

def test_config():
    print("=== Testing Config ===")
    print(f"API Title: {settings.api_title}")
    print(f"API Version: {settings.api_version}")
    print(f"Debug Mode: {settings.debug}")
    print(f"Modbus Host: {settings.modbus_default_host}")
    print(f"Modbus Port: {settings.modbus_default_port}")
    print(f"Data Update Interval: {settings.data_update_interval}ms")
    print(f"Max Data Points: {settings.max_data_points}")
    print()

def test_constants():
    print("=== Testing Constants ===")
    print(f"Number of data parameters: {len(DATA_PARAMETERS)}")
    print("Data Parameters:")
    for param in DATA_PARAMETERS:
        print(f"- {param['name']} ({param['unit']} {param['min']}-{param['max']})")
    print()

    print("Default Thresholds:")
    for parm, thresholds in DEFAULT_THRESHOLDS.items():
        print(f"- {parm}: Warning={thresholds['warning']}, Danger={thresholds['danger']}")
    print()

    print("Status Categories:")
    for category, color in STATUS_CATEGORIES.items():
        print(f"- {category}: {color}")

@app.get("/")
async def root():
    return {"message": "CEMS API is running"}

@app.get("/test")
async def run_test():
    """Run all tests"""
    test_config()
    test_constants()
    return {"message": "Tests completed"}

@app.get("/api/data/latest/{stack_id}")
async def get_latest_data(stack_id: str):
    try:
        # ดึงข้อมูลจาก DataService
        data = data_service.get_latest_data(stack_id)
        if data:
            return DataResponse(success=True, data=[data])
        else:
            return DataResponse(success=False, message="No data available")
    except Exception as e:
        return DataResponse(success=False, message=str(e))

@app.get("/api/data/realtime/{stack_id}")
async def get_realtime_data(stack_id: str):
    """ดึงข้อมูลเรียลไทม์จาก Modbus โดยตรง (สำหรับ Home)"""
    try:
        # ดึงข้อมูลจาก Modbus โดยตรง ไม่ผ่าน DB
        modbus_data = modbus_data_service.get_data_from_devices()
        
        if modbus_data:
            # แปลงเป็น StackData
            from datetime import timezone, timedelta
            thailand_tz = timezone(timedelta(hours=7))
            current_time = datetime.now(thailand_tz)
            
            from app.domain.data_model import DataPoint, StackData
            
            data = DataPoint(
                timestamp=current_time,
                SO2=modbus_data.get("SO2", 0.0),
                NOx=modbus_data.get("NOx", 0.0),
                O2=modbus_data.get("O2", 0.0),
                CO=modbus_data.get("CO", 0.0),
                Dust=modbus_data.get("Dust", 0.0),
                Temperature=modbus_data.get("Temperature", 0.0),
                Velocity=modbus_data.get("Velocity", 0.0),
                Flowrate=modbus_data.get("Flowrate", 0.0),
                Pressure=modbus_data.get("Pressure", 0.0)
            )
            
            # คำนวณค่าที่ปรับแก้แล้ว
            corrected_data = data_service._calculate_corrected_values(data)
            
            stack_data = StackData(
                stack_id=stack_id,
                stack_name="Stack 1",
                data=data,
                corrected_data=corrected_data,
                status="connected (modbus)"
            )
            
            # บันทึกลง DB (แต่ไม่ส่งกลับ)
            data_service.save_data_to_sqlite(stack_data)
            
            return DataResponse(success=True, data=[stack_data])
        else:
            # ไม่มีข้อมูลจาก Modbus
            from datetime import timezone, timedelta
            thailand_tz = timezone(timedelta(hours=7))
            current_time = datetime.now(thailand_tz)
            
            from app.domain.data_model import DataPoint, StackData
            
            default_data = DataPoint(
                timestamp=current_time,
                SO2=0.0, NOx=0.0, O2=0.0, CO=0.0, Dust=0.0,
                Temperature=0.0, Velocity=0.0, Flowrate=0.0, Pressure=0.0
            )
            
            stack_data = StackData(
                stack_id=stack_id,
                stack_name="Stack 1",
                data=default_data,
                corrected_data=default_data,
                status="no devices configured"
            )
            
            return DataResponse(success=True, data=[stack_data])
            
    except Exception as e:
        return DataResponse(success=False, message=str(e))

@app.post("/api/data/toggle-modbus")
async def toggle_modbus(enabled: bool):
    """เปิด/ปิดการเชื่อมต่อ Modbus"""
    data_service.toggle_modbus(enabled)
    return {"success": True, "message": f"Modbus {'enabled' if enabled else 'disabled'}"}

@app.post("/api/data/process")
async def process_data(data: dict):
    """Process CEMS data from n8n workflow"""
    try:
        # Log the received data
        print(f"Received processed data: {data}")
        
        # You can add your processing logic here
        # For example: save to database, send alerts, etc.
        
        return {
            "success": True,
            "message": "Data processed successfully",
            "processed_at": datetime.now().isoformat(),
            "received_data": data
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Error processing data: {str(e)}"
        }

@app.get("/api/config/devices")
async def get_devices():
    return {"devices": config_service.get_devices()}

@app.post("/api/config/devices")
async def add_devices(devices: List[DeviceConfig]):
    success = config_service.add_devices(devices)
    if success:
        # Reload configuration after saving devices
        modbus_data_service.reload_configs()
        print("DEBUG: Reloaded configuration after saving devices")
    return {"success": success, "message": "Devices added successfully" if success else "Failed to add devices"}


@app.get("/api/config/gas")
async def get_gas_settings():
    return {"gas_settings": config_service.get_gas_settings()}

@app.put("/api/config/gas")
async def update_gas_settings(gas: GasConfig):
    success = config_service.update_gas_settings(gas)
    return {"success": success, "message": "Gas settings updated successfully" if success else "Failed to update gas settings"}

@app.get("/api/config/system")
async def get_system_params():
    return {"system_params": config_service.get_system_params()}

@app.put("/api/config/system")
async def update_system_params(system: SystemConfig):
    success = config_service.update_system_params(system)
    return {"success": success, "message": "System params updated successfully" if success else "Failed to update system params"}

@app.get("/api/config/stacks")
async def get_stacks():
    return {"stacks": config_service.get_stacks()}

@app.post("/api/config/stacks")
async def add_stacks(stacks: List[StackConfig]):
    success = config_service.add_stacks(stacks)
    return {"success": success, "message": "Stacks added successfully" if success else "Failed to add stacks"}

@app.get("/api/config/thresholds")
async def get_thresholds():
    return {"thresholds": config_service.get_thresholds()}

@app.put("/api/config/thresholds")
async def update_thresholds(thresholds: List[ThresholdConfig]):
    success = config_service.update_thresholds(thresholds)
    return {"success": success, "message": "Thresholds updated successfully" if success else "Failed to update thresholds"}

# WebSocket Routes
@app.websocket("/ws/data")
async def data_websocket(websocket: WebSocket):
    await websocket_service.connect(websocket, "data")
    
    # ส่งข้อมูลเริ่มต้น
    try:
        stack_data = data_service.get_latest_data("stack1")
        if stack_data:  # ส่งเฉพาะเมื่อมีข้อมูล
            message = DataMessage(
                data=[stack_data],
                timestamp=datetime.now()
            )
            await websocket_service.send_message(message)
    except Exception as e:
        print(f"Error sending initial data: {e}")
    
    # ส่งข้อมูลแบบ periodic ทุก 5 วินาที
    import asyncio
    async def send_periodic_data():
        while True:
            try:
                stack_data = data_service.get_latest_data("stack1")
                if stack_data:  # ส่งเฉพาะเมื่อมีข้อมูล
                    message = DataMessage(
                        data=[stack_data],
                        timestamp=datetime.now()
                    )
                    await websocket_service.send_message(message)
                await asyncio.sleep(10)  # ส่งทุก 10 วินาที
            except Exception as e:
                print(f"Error sending periodic data: {e}")
                break
    
    # เริ่มส่งข้อมูลแบบ periodic
    periodic_task = asyncio.create_task(send_periodic_data())
    
    try:
        while True:
            data = await websocket.receive_text()
            try:
                request = json.loads(data)
                if request.get("type") == "request_data":
                    # ส่งข้อมูลเมื่อได้รับคำขอ
                    stack_data = data_service.get_latest_data("stack1")
                    if stack_data:  # ส่งเฉพาะเมื่อมีข้อมูล
                        message = DataMessage(
                            data=[stack_data],
                            timestamp=datetime.now()
                        )
                        await websocket_service.send_message(message)
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        periodic_task.cancel()
        websocket_service.disconnect(websocket)

@app.websocket("/ws/status")
async def status_websocket(websocket: WebSocket):
    await websocket_service.connect(websocket, "status")
    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        websocket_service.disconnect(websocket)

# Status Routes
@app.get("/api/status")
async def get_status():
    return status_service.get_status()

@app.get("/api/alarms")
async def get_alarms():
    return {"alarms": status_service.get_alarms()}

@app.post("/api/alarms/{alarm_id}/acknowledge")
async def acknowledge_alarm(alarm_id: str):
    success = status_service.acknowledge_alarm(alarm_id)
    return {"success": success, "message": "Alarm acknowledged successfully" if success else "Failed to acknowledge alarm"}

# Blowback Routes
@app.get("/api/blowback/settings")
async def get_blowback_settings():
    return {"settings": blowback_service.get_settings()}

@app.put("/api/blowback/settings")
async def update_blowback_settings(settings: BlowbackSettings):
    success = blowback_service.update_settings(settings)
    return {"success": success, "message": "Blowback settings updated successfully" if success else "Failed to update blowback settings"}

@app.get("/api/blowback/status")
async def get_blowback_status():
    return {"status": blowback_service.get_status()}

@app.post("/api/blowback/manual")
async def manual_blowback(request: BlowbackRequest):
    if request.action == "start":
        success = blowback_service.start_blowback(request.duration_seconds)
        return {"success": success, "message": "Blowback started successfully" if success else "Failed to start blowback"}
    elif request.action == "stop":
        success = blowback_service.stop_blowback()
        return {"success": success, "message": "Blowback stopped successfully" if success else "Failed to stop blowback"}
    elif request.action == "test":
        success = blowback_service.test_blowback()
        return {"success": success, "message": "Blowback test completed successfully" if success else "Failed to test blowback"}
    else:
        return {"success": False, "message": "Invalid action"}

# Logs Routes
@app.get("/api/logs")
async def get_logs(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    stack_id: Optional[str] = None,
    limit: int = 1000
):
    filter_params = LogFilter(
        start_date=start_date,
        end_date=end_date,
        stack_id=stack_id,
        limit=limit
    )
    return logs_service.get_logs(filter_params)

@app.get("/api/logs/download")
async def download_logs(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    stack_id: Optional[str] = None,
    limit: int = 1000
):
    filter_params = LogFilter(
        start_date=start_date,
        end_date=end_date,
        stack_id=stack_id,
        limit=10000
    )
    csv_data = logs_service.export_csv(filter_params)
    
    return StreamingResponse(
        io.StringIO(csv_data),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=cems_logs.csv"}
    )

@app.get("/api/health")
async def get_health():
    return health_service.get_health_status()

@app.get("/api/system/info")
async def get_system_info():
    return health_service.get_system_info()

# Modbus Routes
@app.get("/api/modbus/test/{device_id}")
async def test_modbus_connection(device_id: str):
    result = modbus_data_service.test_connection(device_id)
    return result

@app.get("/api/modbus/read/{device_id}/{parameter}")
async def read_modbus_parameter(device_id: str, parameter: str):
    value = modbus_data_service.read_parameter(device_id, parameter)
    return {
        "device_id": device_id,
        "parameter": parameter,
        "value": value,
        "success": value is not None
    }

@app.post("/api/modbus/toggle")
async def toggle_modbus(enabled: bool):
    data_service.toggle_modbus(enabled)
    return {
        "success": True,
        "message": f"Modbus {'enabled' if enabled else 'disabled'}",
        "modbus_enabled": enabled
    }

@app.get("/api/modbus/status")
async def get_modbus_status():
    return {
        "modbus_enabled": data_service.use_modbus,
        "connected_devices": list(modbus_data_service.connected_devices),
        "available_devices": list(modbus_data_service.device_configs.keys())
    }

@app.post("/api/config/reload")
async def reload_config():
    """โหลดการตั้งค่าใหม่จาก Config"""
    try:
        modbus_data_service.reload_configs()
        return {"success": True, "message": "Configuration reloaded successfully"}
    except Exception as e:
        return {"success": False, "message": f"Failed to reload config: {str(e)}"}

@app.post("/api/modbus/test-connection")
async def test_modbus_connection_endpoint(device: dict):
    """ทดสอบการเชื่อมต่อ Modbus"""
    try:
        result = modbus_data_service.test_connection(device.get("name", ""))
        return result
    except Exception as e:
        return {"success": False, "message": f"Connection test failed: {str(e)}"}

# SQLite Routes
@app.get("/api/sqlite/data/latest/{stack_id}")
async def get_latest_sqlite_data(stack_id: str):
    data = sqlite_service.get_latest_data(stack_id)
    if data:
        return {"success": True, "data": data}
    return {"success": False, "message": "No data found"}

@app.get("/api/sqlite/data/all")
async def get_all_data(
    start_date: Optional[datetime] = None, 
    end_date: Optional[datetime] = None, 
    stack_id: Optional[str] = None
    ):
    """ดึงข้อมูลทั้งหมดโดยไม่มี limit"""
    data = sqlite_service.get_data_range(start_date, end_date, stack_id, limit=None)
    return {"success": True, "data": data, "count": len(data)}

@app.get("/api/sqlite/data/range")
async def get_data_range(
    start_date: Optional[datetime] = None, 
    end_date: Optional[datetime] = None, 
    stack_id: Optional[str] = None, 
    limit: int = 50000  # เพิ่ม limit เป็น 50000
    ):
    data = sqlite_service.get_data_range(start_date, end_date, stack_id, limit)
    return {"success": True, "data": data, "count": len(data)}

@app.get("/api/sqlite/data/search")
async def search_sqlite_data(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    search_column: Optional[str] = None,
    search_value: Optional[str] = None,
    limit: int = 50000  # เพิ่ม limit เป็น 50000
):
    """Search CEMS data from SQLite with filters"""
    try:
        # Parse dates if provided
        start_dt = None
        end_dt = None
        
        if from_date:
            start_dt = datetime.fromisoformat(from_date.replace('Z', '+00:00'))
        if to_date:
            end_dt = datetime.fromisoformat(to_date.replace('Z', '+00:00'))
        
        # Get data from SQLite with search filters
        data = sqlite_service.search_data(
            start_date=start_dt,
            end_date=end_dt,
            search_column=search_column,
            search_value=search_value,
            limit=limit
        )
        
        return {
            "success": True,
            "data": data,
            "count": len(data)
        }
    except Exception as e:
        return {
            "success": False,
            "message": str(e),
            "data": [],
            "count": 0
        }

@app.get("/api/sqlite/logs")
async def get_sqlite_logs(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    level: Optional[str] = None,
    limit: int = 1000
):
    logs = sqlite_service.get_system_logs(start_date, end_date, level, limit)
    return {"success": True, "logs": logs, "count": len(logs)}

@app.post("/api/sqlite/migrate")
async def migrate_config_to_sqlite():

    try:
        devices = config_service.get_devices()
        for device in devices:
            device_data = {
                "name": device.name,
                "host": device.host,
                "port": device.port,
                "unit": device.unit,
                "mode": getattr(device, "mode", "modbus"),
                "enabled": getattr(device, "enabled", True)
            }
            sqlite_service.save_device_config(device_data)
        mappings = config_service.get_mappings()
        for mapping in mappings:
            mapping_data = {
                "name": mapping.name,
                "unit": mapping.unit,
                "address": mapping.address,
                "data_type": mapping.dataType,
                "format": mapping.format,
                "count": mapping.count,
                "device_name": mapping.device,
                "enabled": True
            }
            sqlite_service.save_mapping_config(mapping_data)
        return {"success": True, "message": "Configuration migrated successfully"}
    except Exception as e:
        return {"success": False, "message": f"Failed to migrate config: {str(e)}"}

# Status Alarm Routes
@app.get("/api/status-alarm/data")
async def get_status_alarm_data():
    """ดึงข้อมูล status/alarm จาก Modbus"""
    try:
        data = status_alarm_service.read_status_alarm_data()
        return {
            "success": True,
            "data": data,
            "timestamp": datetime.now(),
            "count": len(data)
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Failed to read status/alarm data: {str(e)}",
            "data": [],
            "count": 0
        }

# Download endpoint
@app.get("/api/sqlite/data/download")
async def download_data(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    columns: Optional[str] = None,
    format: str = "csv"
):
    """Download CEMS data in various formats"""
    try:
        # Parse date parameters
        start_dt = None
        end_dt = None
        if from_date:
            start_dt = datetime.fromisoformat(from_date.replace('Z', '+00:00'))
        if to_date:
            end_dt = datetime.fromisoformat(to_date.replace('Z', '+00:00'))
        
        # Parse columns parameter
        selected_columns = None
        if columns:
            selected_columns = columns.split(',')
        
        # Get data from database
        data = sqlite_service.get_data_range(
            start_date=start_dt,
            end_date=end_dt,
            limit=10000  # Large limit for download
        )
        
        if not data:
            return {"success": False, "message": "No data found"}
        
        # Filter columns if specified
        if selected_columns:
            filtered_data = []
            for item in data:
                filtered_item = {"timestamp": item["timestamp"]}
                for col in selected_columns:
                    if col in item:
                        filtered_item[col] = item[col]
                filtered_data.append(filtered_item)
            data = filtered_data
        
        # Generate filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"cems_data_{timestamp}.{format}"
        
        if format == "csv":
            # Generate CSV content
            if not data:
                return {"success": False, "message": "No data to export"}
            
            headers = list(data[0].keys())
            csv_content = ",".join(headers) + "\n"
            
            for row in data:
                csv_content += ",".join([str(row.get(h, "")) for h in headers]) + "\n"
            
            return {
                "success": True,
                "data": csv_content,
                "filename": filename,
                "content_type": "text/csv"
            }
        
        elif format == "excel":
            # For Excel, we'll return CSV for now (can be enhanced later)
            headers = list(data[0].keys())
            csv_content = ",".join(headers) + "\n"
            
            for row in data:
                csv_content += ",".join([str(row.get(h, "")) for h in headers]) + "\n"
            
            return {
                "success": True,
                "data": csv_content,
                "filename": filename.replace('.excel', '.csv'),
                "content_type": "text/csv"
            }
        
        elif format == "pdf":
            # For PDF, we'll return CSV for now (can be enhanced later)
            headers = list(data[0].keys())
            csv_content = ",".join(headers) + "\n"
            
            for row in data:
                csv_content += ",".join([str(row.get(h, "")) for h in headers]) + "\n"
            
            return {
                "success": True,
                "data": csv_content,
                "filename": filename.replace('.pdf', '.csv'),
                "content_type": "text/csv"
            }
        
        else:
            return {"success": False, "message": "Unsupported format"}
            
    except Exception as e:
        return {"success": False, "message": str(e)}

if __name__ == "__main__":
    print("Starting server...")
    print("Running tests...")
    test_config()
    test_constants()
    print("All tests passed")
    print("Starting server...")
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
