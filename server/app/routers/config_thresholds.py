from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
import json
import os
from app.domain.config_model import ThresholdConfig

router = APIRouter(prefix="/api/config", tags=["config-thresholds"])

THRESHOLDS_FILE = "config/thresholds.json"

def load_thresholds() -> Dict[str, Any]:
    try:
        if os.path.exists(THRESHOLDS_FILE):
            with open(THRESHOLDS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        return []
    except Exception as e:
        print(f"Error loading thresholds: {e}")
        return []

def save_thresholds(thresholds: Dict[str, Any]) -> bool:
    try:
        os.makedirs(os.path.dirname(THRESHOLDS_FILE), exist_ok=True)
        with open(THRESHOLDS_FILE, "w", encoding="utf-8") as f:
            json.dump(thresholds, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"Error saving thresholds: {e}")
        return False

@router.get("/thresholds")
async def get_thresholds():
    thresholds = load_thresholds()
    return {"thresholds": thresholds}

@router.put("/thresholds")
async def update_thresholds(thresholds: List[ThresholdConfig]):
    for threshold in thresholds:
        if not threshold.parameter:
            raise HTTPException(status_code=400, detail="Parameter is required")
        if threshold.warningThreshold is None:
            raise HTTPException(status_code=400, detail="Warning threshold is required")
        if threshold.dangerThreshold is None:
            raise HTTPException(status_code=400, detail="Danger threshold is required")

    thresholds_data = []
    for threshold in thresholds:
        threshold_dict = threshold.model_dump()
        thresholds_data.append(threshold_dict)

    if save_thresholds(thresholds_data):
        return {"message": f"Successfully saved {len(thresholds_data)} thresholds", "count": len(thresholds_data)}
    else:
        raise HTTPException(status_code=500, detail="Failed to save thresholds")

@router.delete("/thresholds/{parameter}")
async def delete_threshold(parameter: str):
    thresholds = load_thresholds()

    original_count = len(thresholds)
    thresholds = [t for t in thresholds if t["parameter"] != parameter]

    if len(thresholds) == original_count:
        raise HTTPException(status_code=404, detail=f"Threshold '{parameter}' not found")

    if save_thresholds(thresholds):
        return {"message": f"Threshold '{parameter}' deleted successfully"}
    else:
        raise HTTPException(status_code=500, detail="Failed to delete threshold")