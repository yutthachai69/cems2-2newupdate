from app.services.modbus_data_service import ModbusDataService
from app.services.influxdb_service import InfluxDBService
import asyncio
import time
from datetime import datetime

class ModbusInfluxDBIntegration:
    def __init__(self):
        self.modbus_service = ModbusDataService()
        self.influxdb_service = InfluxDBService()
        self.running = False
    
    async def start_data_collection(self, interval: int = 30):
        """Start collecting data from Modbus and storing to InfluxDB"""
        self.running = True
        print(f"🚀 Starting Modbus-InfluxDB integration (interval: {interval}s)")
        
        while self.running:
            try:
                # Get data from all stacks
                stacks = ["stack1", "stack2", "stack3", "stack4"]
                
                for stack_id in stacks:
                    # Get Modbus data
                    modbus_data = await self.modbus_service.get_stack_data(stack_id)
                    
                    if modbus_data and modbus_data.get("enabled", False):
                        # Prepare data for InfluxDB
                        influxdb_data = {
                            "co": modbus_data.get("co", 0.0),
                            "no": modbus_data.get("no", 0.0),
                            "no2": modbus_data.get("no2", 0.0),
                            "o2": modbus_data.get("o2", 0.0),
                            "temp": modbus_data.get("temp", 0.0),
                            "pressure": modbus_data.get("pressure", 0.0),
                            "flow": modbus_data.get("flow", 0.0)
                        }
                        
                        # Save to InfluxDB
                        success = self.influxdb_service.save_modbus_data(stack_id, influxdb_data)
                        
                        if success:
                            print(f"✅ {stack_id}: Data saved to InfluxDB - CO: {influxdb_data['co']:.1f}, NO: {influxdb_data['no']:.1f}")
                        else:
                            print(f"❌ {stack_id}: Failed to save data to InfluxDB")
                    else:
                        print(f"⏸️ {stack_id}: Disabled or no data")
                
                # Wait for next interval
                await asyncio.sleep(interval)
                
            except Exception as e:
                print(f"❌ Error in data collection: {e}")
                await asyncio.sleep(5)  # Wait 5 seconds before retry
    
    def stop_data_collection(self):
        """Stop data collection"""
        self.running = False
        print("🛑 Stopping Modbus-InfluxDB integration")
    
    async def test_single_collection(self):
        """Test single data collection cycle"""
        print("🧪 Testing single data collection cycle...")
        
        stacks = ["stack1", "stack2", "stack3", "stack4"]
        
        for stack_id in stacks:
            try:
                # Get Modbus data
                modbus_data = await self.modbus_service.get_stack_data(stack_id)
                
                if modbus_data and modbus_data.get("enabled", False):
                    # Prepare data for InfluxDB
                    influxdb_data = {
                        "co": modbus_data.get("co", 0.0),
                        "no": modbus_data.get("no", 0.0),
                        "no2": modbus_data.get("no2", 0.0),
                        "o2": modbus_data.get("o2", 0.0),
                        "temp": modbus_data.get("temp", 0.0),
                        "pressure": modbus_data.get("pressure", 0.0),
                        "flow": modbus_data.get("flow", 0.0)
                    }
                    
                    # Save to InfluxDB
                    success = self.influxdb_service.save_modbus_data(stack_id, influxdb_data)
                    
                    if success:
                        print(f"✅ {stack_id}: Data saved to InfluxDB")
                        print(f"   CO: {influxdb_data['co']:.1f}, NO: {influxdb_data['no']:.1f}, NO2: {influxdb_data['no2']:.1f}")
                        print(f"   O2: {influxdb_data['o2']:.1f}, Temp: {influxdb_data['temp']:.1f}°C")
                        print(f"   Pressure: {influxdb_data['pressure']:.1f}, Flow: {influxdb_data['flow']:.1f}")
                    else:
                        print(f"❌ {stack_id}: Failed to save data to InfluxDB")
                else:
                    print(f"⏸️ {stack_id}: Disabled or no data")
                    
            except Exception as e:
                print(f"❌ {stack_id}: Error - {e}")

# Global instance
modbus_influxdb = ModbusInfluxDBIntegration()

async def main():
    """Main function for testing"""
    integration = ModbusInfluxDBIntegration()
    
    print("🧪 Testing Modbus-InfluxDB Integration...")
    await integration.test_single_collection()
    
    print("\n🚀 Starting continuous data collection (30s interval)...")
    print("Press Ctrl+C to stop")
    
    try:
        await integration.start_data_collection(30)
    except KeyboardInterrupt:
        integration.stop_data_collection()
        print("\n👋 Integration stopped by user")

if __name__ == "__main__":
    asyncio.run(main())







