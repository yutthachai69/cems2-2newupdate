from app.config.influxdb import influxdb
from app.services.influxdb_service import InfluxDBService

def test_influxdb_connection():
    """Test InfluxDB connection and basic operations"""
    try:
        # Test connection
        buckets = influxdb.client.buckets_api().find_buckets()
        print(f"✅ Connected to InfluxDB successfully!")
        print(f"Available buckets: {[bucket.name for bucket in buckets.buckets]}")
        
        # Test write and read
        service = InfluxDBService()
        
        # Test CEMS data (main format)
        cems_data = {
            "SO2": 15.5,
            "NOx": 25.3,
            "O2": 18.2,
            "CO": 12.7,
            "Dust": 8.5,
            "Temperature": 125.5,
            "Velocity": 15.8,
            "Flowrate": 1200.0,
            "Pressure": 1013.25
        }
        
        corrected_data = {
            "SO2": 18.2,
            "NOx": 29.8,
            "CO": 14.9,
            "Dust": 10.0
        }
        
        # Save CEMS test data
        success = service.save_cems_data("stack1", "Stack 1", cems_data, corrected_data, "connected")
        if success:
            print("✅ CEMS test data saved successfully")
            
            # Read CEMS test data
            data = service.get_latest_cems_data("stack1")
            if data:
                print("✅ CEMS test data retrieved successfully")
                print(f"Data: {data}")
            else:
                print("❌ Failed to retrieve CEMS test data")
        else:
            print("❌ Failed to save CEMS test data")
            
        # Test Modbus data (backward compatibility)
        modbus_data = {
            "co": 10.5,
            "no": 20.3,
            "no2": 15.7,
            "o2": 18.2,
            "temp": 25.5,
            "pressure": 1013.25,
            "flow": 100.0
        }
        
        # Save Modbus test data
        success = service.save_modbus_data("stack1", modbus_data)
        if success:
            print("✅ Modbus test data saved successfully")
        else:
            print("❌ Failed to save Modbus test data")
            
    except Exception as e:
        print(f"❌ Error testing InfluxDB: {e}")
    finally:
        influxdb.close()

if __name__ == "__main__":
    test_influxdb_connection()