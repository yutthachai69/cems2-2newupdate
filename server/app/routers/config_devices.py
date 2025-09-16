from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
import json
import os
from app.services.config_service import ConfigService

router = APIRouter(prefix="/api/config", tags=["config-devices"])

DEVICES_FILE = "config/devices.json"
# ใช้ dependency injection แทนการสร้าง instance ใหม่
config_service = None

def load_devices() -> List[Dict[str, Any]]:
    try:
        if os.path.exists(DEVICES_FILE):
            with open(DEVICES_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        return []
    except Exception as e:
        print(f"Error loading devices: {e}")
        return []

def save_devices(devices: List[Dict[str, Any]]) -> bool:
    try:
        os.makedirs(os.path.dirname(DEVICES_FILE), exist_ok=True)
        with open(DEVICES_FILE, "w", encoding="utf-8") as f:
            json.dump(devices, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"Error saving devices: {e}")
        return False

@router.get("/devices")
async def get_devices():
    devices = load_devices()
    return {"devices": devices}

@router.post("/devices")
async def save_devices_config(devices: List[Dict[str, Any]]):
    try:
        print(f"DEBUG: Received devices: {devices}")
        
        # Load existing devices to get the next ID
        existing_devices = load_devices()
        print(f"DEBUG: Existing devices: {existing_devices}")
        
        max_id = max([d.get("id", 0) for d in existing_devices], default=0)
        print(f"DEBUG: Max ID: {max_id}")
        
        # Generate IDs for new devices
        for i, device in enumerate(devices):
            if not device.get("id"):
                device["id"] = max_id + i + 1
                print(f"DEBUG: Generated ID {device['id']} for device: {device['name']}")
            
            if not device.get("name"):
                raise HTTPException(status_code=400, detail="Device name is required")
            if not device.get("host"):
                raise HTTPException(status_code=400, detail="Device host is required")
            if not device.get("port"):
                raise HTTPException(status_code=400, detail="Device port is required")

        print(f"DEBUG: Saving devices: {devices}")
        if save_devices(devices):
            print("DEBUG: Devices saved successfully")
            # รีเฟรช ConfigService หลังจากบันทึกไฟล์
            config_service.refresh_configs()
            return {"message": "Devices saved successfully", "count": len(devices)}
        else:
            print("DEBUG: Failed to save devices")
            raise HTTPException(status_code=500, detail="Failed to save devices")

    except HTTPException:
        raise 
    except Exception as e:
        print(f"DEBUG: Error: {e}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@router.get("/devices/{device_id}")
async def get_device(device_id: int):
    devices = load_devices()
    device = next((d for d in devices if d.get("id") == device_id), None)

    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    return {"device": device}

@router.put("/devices/{device_id}")
async def update_device(device_id: int, device_data: Dict[str, Any]):
    devices = load_devices()
    device_index = next((i for i, d in enumerate(devices) if d.get("id") == device_id), None)

    if device_index is None:
        raise HTTPException(status_code=404, detail="Device not found")

    devices[device_index].update(device_data)

    if save_devices(devices):
        # รีเฟรช ConfigService หลังจากบันทึกไฟล์
        config_service.refresh_configs()
        return {"message": "Device updated successfully", "device": devices[device_index]}
    else:
        raise HTTPException(status_code=500, detail="Failed to update device")
    
@router.delete("/devices/{device_id}")
async def delete_device(device_id: int):
    devices = load_devices()
    
    # หาชื่อ device ที่จะลบ
    device_to_delete = next((d for d in devices if d.get("id") == device_id), None)
    if not device_to_delete:
        raise HTTPException(status_code=404, detail="Device not found")
    
    device_name = device_to_delete.get("name")
    
    # ลบ device จาก devices.json
    devices = [d for d in devices if d.get("id") != device_id]

    if save_devices(devices):
        # ลบ mapping จาก status_alarm.json ที่เชื่อมกับ device นี้
        try:
            STATUS_ALARM_FILE = "config/status_alarm.json"
            if os.path.exists(STATUS_ALARM_FILE):
                with open(STATUS_ALARM_FILE, "r", encoding="utf-8") as f:
                    status_alarms = json.load(f)
                
                # กรองเอาเฉพาะ mapping ที่ไม่ใช่ device ที่ลบ
                original_count = len(status_alarms)
                status_alarms = [item for item in status_alarms if item.get("device") != device_name]
                removed_count = original_count - len(status_alarms)
                
                # บันทึกไฟล์ใหม่
                with open(STATUS_ALARM_FILE, "w", encoding="utf-8") as f:
                    json.dump(status_alarms, f, ensure_ascii=False, indent=2)
                
                print(f"DEBUG: Removed {removed_count} status/alarm mappings for device '{device_name}'")
        except Exception as e:
            print(f"WARNING: Failed to clean up status/alarm mappings: {e}")
        
        # รีเฟรช ConfigService หลังจากบันทึกไฟล์
        config_service.refresh_configs()
        return {"message": f"Device '{device_name}' and its mappings deleted successfully"}
    else:
        raise HTTPException(status_code=500, detail="Failed to delete device")