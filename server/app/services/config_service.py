from typing import List, Dict, Optional
from app.domain.config_model import *
from app.services.sqlite_service import SQLiteService

class ConfigService:
    def __init__(self):
        self.devices = []
        self.mappings = []
        self.gas_settings = []
        self.system_params = SystemConfig()
        self.stacks = []
        self.thresholds = []
        self.sqlite_service = SQLiteService()
        
        # โหลดข้อมูลเริ่มต้นจากไฟล์ config
        self._load_default_configs()

    def _load_default_configs(self):
        """โหลดข้อมูลเริ่มต้นจากไฟล์ config - อ่านไฟล์ใหม่ทุกครั้ง"""
        try:
            import json
            import os
            
            # ล้างข้อมูลเก่าใน memory
            self.devices.clear()
            self.mappings.clear()
            
            # โหลด devices จากไฟล์ JSON (อ่านใหม่ทุกครั้ง)
            devices_file = "config/devices.json"
            if os.path.exists(devices_file):
                with open(devices_file, 'r') as f:
                    devices_data = json.load(f)
                    for device_data in devices_data:
                        device = DeviceConfig(**device_data)
                        self.devices.append(device)
            
            # โหลด mappings จากไฟล์ JSON (อ่านใหม่ทุกครั้ง)
            mappings_file = "config/mappings.json"
            if os.path.exists(mappings_file):
                with open(mappings_file, 'r') as f:
                    mappings_data = json.load(f)
                    for mapping_data in mappings_data:
                        mapping = MappingConfig(**mapping_data)
                        self.mappings.append(mapping)
            
            print(f"ConfigService loaded: {len(self.devices)} devices, {len(self.mappings)} mappings")
                            
        except Exception as e:
            print(f"Failed to load default configs: {e}")
            # ถ้าไฟล์เสีย ให้ล้างข้อมูลใน memory
            self.devices.clear()
            self.mappings.clear()

    def get_devices(self) -> List[DeviceConfig]:
        """ดึงข้อมูล devices - ใช้ข้อมูลใน memory"""
        return self.devices.copy()  # ส่งคืนสำเนา
    
    def get_device_by_name(self, name: str) -> Optional[DeviceConfig]:
        """หา device ตามชื่อ - ใช้ข้อมูลใน memory"""
        for device in self.devices:
            if device.name == name:
                return device
        return None

    def get_mappings(self) -> List[MappingConfig]:
        """ดึงข้อมูล mappings - ใช้ข้อมูลใน memory"""
        return self.mappings.copy()  # ส่งคืนสำเนา

    def refresh_configs(self):
        """รีเฟรชข้อมูล config จากไฟล์ - เรียกเมื่อแก้ไขไฟล์"""
        self._load_default_configs()

    def add_mappings(self, mappings: List[MappingConfig]) -> bool:
        # บันทึกลง SQLite
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
            self.sqlite_service.save_mapping_config(mapping_data)
        
        # บันทึกลง memory
        self.mappings.clear()
        for mapping in mappings:
            if mapping.id is None:
                mapping.id = len(self.mappings) + 1
            self.mappings.append(mapping)
        return True

    def get_gas_settings(self) -> List[GasConfig]:
        return self.gas_settings

    def update_gas_settings(self, gas: GasConfig) -> bool:
        for i, existing in enumerate(self.gas_settings):
            if existing.parameter == gas.parameter:
                self.gas_settings[i] = gas
                return True
        self.gas_settings.append(gas)
        return True

    def get_system_params(self) -> SystemConfig:
        return self.system_params

    def update_system_params(self, system: SystemConfig) -> bool:
        self.system_params = system
        return True

    def get_stacks(self) -> List[StackConfig]:
        return self.stacks

    def add_stacks(self, stacks: List[StackConfig]) -> bool:
        for stack in stacks:
            self.stacks.append(stack)
        return True

    def get_thresholds(self) -> List[ThresholdConfig]:
        return self.thresholds

    def update_thresholds(self, thresholds: List[ThresholdConfig]) -> bool:
        self.thresholds = thresholds
        return True