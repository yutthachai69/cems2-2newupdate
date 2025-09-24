from influxdb_client import InfluxDBClient, Point, WritePrecision
from app.config.influxdb import influxdb
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import json

class InfluxDBService:
    def __init__(self):
        self.influxdb = influxdb

    def save_cems_data(self, stack_id: str, stack_name: str, data: dict, corrected_data: dict = None, status: str = "connected", device_name: str = None) -> bool:
        """บันทึกข้อมูล CEMS ลง InfluxDB"""
        try:
            # สร้าง Point สำหรับข้อมูล CEMS
            point = Point("cems_data") \
                .tag("stack_id", stack_id) \
                .tag("stack_name", stack_name) \
                .tag("status", status) \
                .field("SO2", data.get("SO2", 0.0)) \
                .field("NOx", data.get("NOx", 0.0)) \
                .field("O2", data.get("O2", 0.0)) \
                .field("CO", data.get("CO", 0.0)) \
                .field("Dust", data.get("Dust", 0.0)) \
                .field("Temperature", data.get("Temperature", 0.0)) \
                .field("Velocity", data.get("Velocity", 0.0)) \
                .field("Flowrate", data.get("Flowrate", 0.0)) \
                .field("Pressure", data.get("Pressure", 0.0)) \
                .time(datetime.utcnow(), WritePrecision.MS)

            # เพิ่มข้อมูล Corrected Values ถ้ามี
            if corrected_data:
                point = point.field("SO2Corr", corrected_data.get("SO2", 0.0)) \
                           .field("NOxCorr", corrected_data.get("NOx", 0.0)) \
                           .field("COCorr", corrected_data.get("CO", 0.0)) \
                           .field("DustCorr", corrected_data.get("Dust", 0.0))

            # เพิ่ม device_name เป็น tag ถ้ามี
            if device_name:
                point = point.tag("device_name", device_name)

            self.influxdb.write_api.write(
                bucket=self.influxdb.bucket,
                org=self.influxdb.org,
                record=point
            )
            return True
        except Exception as e:
            print(f"Error saving CEMS data: {e}")
            return False

    def save_modbus_data(self, stack_id: str, data: dict) -> bool:
        """บันทึกข้อมูล Modbus (backward compatibility)"""
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

    def get_latest_cems_data(self, stack_id: str) -> Optional[Dict]:
        """ดึงข้อมูล CEMS ล่าสุด"""
        try:
            query = f'''
            from(bucket: "{self.influxdb.bucket}")
            |> range(start: -1h)
            |> filter(fn: (r) => r._measurement == "cems_data")
            |> filter(fn: (r) => r.stack_id == "{stack_id}")
            |> last()
            '''
            result = self.influxdb.query_api.query(query)

            if result:
                data = {}
                corrected_data = {}
                for table in result:
                    for record in table.records:
                        field_name = record.get_field()
                        value = record.get_value()
                        
                        if field_name.endswith("Corr"):
                            # เก็บข้อมูล corrected
                            corrected_data[field_name.replace("Corr", "")] = value
                        else:
                            data[field_name] = value
                        
                        data["timestamp"] = record.get_time()
                        data["stack_id"] = record.values.get("stack_id")
                        data["stack_name"] = record.values.get("stack_name")
                        data["status"] = record.values.get("status")

                # สร้างโครงสร้างข้อมูลแบบเดียวกับ SQLite
                if data:
                    return {
                        "stack_id": data.get("stack_id"),
                        "stack_name": data.get("stack_name"),
                        "data": {
                            "timestamp": data.get("timestamp"),
                            "SO2": data.get("SO2", 0.0),
                            "NOx": data.get("NOx", 0.0),
                            "O2": data.get("O2", 0.0),
                            "CO": data.get("CO", 0.0),
                            "Dust": data.get("Dust", 0.0),
                            "Temperature": data.get("Temperature", 0.0),
                            "Velocity": data.get("Velocity", 0.0),
                            "Flowrate": data.get("Flowrate", 0.0),
                            "Pressure": data.get("Pressure", 0.0)
                        },
                        "corrected_data": {
                            "timestamp": data.get("timestamp"),
                            "SO2": corrected_data.get("SO2", data.get("SO2", 0.0)),
                            "NOx": corrected_data.get("NOx", data.get("NOx", 0.0)),
                            "O2": data.get("O2", 0.0),
                            "CO": corrected_data.get("CO", data.get("CO", 0.0)),
                            "Dust": corrected_data.get("Dust", data.get("Dust", 0.0)),
                            "Temperature": data.get("Temperature", 0.0),
                            "Velocity": data.get("Velocity", 0.0),
                            "Flowrate": data.get("Flowrate", 0.0),
                            "Pressure": data.get("Pressure", 0.0)
                        },
                        "status": data.get("status", "unknown")
                    }
            return None
        except Exception as e:
            print(f"Error getting latest CEMS data: {e}")
            return None

    def get_latest_data(self, stack_id:str) -> Optional[Dict]:
        """ดึงข้อมูลล่าสุด (backward compatibility - ใช้ CEMS data)"""
        return self.get_latest_cems_data(stack_id)
    
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

    def get_cems_data_range(self, start_time: datetime = None, end_time: datetime = None, stack_id: str = None, limit: int = 1000) -> List[Dict]:
        """ดึงข้อมูล CEMS ในช่วงเวลาที่กำหนด"""
        try:
            # สร้าง query สำหรับ CEMS data
            if start_time and end_time:
                start_str = start_time.strftime("%Y-%m-%dT%H:%M:%SZ")
                end_str = end_time.strftime("%Y-%m-%dT%H:%M:%SZ")
                range_filter = f'start: {start_str}, stop: {end_str}'
            elif start_time:
                start_str = start_time.strftime("%Y-%m-%dT%H:%M:%SZ")
                range_filter = f'start: {start_str}'
            elif end_time:
                end_str = end_time.strftime("%Y-%m-%dT%H:%M:%SZ")
                range_filter = f'stop: {end_str}'
            else:
                range_filter = 'start: -24h'  # ข้อมูล 24 ชั่วโมงล่าสุด

            stack_filter = f'|> filter(fn: (r) => r.stack_id == "{stack_id}")' if stack_id else ''
            limit_filter = f'|> limit(n: {limit})' if limit else ''

            query = f'''
            from(bucket: "{self.influxdb.bucket}")
            |> range({range_filter})
            |> filter(fn: (r) => r._measurement == "cems_data")
            {stack_filter}
            |> sort(columns: ["_time"], desc: true)
            {limit_filter}
            '''
            
            result = self.influxdb.query_api.query(query)

            data_points = []
            current_time = None
            current_data = {}

            for table in result:
                for record in table.records:
                    record_time = record.get_time()
                    field_name = record.get_field()
                    value = record.get_value()

                    if current_time != record_time:
                        if current_data:
                            data_points.append(current_data)
                        current_time = record_time
                        current_data = {
                            "timestamp": record_time,
                            "stack_id": record.values.get("stack_id")
                        }
                    
                    current_data[field_name] = value

            if current_data:
                data_points.append(current_data)

            return data_points
        except Exception as e:
            print(f"Error getting CEMS data range: {e}")
            return []

    def get_data_by_time_range(self, stack_id: str, start_time: datetime, end_time: datetime) -> List[Dict]:
        """ดึงข้อมูลในช่วงเวลา (backward compatibility)"""
        return self.get_cems_data_range(start_time, end_time, stack_id)

    def get_aggregated_data(self, stack_id: str, hours: int = 24, interval: str = "1h") -> List[Dict]:
        try:
            query = f'''
            from(bucket: "{self.influxdb.bucket}")
            |> range(start: -{hours}h)
            |> filter(fn: (r) => r._measurement == "cems_data")
            |> filter(fn: (r) => r.stack_id == "{stack_id}")
            |> aggregateWindow(every: {interval}, fn: last, createEmpty: false)
            |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
            |> sort(columns: ["_time"], desc: true)
            '''
            result = self.influxdb.query_api.query(query)

            data_points = []
            
            for table in result:
                for record in table.records:
                    data_point = {
                        "timestamp": record.get_time(),
                        "stack_id": record.values.get("stack_id"),
                        "stack_name": record.values.get("stack_name"),
                        "SO2": record.values.get("SO2"),
                        "NOx": record.values.get("NOx"),
                        "O2": record.values.get("O2"),
                        "CO": record.values.get("CO"),
                        "Dust": record.values.get("Dust"),
                        "Temperature": record.values.get("Temperature"),
                        "Velocity": record.values.get("Velocity"),
                        "Flowrate": record.values.get("Flowrate"),
                        "Pressure": record.values.get("Pressure"),
                        "SO2Corr": record.values.get("SO2Corr"),
                        "NOxCorr": record.values.get("NOxCorr"),
                        "COCorr": record.values.get("COCorr"),
                        "DustCorr": record.values.get("DustCorr"),
                        "status": record.values.get("status"),
                        "device_name": record.values.get("device_name")
                    }
                    data_points.append(data_point)

            return data_points
        except Exception as e:
            print(f"Error getting aggregate data: {e}")
            return []

    def search_cems_data(self, start_time: datetime = None, end_time: datetime = None, 
                        search_column: str = None, search_value: str = None, 
                        stack_id: str = None, limit: int = 1000) -> List[Dict]:
        """ค้นหาข้อมูล CEMS"""
        try:
            # ใช้ get_cems_data_range เป็นพื้นฐาน
            data_points = self.get_cems_data_range(start_time, end_time, stack_id, limit)
            
            # กรองข้อมูลตาม search criteria
            if search_column and search_value:
                filtered_data = []
                for point in data_points:
                    if search_column in point and search_value in str(point[search_column]):
                        filtered_data.append(point)
                return filtered_data
            
            return data_points
        except Exception as e:
            print(f"Error searching CEMS data: {e}")
            return []

    def test_connection(self) -> bool:
        """ทดสอบการเชื่อมต่อ InfluxDB"""
        try:
            buckets = self.influxdb.client.buckets_api().find_buckets()
            return True
        except Exception as e:
            print(f"InfluxDB connection test failed: {e}")
            return False
            