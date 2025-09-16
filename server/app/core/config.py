from pydantic import BaseModel
from typing import Optional

class Settings(BaseModel):
    api_title: str = "CEMS API"
    api_version: str = "1.0.0"
    debug: bool = False

    modbus_default_host: str = "127.0.0.1"
    modbus_default_port: int = 502
    modbus_default_unit: int = 1

    data_update_interval: int = 10000  # 10 วินาที
    max_data_points: int = 50000  # เพิ่ม max_data_points เป็น 50000

    config_file_path: str = "config.json"

settings = Settings()