from fastapi import WebSocket
from typing import List, Dict
import asyncio
import json
from datetime import datetime
from app.domain.websocket_model import WebSocketMessage, DataMessage, StatusMessage

class WebSocketService:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.data_connections: List[WebSocket] = []
        self.status_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket, connection_type: str):
        await websocket.accept()
        self.active_connections.append(websocket)

        if connection_type == "data":
            self.data_connections.append(websocket)
        elif connection_type == "status":
            self.status_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        if websocket in self.data_connections:
            self.data_connections.remove(websocket)
        if websocket in self.status_connections:
            self.status_connections.remove(websocket)

    async def send_message(self, message: DataMessage):
        if self.data_connections:
            message_data = {
                "type": message.type,
                "data": [data.dict() for data in message.data],
                "timestamp": message.timestamp.isoformat()
            }
            for connection in self.data_connections:
                try:
                    await connection.send_text(json.dumps(message_data))
                except:
                    self.disconnect(connection)

    async def send_status_message(self, message: StatusMessage):
        if self.status_connections:
            message_data = {
                "type": "status",
                "data": message.dict(),
                "timestamp": message.timestamp.isoformat()
            }
            for connection in self.status_connections:
                try:
                    await connection.send_text(json.dumps(message_data))
                except:
                    self.disconnect(connection)