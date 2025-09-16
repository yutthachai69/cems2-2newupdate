from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any, Optional
import json
import os
from app.domain.config_model import MappingConfig
from app.services.config_service import ConfigService

router = APIRouter(prefix="/api/config", tags=["config-mappings"])

MAPPINGS_FILE = "config/mappings.json"
# ใช้ dependency injection แทนการสร้าง instance ใหม่
config_service = None

def load_mappings() -> List[Dict[str, Any]]:
    try:
        if os.path.exists(MAPPINGS_FILE):
            with open(MAPPINGS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        return []
    except Exception as e:
        print(f"Error loading mappings: {e}")
        return []

def save_mappings(mappings: List[Dict[str, Any]]) -> bool:
    try:
        os.makedirs(os.path.dirname(MAPPINGS_FILE), exist_ok=True)
        with open(MAPPINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(mappings, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"Error saving mappings: {e}")
        return False

@router.get("/mappings")
async def get_mappings():
    mappings = load_mappings()
    return {"mappings": mappings}

@router.post("/mappings")
async def save_mappings_config(mappings: List[MappingConfig]):
    # Validate required fields
    for mapping in mappings:
        if not mapping.name:
            raise HTTPException(status_code=400, detail="Mapping name is required")
        if mapping.address is None:
            raise HTTPException(status_code=400, detail="Mapping address is required")

    existing_mappings = load_mappings()
    max_id = max([m.get("id", 0) for m in existing_mappings], default=0)

    # Convert Pydantic models to dict and assign IDs
    mappings_data = []
    for mapping in mappings:
        mapping_dict = mapping.model_dump()
        if not mapping_dict.get("id"):
            max_id += 1
            mapping_dict["id"] = max_id
        mappings_data.append(mapping_dict)

    if save_mappings(mappings_data):
        # รีเฟรช ConfigService หลังจากบันทึกไฟล์
        config_service.refresh_configs()
        print("DEBUG: Reloaded configuration after saving mappings")
        return {"message": f"Successfully saved {len(mappings_data)} mappings", "count": len(mappings_data)}
    else:
        raise HTTPException(status_code=500, detail="Failed to save mappings")

@router.put("/mappings/{mapping_id}")
async def update_mapping(mapping_id: int, mapping_data: MappingConfig):
    mappings = load_mappings()

    mapping_index = None
    for i, mapping in enumerate(mappings):
        if mapping.get("id") == mapping_id:
            mapping_index = i
            break

    if mapping_index is None:
        raise HTTPException(status_code=404, detail="Mapping not found")

    # Convert Pydantic model to dict
    mapping_dict = mapping_data.model_dump()
    mapping_dict["id"] = mapping_id
    
    mappings[mapping_index] = mapping_dict

    if save_mappings(mappings):
        # รีเฟรช ConfigService หลังจากบันทึกไฟล์
        config_service.refresh_configs()
        print("DEBUG: Reloaded configuration after updating mapping")
        return {"message": "Mapping updated successfully", "mapping": mappings[mapping_index]}
    else:
        raise HTTPException(status_code=500, detail="Failed to update mapping")

@router.delete("/mappings/{mapping_id}")
async def delete_mapping(mapping_id: int):
    mappings = load_mappings()

    original_count = len(mappings)
    mappings = [m for m in mappings if m.get("id") != mapping_id]

    if len(mappings) == original_count:
        raise HTTPException(status_code=404, detail="Mapping not found")
    
    if save_mappings(mappings):
        # รีเฟรช ConfigService หลังจากบันทึกไฟล์
        config_service.refresh_configs()
        print("DEBUG: Reloaded configuration after deleting mapping")
        return {"message": "Mapping deleted successfully", "deleted_id": mapping_id}
    else:
        raise HTTPException(status_code=500, detail="Failed to delete mapping")