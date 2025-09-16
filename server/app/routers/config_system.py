from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
import json
import os
from app.domain.config_model import SystemParams

router = APIRouter(prefix="/api/config", tags=["config-system"])

SYSTEM_FILE = "config/system.json"

def load_system_params() -> Dict[str, Any]:
    try:
        if os.path.exists(SYSTEM_FILE):
            with open(SYSTEM_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        return {}
    except Exception as e:
        print(f"Error loading system params: {e}")
        return {}

def save_system_params(system_params: Dict[str, Any]) -> bool:
    try:
        os.makedirs(os.path.dirname(SYSTEM_FILE), exist_ok=True)
        with open(SYSTEM_FILE, "w", encoding="utf-8") as f:
            json.dump(system_params, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"Error saving system params: {e}")
        return False

@router.get("/system")
async def get_system_params():
    system_params = load_system_params()
    return {"system_params": system_params}

@router.put("/system")
async def update_system_params(system_params: SystemParams):
    system_data = system_params.model_dump()

    if save_system_params(system_data):
        return {"message": "System params updated successfully", "system_params": system_data}
    else:
        raise HTTPException(status_code=500, detail="Failed to update system params")