from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
import json
import os
from app.domain.config_model import GasSettings

router = APIRouter(prefix="/api/config", tags=["config-gas"])

GAS_FILE = "config/gas.json"

def load_gas_settings() -> List[Dict[str, Any]]:
    try:
        if os.path.exists(GAS_FILE):
            with open(GAS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        return []
    except Exception as e:
        print(f"Error loading gas settings: {e}")
        return []

def save_gas_settings(gas_settings: List[Dict[str, Any]]) -> bool:
    try:
        os.makedirs(os.path.dirname(GAS_FILE), exist_ok=True)
        with open(GAS_FILE, "w", encoding="utf-8") as f:
            json.dump(gas_settings, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"Error saving gas settings: {e}")
        return False

@router.get("/gas")
async def get_gas_settings():
    gas_settings = load_gas_settings()
    return {"gas_settings": gas_settings}

@router.put("/gas")
async def update_gas_settings(gas_settings: List[GasSettings]):
    for gas in gas_settings:
        if not gas.parameter:
            raise HTTPException(status_code=400, detail="Gas parameter is required")
        if gas.warningThreshold is None:
            raise HTTPException(status_code=400, detail="Gas warning threshold is required")
        if gas.dangerThreshold is None:
            raise HTTPException(status_code=400, detail="Gas danger threshold is required")
        
    gas_data = []
    for gas in gas_settings:
        gas_dict = gas.model_dump()
        gas_data.append(gas_dict)
    
    if save_gas_settings(gas_data):
        return {"message": f"Successfully saved {len(gas_data)} gas settings", "count": len(gas_data)}
    else:
        raise HTTPException(status_code=500, detail="Failed to save gas settings")

@router.delete("/gas/{parameter}")
async def delete_gas_settings(parameter: str):
    gas_settings = load_gas_settings()
    original_count = len(gas_settings)
    gas_settings = [g for g in gas_settings if g["parameter"] != parameter]

    if len(gas_settings) == original_count:
        raise HTTPException(status_code=404, detail=f"Gas setting '{parameter}' not found")
        
    if save_gas_settings(gas_settings):
        return {"message": f"Gas setting '{parameter}' deleted successfully"}
    else:
        raise HTTPException(status_code=500, detail="Failed to delete gas setting")