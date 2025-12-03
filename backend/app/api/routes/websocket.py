"""WebSocket endpoints for real-time features."""

import asyncio
import logging
from typing import Optional

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from kubernetes.client.rest import ApiException

from app.core.websocket_manager import ws_manager
from app.services.kubernetes_service import kubernetes_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.websocket("/pods/{namespace}/{pod_name}/logs")
async def websocket_pod_logs(
    websocket: WebSocket,
    namespace: str,
    pod_name: str,
    container: Optional[str] = Query(None),
    tail_lines: int = Query(100, ge=1, le=1000),
    timestamps: bool = Query(False),
):
    """
    WebSocket endpoint for real-time pod log streaming.

    Connect to stream logs from a specific pod container.
    First sends historical logs (tail_lines), then streams new logs in real-time.

    Message types sent:
    - {"type": "status", "status": "connected", "message": "..."}
    - {"type": "log", "content": "log line here"}
    - {"type": "error", "error": "...", "code": 500}
    """
    connection_id = None

    try:
        # Get container name if not specified
        if not container:
            try:
                pod_info = await kubernetes_service.get_pod(namespace, pod_name)
                if pod_info and pod_info.containers:
                    container = pod_info.containers[0]
                else:
                    await websocket.accept()
                    await websocket.send_json(
                        {"type": "error", "error": f"Pod {pod_name} not found or has no containers", "code": 404}
                    )
                    await websocket.close()
                    return
            except Exception as e:
                await websocket.accept()
                await websocket.send_json({"type": "error", "error": str(e), "code": 500})
                await websocket.close()
                return

        # Register connection
        connection_id = await ws_manager.connect(
            websocket=websocket, namespace=namespace, pod_name=pod_name, container=container, timestamps=timestamps
        )

        # Send connection status
        await ws_manager.send_status(
            connection_id, "connected", f"Streaming logs from {namespace}/{pod_name}/{container}"
        )

        # Create and start the log streaming task
        stream_task = asyncio.create_task(
            stream_logs(connection_id, namespace, pod_name, container, tail_lines, timestamps)
        )
        ws_manager.set_task(connection_id, stream_task)

        # Keep connection alive and listen for client messages
        try:
            while True:
                # Wait for any client message (e.g., ping or close)
                data = await websocket.receive_text()
                # Could handle client commands here (pause, resume, filter, etc.)
                if data == "ping":
                    await websocket.send_json({"type": "pong"})
        except WebSocketDisconnect:
            logger.info(f"Client disconnected: {connection_id}")

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected during setup")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        if connection_id:
            await ws_manager.send_error(connection_id, str(e), 500)
    finally:
        if connection_id:
            await ws_manager.disconnect(connection_id)


async def stream_logs(
    connection_id: str, namespace: str, pod_name: str, container: str, tail_lines: int, timestamps: bool
):
    """Stream logs from a pod to a WebSocket connection."""
    try:
        # First, send historical logs
        async for log_line in kubernetes_service.stream_pod_logs(
            namespace=namespace,
            pod_name=pod_name,
            container=container,
            tail_lines=tail_lines,
            timestamps=timestamps,
            follow=True,
        ):
            conn = ws_manager.get_connection(connection_id)
            if not conn:
                break
            await ws_manager.send_log(connection_id, log_line)

    except asyncio.CancelledError:
        logger.info(f"Log streaming cancelled for {connection_id}")
    except ApiException as e:
        if e.status == 404:
            await ws_manager.send_error(connection_id, f"Pod {pod_name} not found", 404)
        else:
            await ws_manager.send_error(connection_id, str(e), e.status or 500)
    except Exception as e:
        logger.error(f"Error streaming logs: {e}")
        await ws_manager.send_error(connection_id, str(e), 500)


@router.websocket("/health")
async def websocket_health(websocket: WebSocket):
    """Simple WebSocket health check endpoint."""
    await websocket.accept()
    await websocket.send_json({"status": "healthy", "connections": ws_manager.active_connections})
    await websocket.close()
