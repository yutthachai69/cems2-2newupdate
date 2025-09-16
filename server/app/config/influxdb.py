from influxdb_client import InfluxDBClient, Point, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS
import os
from datetime import datetime

class InfluxDBConfig:
    def __init__(self):
        self.url = os.getenv("INFLUXDB_URL", "http://localhost:8087")
        self.token = os.getenv("INFLUXDB_TOKEN","cems_token_1234")
        self.org = os.getenv("INFLUXDB_ORG","cems_org")
        self.bucket = os.getenv("INFLUXDB_BUCKET","cems_data")

        self.client = InfluxDBClient(
            url=self.url,
            token=self.token,
            org=self.org,
            )

        self.write_api = self.client.write_api(write_options=SYNCHRONOUS)
        self.query_api = self.client.query_api()

    def close(self):
        self.client.close()
influxdb = InfluxDBConfig()