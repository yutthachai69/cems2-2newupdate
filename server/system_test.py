#!/usr/bin/env python3
"""
System Performance Test for CEMS Project
ทดสอบสเปกเครื่องสำหรับระบบ CEMS
"""

import psutil
import platform
import time
import threading
import subprocess
import sys
from datetime import datetime

class SystemTester:
    def __init__(self):
        self.results = {}
        
    def test_cpu_performance(self):
        """ทดสอบประสิทธิภาพ CPU"""
        print("🔄 Testing CPU Performance...")
        
        # ทดสอบ CPU intensive task
        start_time = time.time()
        result = sum(i*i for i in range(1000000))
        cpu_time = time.time() - start_time
        
        cpu_info = {
            "cores": psutil.cpu_count(logical=False),
            "threads": psutil.cpu_count(logical=True),
            "frequency": psutil.cpu_freq().current if psutil.cpu_freq() else "Unknown",
            "usage": psutil.cpu_percent(interval=1),
            "test_time": round(cpu_time, 3)
        }
        
        self.results["cpu"] = cpu_info
        print(f"✅ CPU Test: {cpu_time:.3f}s (Cores: {cpu_info['cores']}, Threads: {cpu_info['threads']})")
        return cpu_info
        
    def test_memory_performance(self):
        """ทดสอบประสิทธิภาพ RAM"""
        print("🔄 Testing Memory Performance...")
        
        # ทดสอบ memory allocation
        start_time = time.time()
        test_data = []
        for i in range(100000):
            test_data.append([i] * 100)
        
        memory_time = time.time() - start_time
        del test_data  # Free memory
        
        memory_info = {
            "total_gb": round(psutil.virtual_memory().total / (1024**3), 2),
            "available_gb": round(psutil.virtual_memory().available / (1024**3), 2),
            "usage_percent": psutil.virtual_memory().percent,
            "test_time": round(memory_time, 3)
        }
        
        self.results["memory"] = memory_info
        print(f"✅ Memory Test: {memory_time:.3f}s (Total: {memory_info['total_gb']}GB, Available: {memory_info['available_gb']}GB)")
        return memory_info
        
    def test_disk_performance(self):
        """ทดสอบประสิทธิภาพ Disk"""
        print("🔄 Testing Disk Performance...")
        
        # ทดสอบ disk I/O
        start_time = time.time()
        test_file = "temp_test.txt"
        
        # Write test
        with open(test_file, 'w') as f:
            for i in range(10000):
                f.write(f"Test line {i}\n")
        
        write_time = time.time() - start_time
        
        # Read test
        start_time = time.time()
        with open(test_file, 'r') as f:
            content = f.read()
        read_time = time.time() - start_time
        
        # Cleanup
        import os
        os.remove(test_file)
        
        disk_info = {
            "total_gb": round(psutil.disk_usage('/').total / (1024**3), 2) if platform.system() != 'Windows' else round(psutil.disk_usage('C:').total / (1024**3), 2),
            "free_gb": round(psutil.disk_usage('/').free / (1024**3), 2) if platform.system() != 'Windows' else round(psutil.disk_usage('C:').free / (1024**3), 2),
            "write_time": round(write_time, 3),
            "read_time": round(read_time, 3)
        }
        
        self.results["disk"] = disk_info
        print(f"✅ Disk Test: Write {write_time:.3f}s, Read {read_time:.3f}s")
        return disk_info
        
    def test_network_performance(self):
        """ทดสอบประสิทธิภาพ Network"""
        print("🔄 Testing Network Performance...")
        
        try:
            # ทดสอบ ping to localhost
            start_time = time.time()
            if platform.system() == 'Windows':
                result = subprocess.run(['ping', '-n', '1', '127.0.0.1'], 
                                      capture_output=True, text=True, timeout=5)
            else:
                result = subprocess.run(['ping', '-c', '1', '127.0.0.1'], 
                                      capture_output=True, text=True, timeout=5)
            ping_time = time.time() - start_time
            
            network_info = {
                "ping_localhost": round(ping_time, 3),
                "status": "Connected" if result.returncode == 0 else "Failed"
            }
        except Exception as e:
            network_info = {
                "ping_localhost": "Error",
                "status": f"Error: {str(e)}"
            }
        
        self.results["network"] = network_info
        print(f"✅ Network Test: {network_info['status']}")
        return network_info
        
    def test_python_dependencies(self):
        """ทดสอบ Python Dependencies"""
        print("🔄 Testing Python Dependencies...")
        
        required_packages = [
            'fastapi', 'uvicorn', 'influxdb-client', 'psutil', 
            'pydantic', 'sqlalchemy', 'websockets'
        ]
        
        dependencies_info = {}
        for package in required_packages:
            try:
                __import__(package.replace('-', '_'))
                dependencies_info[package] = "✅ Installed"
            except ImportError:
                dependencies_info[package] = "❌ Missing"
        
        self.results["dependencies"] = dependencies_info
        print(f"✅ Dependencies Test: {sum(1 for v in dependencies_info.values() if '✅' in v)}/{len(required_packages)} installed")
        return dependencies_info
        
    def test_cems_system_load(self):
        """ทดสอบโหลดระบบ CEMS"""
        print("🔄 Testing CEMS System Load...")
        
        # Simulate CEMS data processing
        start_time = time.time()
        
        # Simulate data collection
        data_points = []
        for i in range(1000):
            data_point = {
                "timestamp": datetime.now(),
                "SO2": 10.5 + (i % 100),
                "NOx": 20.3 + (i % 80),
                "O2": 18.2 + (i % 50),
                "CO": 12.7 + (i % 60),
                "Dust": 8.5 + (i % 40),
                "Temperature": 125.5 + (i % 200),
                "Velocity": 15.8 + (i % 30),
                "Flowrate": 1200.0 + (i % 500),
                "Pressure": 1013.25 + (i % 100)
            }
            data_points.append(data_point)
        
        processing_time = time.time() - start_time
        
        # Simulate corrected values calculation
        start_time = time.time()
        for data_point in data_points[:100]:  # Test with 100 points
            if data_point["O2"] > 0:
                correction_factor = 21.0 / (21.0 - data_point["O2"])
                data_point["SO2Corr"] = data_point["SO2"] * correction_factor
                data_point["NOxCorr"] = data_point["NOx"] * correction_factor
        
        correction_time = time.time() - start_time
        
        cems_info = {
            "data_processing_time": round(processing_time, 3),
            "correction_calculation_time": round(correction_time, 3),
            "total_data_points": len(data_points),
            "points_per_second": round(100 / correction_time, 2) if correction_time > 0 else "N/A"
        }
        
        self.results["cems_load"] = cems_info
        print(f"✅ CEMS Load Test: {processing_time:.3f}s processing, {correction_time:.3f}s correction")
        return cems_info
        
    def run_all_tests(self):
        """รันการทดสอบทั้งหมด"""
        print("🚀 Starting System Performance Test for CEMS Project")
        print("=" * 60)
        
        start_time = time.time()
        
        # Run all tests
        self.test_cpu_performance()
        self.test_memory_performance()
        self.test_disk_performance()
        self.test_network_performance()
        self.test_python_dependencies()
        self.test_cems_system_load()
        
        total_time = time.time() - start_time
        
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        # System info
        print(f"OS: {platform.system()} {platform.release()}")
        print(f"Python: {sys.version}")
        print(f"Architecture: {platform.architecture()[0]}")
        
        # Performance summary
        cpu = self.results.get("cpu", {})
        memory = self.results.get("memory", {})
        disk = self.results.get("disk", {})
        cems = self.results.get("cems_load", {})
        
        print(f"\n🎯 PERFORMANCE METRICS:")
        print(f"CPU: {cpu.get('cores', 'N/A')} cores, {cpu.get('test_time', 'N/A')}s test time")
        print(f"Memory: {memory.get('total_gb', 'N/A')}GB total, {memory.get('available_gb', 'N/A')}GB available")
        print(f"Disk: {disk.get('total_gb', 'N/A')}GB total, {disk.get('free_gb', 'N/A')}GB free")
        print(f"CEMS Processing: {cems.get('points_per_second', 'N/A')} points/second")
        
        # Recommendations
        print(f"\n💡 RECOMMENDATIONS:")
        
        if memory.get('total_gb', 0) < 4:
            print("⚠️  RAM < 4GB: Consider upgrading for better performance")
        elif memory.get('total_gb', 0) >= 8:
            print("✅ RAM >= 8GB: Excellent for CEMS system")
        else:
            print("✅ RAM 4-8GB: Good for CEMS system")
            
        if cpu.get('cores', 0) < 2:
            print("⚠️  CPU < 2 cores: May experience performance issues")
        elif cpu.get('cores', 0) >= 4:
            print("✅ CPU >= 4 cores: Excellent for CEMS system")
        else:
            print("✅ CPU 2-4 cores: Good for CEMS system")
            
        if cems.get('points_per_second', 0) < 100:
            print("⚠️  Processing speed < 100 points/sec: Consider optimization")
        else:
            print("✅ Processing speed >= 100 points/sec: Good performance")
        
        print(f"\n⏱️  Total test time: {total_time:.2f} seconds")
        
        # Save results to file
        self.save_results()
        
        return self.results
        
    def save_results(self):
        """บันทึกผลการทดสอบลงไฟล์"""
        import json
        
        report = {
            "timestamp": datetime.now().isoformat(),
            "system": {
                "os": f"{platform.system()} {platform.release()}",
                "python": sys.version,
                "architecture": platform.architecture()[0]
            },
            "results": self.results
        }
        
        filename = f"system_test_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(filename, 'w') as f:
            json.dump(report, f, indent=2, default=str)
        
        print(f"📄 Report saved to: {filename}")

if __name__ == "__main__":
    tester = SystemTester()
    tester.run_all_tests()
