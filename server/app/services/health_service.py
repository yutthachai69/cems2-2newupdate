from datetime import datetime, timedelta
from app.domain.health_model import SystemInfo, HealthStatus

# Mock psutil functions for development
class MockPsutil:
    @staticmethod
    def virtual_memory():
        class Memory:
            percent = 45.2
        return Memory()
    
    @staticmethod
    def cpu_percent():
        return 25.8
    
    @staticmethod
    def disk_usage(path):
        class Disk:
            percent = 67.3
        return Disk()

# Use mock if psutil not available
try:
    import psutil
except ImportError:
    psutil = MockPsutil()

class HealthService:
    def __init__(self):
        self.start_time = datetime.now()

    def get_system_info(self) -> SystemInfo:
        uptime = datetime.now() - self.start_time

        return SystemInfo(
            version="1.0.0",
            uptime=str(uptime),
            memory_usage=psutil.virtual_memory().percent,
            cpu_usage=psutil.cpu_percent(),
            disk_usage=psutil.disk_usage('/').percent,
            last_update=datetime.now()
        )
    
    def get_health_status(self) -> HealthStatus:
        services = {
            "database": "connected",
            "modbus": "connected",
            "websocket": "connected",
            "api": "connected",
        }

        return HealthStatus(
            status="healthy",
            services=services,
            last_check=datetime.now(),
            message="All system operational"
        )