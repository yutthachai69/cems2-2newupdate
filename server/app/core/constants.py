# Data Parameters
DATA_PARAMETERS = [
    {"name": "SO2", "unit": "ppm", "min": 0, "max": 1000},
    {"name": "NOx", "unit": "ppm", "min": 0, "max": 1000},
    {"name": "O2", "unit": "%", "min": 0, "max": 25},
    {"name": "CO", "unit": "ppm", "min": 0, "max": 1000},
    {"name": "Dust", "unit": "mg/m³", "min": 0, "max": 100},
    {"name": "Temperature", "unit": "°C", "min": 0, "max": 500},
    {"name": "Velocity", "unit": "m/s", "min": 0, "max": 50},
    {"name": "Flowrate", "unit": "m³/h", "min": 0, "max": 50000},
    {"name": "Pressure", "unit": "Pa", "min": -1000, "max": 1000},
]

# Default Thresholds
DEFAULT_THRESHOLDS = {
    "SO2": {"warning": 50, "danger": 100},
    "NOx": {"warning": 100, "danger": 200},
    "O2": {"warning": 15, "danger": 20},
    "CO": {"warning": 30, "danger": 50},
    "Dust": {"warning": 20, "danger": 50},
    "Temperature": {"warning": 200, "danger": 300},
    "Velocity": {"warning": 15, "danger": 25},
    "Flowrate": {"warning": 10000, "danger": 15000},
    "Pressure": {"warning": -100, "danger": -200},
}

# Status Categories
STATUS_CATEGORIES = {
    "maintenance": "blue",
    "calibration": "purple", 
    "sampling": "cyan",
    "blowback": "orange",
    "analyzer": "green",
}