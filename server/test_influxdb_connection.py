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
        test_data = {
            "co": 10.5,
            "no": 20.3,
            "no2": 15.7,
            "o2": 18.2,
            "temp": 25.5,
            "pressure": 1013.25,
            "flow": 100.0
        }
        
        # Save test data
        success = service.save_modbus_data("stack1", test_data)
        if success:
            print("✅ Test data saved successfully")
            
            # Read test data
            data = service.get_latest_data("stack1")
            if data:
                print("✅ Test data retrieved successfully")
                print(f"Data: {data}")
            else:
                print("❌ Failed to retrieve test data")
        else:
            print("❌ Failed to save test data")
            
    except Exception as e:
        print(f"❌ Error testing InfluxDB: {e}")
    finally:
        influxdb.close()

if __name__ == "__main__":
    test_influxdb_connection()