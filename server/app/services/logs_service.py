from typing import List, Optional
from datetime import datetime, timedelta
import csv
import io
from app.domain.logs_model import LogEntry, LogFilter, LogResponse

class LogsService:
    def __init__(self):
        self.logs = []
        self._generate_sample_logs()

    def _generate_sample_logs(self):
        for i in range(100):
            log = LogEntry(
                id=f"log_{i}",
                timestamp=datetime.now() - timedelta(days=i),
                stack_id="stack1",
                SO2=45.2 + (i%10),
                NOx=32.1 + (i%15),
                O2=12.3 + (i%5),
                CO=10.5 + (i%12),
                Dust=23.4 + (i%8),
                Temperature=25.6 + (i%10),
                Velocity=10.2 + (i%5),
                Flowrate=1000.0 + (i%100),
                Pressure=1013.2 + (i%10)
            )
            self.logs.append(log)
    def get_logs(self, filter_params: LogFilter) -> LogResponse:
        filtered_logs = self.logs

        if filter_params.start_date:
            filtered_logs = [log for log in filtered_logs if log.timestamp >= filter_params.start_date]
        if filter_params.end_date:
            filtered_logs = [log for log in filtered_logs if log.timestamp <= filter_params.end_date]
        if filter_params.stack_id:
            filtered_logs = [log for log in filtered_logs if log.stack_id == filter_params.stack_id]

        filtered_logs = filtered_logs[:filter_params.limit]

        return LogResponse(
            logs=filtered_logs,
            total_count=len(self.logs),
            filtered_count=len(filtered_logs)
        )

    def export_csv(self, filter_params: LogFilter) -> str:
        logs_response = self.get_logs(filter_params)

        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow([
            "ID", "Timestamp", "Stack ID", "SO2", "NOx", "O2", "CO", "Dust", "Temperature", "Velocity", "Flowrate", "Pressure"
        ])

        for log in logs_response.logs:
            writer.writerow([
                log.id, log.timestamp.isoformat(), log.stack_id,
                log.SO2, log.NOx, log.O2, log.CO, log.Dust, log.Temperature, log.Velocity, log.Flowrate, log.Pressure
            ])

        return output.getvalue()