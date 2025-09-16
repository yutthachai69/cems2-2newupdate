from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
import json
import os

router = APIRouter(prefix="/api/config", tags=["config_status_alarm"])

STATUS_ALARM_FILE = "config/status_alarm.json"

def load_status_alarm_mapping() -> List[Dict[str, Any]]:
    try:
        if os.path.exists(STATUS_ALARM_FILE):
            with open(STATUS_ALARM_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        return []
    except Exception as e:
        print(f"Error loading status alarm mapping: {e}")
        return []

def save_status_alarm_mapping(status_alarm_mapping: List[Dict[str, Any]]) -> bool:
    try:
        os.makedirs(os.path.dirname(STATUS_ALARM_FILE), exist_ok=True)
        with open(STATUS_ALARM_FILE, "w", encoding="utf-8") as f:
            json.dump(status_alarm_mapping, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"Error saving status alarm mapping: {e}")
        return False

@router.get("/status-alarm")
async def get_status_alarm_mapping():
    mappings = load_status_alarm_mapping()
    return {"status_alarm_mapping": mappings}

@router.post("/status-alarm")
async def create_status_alarm_mapping_config(mappings: List[Dict[str, Any]]):
    try:
        print(f"DEBUG: Received status alarm mapping config: {mappings}")

        for mapping in mappings:
            if not mapping.get("name"):
                raise HTTPException(status_code=400, detail="Mapping Name is required")
            if mapping.get("address") is None:
                raise HTTPException(status_code=400, detail="Mapping Address is required")
            if not mapping.get("device"):
                raise HTTPException(status_code=400, detail="Mapping Device is required")

        existing_mappings = load_status_alarm_mapping()
        max_id = max([m.get("id", 0) for m in existing_mappings], default=0)

        for i, mapping in enumerate(mappings):
            if not mapping.get("id"):
                mapping["id"] = max_id + i + 1
                print(f"DEBUG: Generated ID {mapping['id']} for mapping: {mapping['name']}")

        print(f"DEBUG: Saving status alarm mappings: {mappings}")
        if save_status_alarm_mapping(mappings):
            print("DEBUG: Status/alarm mappings saved successfully")
            return {"message": "Status/alarm mappings saved successfully", "count": len(mappings)}
        else:
            print("DEBUG: Failed to save status/alarm mappings")
            raise HTTPException(status_code=500, detail="Failed to save status/alarm mappings")

    except HTTPException:
        raise 
    except Exception as e:
        print(f"DEBUG: Error: {e}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

