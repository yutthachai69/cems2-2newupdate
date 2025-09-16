#!/usr/bin/env python3
import sys
sys.path.append('.')
from app.services.status_alarm_sevice import StatusAlarmService
from app.services.config_service import ConfigService

print('=== Testing Current Modbus Data ===')
config_service = ConfigService()
status_alarm_service = StatusAlarmService(config_service)

print('1. Reading current status alarm data...')
try:
    data = status_alarm_service.read_status_alarm_data()
    print(f'Total items: {len(data)}')
    
    print('\n2. Alarms (test2):')
    alarms = [item for item in data if item['type'] == 'alarm']
    for alarm in alarms:
        print(f'  - {alarm["name"]}: value={alarm["value"]}, status={alarm["status"]}')
    
    print('\n3. Statuses (test3):')
    statuses = [item for item in data if item['type'] == 'status']
    for status in statuses:
        print(f'  - {status["name"]}: value={status["value"]}, status={status["status"]}')
        
except Exception as e:
    print(f'Error: {e}')
    import traceback
    traceback.print_exc()
