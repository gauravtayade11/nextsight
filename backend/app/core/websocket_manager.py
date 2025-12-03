"""WebSocket connection manager for real-time features."""

import asyncio
import logging
from dataclasses import dataclass
from typing import Dict

from fastapi import WebSocket

logger = logging.getLogger(__name__)


@dataclass
class LogStreamConnection:
    """Represents a single log streaming connection."""

    websocket: WebSocket
    namespace: str
    pod_name: str
    container: str
    timestamps: bool = False
    task: asyncio.Task = None


class WebSocketManager:
    """Manages WebSocket connections for real-time log streaming."""

    def __init__(self):
        self._connections: Dict[str, LogStreamConnection] = {}
        self._lock = asyncio.Lock()

    def _get_connection_id(self, websocket: WebSocket) -> str:
        """Generate unique ID for a connection."""
        return f"{id(websocket)}"

    async def connect(
        self, websocket: WebSocket, namespace: str, pod_name: str, container: str, timestamps: bool = False
    ) -> str:
        """Accept a new WebSocket connection."""
        await websocket.accept()
        connection_id = self._get_connection_id(websocket)

        async with self._lock:
            self._connections[connection_id] = LogStreamConnection(
                websocket=websocket, namespace=namespace, pod_name=pod_name, container=container, timestamps=timestamps
            )

        logger.info(f"WebSocket connected: {connection_id} for {namespace}/{pod_name}/{container}")
        return connection_id

    async def disconnect(self, connection_id: str):
        """Remove a WebSocket connection."""
        async with self._lock:
            if connection_id in self._connections:
                conn = self._connections[connection_id]
                if conn.task and not conn.task.done():
                    conn.task.cancel()
                    try:
                        await conn.task
                    except asyncio.CancelledError:
                        pass
                del self._connections[connection_id]
                logger.info(f"WebSocket disconnected: {connection_id}")

    async def send_log(self, connection_id: str, log_line: str):
        """Send a log line to a specific connection."""
        async with self._lock:
            conn = self._connections.get(connection_id)

        if conn:
            try:
                await conn.websocket.send_json({"type": "log", "content": log_line})
            except Exception as e:
                logger.error(f"Error sending log to {connection_id}: {e}")
                await self.disconnect(connection_id)

    async def send_status(self, connection_id: str, status: str, message: str = ""):
        """Send a status message to a connection."""
        async with self._lock:
            conn = self._connections.get(connection_id)

        if conn:
            try:
                await conn.websocket.send_json({"type": "status", "status": status, "message": message})
            except Exception as e:
                logger.error(f"Error sending status to {connection_id}: {e}")

    async def send_error(self, connection_id: str, error: str, code: int = 500):
        """Send an error message to a connection."""
        async with self._lock:
            conn = self._connections.get(connection_id)

        if conn:
            try:
                await conn.websocket.send_json({"type": "error", "error": error, "code": code})
            except Exception as e:
                logger.error(f"Error sending error to {connection_id}: {e}")

    def get_connection(self, connection_id: str) -> LogStreamConnection:
        """Get connection details."""
        return self._connections.get(connection_id)

    def set_task(self, connection_id: str, task: asyncio.Task):
        """Associate a streaming task with a connection."""
        if connection_id in self._connections:
            self._connections[connection_id].task = task

    @property
    def active_connections(self) -> int:
        """Get count of active connections."""
        return len(self._connections)


# Global instance
ws_manager = WebSocketManager()
