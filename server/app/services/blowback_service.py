from typing import Optional
from datetime import datetime
from app.domain.blowback_model import BlowbackSettings, BlowbackStatus, BlowbackRequest

class BlowbackService:
    def __init__(self):
        self.settings = BlowbackSettings()
        self.status = BlowbackStatus()
        self.is_running = False
        self.last_run = None
        self.next_run = None

    def get_settings(self) -> BlowbackSettings:
        return self.settings

    def update_settings(self, settings: BlowbackSettings) -> bool:
        self.settings = settings
        return True

    def get_status(self) -> BlowbackStatus:
        if self.settings.enable and self.settings.auto_mode:
            if self.last_run:
                self.next_run = self.last_run + timedelta(minutes=self.settings.interval_minutes)
            else:
                self.next_run = datetime.now() + timedelta(minutes=self.settings.interval_minutes)
        return BlowbackStatus(
            is_running=self.is_running,
            last_run=self.last_run,
            next_run=self.next_run,
            current_pressure=85.5,
            status_message="Ready" if not self.is_running else "Running"
        )

    def start_blowback(self, duration_seconds: Optional[int] = None) -> bool:
        if self.is_running:
            return False

        self.is_running = True
        self.status.status_message = "Blowback started"

        if duration_seconds:
            self.status.status_message = f"Blowback running for {duration_seconds} seconds"

        return True

    def stop_blowback(self) -> bool:
        if not self.is_running:
            return False

        self.is_running = False
        self.last_run = datetime.now()
        self.status.status_message = "Blowback stopped"

        return True

    def test_blowback(self) -> bool:
        self.status.status_message = "Test completed successfully"
        return True