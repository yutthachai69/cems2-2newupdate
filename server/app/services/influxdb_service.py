from influxdb_client import InfluxDBClient, Point, WritePrecision
from app.config.influxdb import influxdb
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import json

class InfluxDBService:
    def __init__(self):
        self.influxdb = influxdb

    def save_modbus_data(self, stack_id: str, data: dict) -> bool:
        try:
            point = Point("modbus_data") \
                .tag("stack_id", stack_id) \
                .field("co", data.get("co", 0.0)) \
                .field("no", data.get("no", 0.0)) \
                .field("no2", data.get("no2", 0.0)) \
                .field("o2", data.get("o2", 0.0)) \
                .field("temp", data.get("temp", 0.0)) \
                .field("pressure", data.get("pressure", 0.0)) \
                .field("flow", data.get("flow", 0.0)) \
                .time(datetime.utcnow(), WritePrecision.MS)

            self.influxdb.write_api.write(
                bucket=self.influxdb.bucket,
                org=self.influxdb.org,
                record=point
            )
            return True
        except Exception as e:
            print(f"Error saving modbus data: {e}")
            return False

    def get_latest_data(self, stack_id:str) -> Optional[Dict]:
        try:
            query = f'''
            from(bucket: "{self.influxdb.bucket}")
            |> range(start: -1h)
            |> filter(fn: (r) => r._measurement == "modbus_data")
            |> filter(fn: (r) => r.stack_id == "{stack_id}")
            |> last()
            '''
            result = self.influxdb.query_api.query(query)

            if result:
                data = {}
                for table in result:
                    for record in table.records:
                        data[record.get_field()] = record.get_value()
                        data["timestamp"] = record.get_time()
                        data["stack_id"] = record.values.get("stack_id")

                return data if data else None
            return None
        except Exception as e:
            print(f"Error getting latest data: {e}")
            return None
    
    def get_all_latest_data(self) -> List[Dict]:
        stacks = ["stack1", "stack2", "stack3","stack4"]
        latest_data = []

        for stack_id in stacks:
            data = self.get_latest_data(stack_id)
            if data:
                latest_data.append(data)

        return latest_data

    def get_historical_data(self, stack_id: str, hours: int = 24) -> List[Dict]:
        try:
            query = f'''
            from(bucket: "{self.influxdb.bucket}")
            |> range(start: -{hours}h)
            |> filter(fn: (r) => r._measurement == "modbus_data")
            |> filter(fn: (r) => r.stack_id == "{stack_id}")
            |> sort(columns: ["_time"], desc: true)
            '''
            result = self.influxdb.query_api.query(query)

            data_points = []
            current_time = None
            current_data = {}

            for table in result:
                for record in table.records:
                    record_time = record.get_time()

                    if current_time != record_time:
                        if current_data:
                            data_points.append(current_data)
                        current_time = record_time
                        current_data = {
                            "timestamp": record_time,
                            "stack_id": record.values.get("stack_id")
                        }
                    current_data[record.get_field()] = record.get_value()
            if current_data:
                data_points.append(current_data)

            return data_points
        except Exception as e:
            print(f"Error getting historical data: {e}")
            return []

    def get_data_by_time_range(self, stack_id: str, start_time: datetime, end_time: datetime) -> List[Dict]:
        try:
            start_str = start_time.strftime("%Y-%m-%dT%H:%M:%SZ")
            end_str = end_time.strftime("%Y-%m-%dT%H:%M:%SZ")
            
            query = f'''
            from(bucket: "{self.influxdb.bucket}")
            |> range(start: {start_str}, stop: {end_str})
            |> filter(fn: (r) => r._measurement == "modbus_data")
            |> filter(fn: (r) => r.stack_id == "{stack_id}")
            |> sort(columns: ["_time"], desc: true)
            '''
            result = self.influxdb.query_api.query(query)

            data_points = []
            current_time = None
            current_data = {}

            for table in result:
                for record in table.records:
                    record_time = record.get_time()

                    if current_time != record_time:
                        if current_data:
                            data_points.append(current_data)
                        current_time = record_time
                        current_data = {
                            "timestamp": record_time,
                            "stack_id": record.values.get("stack_id")
                        }
                    current_data[record.get_field()] = record.get_value()

            if current_data:
                data_points.append(current_data)

            return data_points
        except Exception as e:
            print(f"Error getting data by time range: {e}")
            return []

    def get_aggregated_data(self, stack_id: str, hours: int = 24, interval: str = "1h") -> List[Dict]:
        try:
            query = f'''
            from(bucket: "{self.influxdb.bucket}")
            |> range(start: -{hours}h)
            |> filter(fn: (r) => r._measurement == "modbus_data")
            |> filter(fn: (r) => r.stack_id == "{stack_id}")
            |> aggregateWindow(every: {interval}, fn: mean, createEmpty: false)
            |> sort(columns: ["_time"], desc: true)
            '''
            result = self.influxdb.query_api.query(query)

            data_points = []
            current_time = None
            current_data = {}

            for table in result:
                for record in table.records:
                    record_time = record.get_time()

                    if current_time != record_time:
                        if current_data:
                            data_points.append(current_data)
                        current_time = record_time
                        current_data = {
                            "timestamp": record_time,
                            "stack_id": record.values.get("stack_id")
                        }
                    current_data[record.get_field()] = record.get_value()

            if current_data:
                data_points.append(current_data)

            return data_points
        except Exception as e:
            print(f"Error getting aggregate data: {e}")
            return []
            