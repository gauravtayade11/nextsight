"""WebSocket endpoints for real-time features."""

import asyncio
import json
import logging
import os
import pty
import select
import subprocess
from typing import Optional

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from kubernetes.client.rest import ApiException

from app.core.config import settings
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


@router.websocket("/pods/{namespace}/{pod_name}/exec")
async def websocket_pod_exec(
    websocket: WebSocket,
    namespace: str,
    pod_name: str,
    container: Optional[str] = Query(None),
    shell: str = Query("/bin/sh"),
):
    """
    WebSocket endpoint for interactive pod exec session.

    Provides a full PTY-based terminal session inside the container.

    Message types:
    - Client sends: {"type": "input", "data": "command\\n"} or raw text
    - Client sends: {"type": "resize", "cols": 80, "rows": 24}
    - Server sends: {"type": "output", "data": "..."}
    - Server sends: {"type": "status", "status": "connected|disconnected", "message": "..."}
    - Server sends: {"type": "error", "error": "...", "code": 500}
    """
    await websocket.accept()
    master_fd = None
    pid = None

    try:
        # Build kubectl exec command
        kubectl_cmd = ["kubectl"]
        if settings.K8S_CONFIG_PATH:
            config_path = os.path.expanduser(settings.K8S_CONFIG_PATH)
            kubectl_cmd.extend(["--kubeconfig", config_path])

        kubectl_cmd.extend(["exec", "-it", pod_name, "-n", namespace])
        if container:
            kubectl_cmd.extend(["-c", container])
        kubectl_cmd.extend(["--", shell])

        logger.info(f"Starting exec session: {' '.join(kubectl_cmd)}")

        # Create PTY and spawn kubectl exec
        pid, master_fd = pty.fork()

        if pid == 0:
            # Child process - exec kubectl
            os.execvp(kubectl_cmd[0], kubectl_cmd)
        else:
            # Parent process - handle WebSocket communication
            await websocket.send_json({
                "type": "status",
                "status": "connected",
                "message": f"Connected to {namespace}/{pod_name}"
            })

            # Set non-blocking mode
            os.set_blocking(master_fd, False)

            # Create tasks for reading from PTY and WebSocket
            async def read_from_pty():
                """Read output from PTY and send to WebSocket."""
                loop = asyncio.get_event_loop()
                while True:
                    try:
                        # Use select to check if data is available
                        readable, _, _ = select.select([master_fd], [], [], 0.1)
                        if readable:
                            data = os.read(master_fd, 4096)
                            if data:
                                await websocket.send_json({
                                    "type": "output",
                                    "data": data.decode("utf-8", errors="replace")
                                })
                            else:
                                # EOF - process terminated
                                break
                    except OSError:
                        break
                    await asyncio.sleep(0.01)

            async def read_from_websocket():
                """Read input from WebSocket and send to PTY."""
                while True:
                    try:
                        message = await websocket.receive()

                        if message["type"] == "websocket.disconnect":
                            break

                        if "text" in message:
                            text = message["text"]
                            try:
                                # Try to parse as JSON
                                data = json.loads(text)
                                if data.get("type") == "input":
                                    os.write(master_fd, data["data"].encode())
                                elif data.get("type") == "resize":
                                    # Handle terminal resize
                                    import fcntl
                                    import struct
                                    import termios
                                    cols = data.get("cols", 80)
                                    rows = data.get("rows", 24)
                                    winsize = struct.pack("HHHH", rows, cols, 0, 0)
                                    fcntl.ioctl(master_fd, termios.TIOCSWINSZ, winsize)
                            except json.JSONDecodeError:
                                # Raw text input
                                os.write(master_fd, text.encode())
                        elif "bytes" in message:
                            os.write(master_fd, message["bytes"])

                    except WebSocketDisconnect:
                        break
                    except Exception as e:
                        logger.error(f"Error reading from WebSocket: {e}")
                        break

            # Run both tasks concurrently
            pty_task = asyncio.create_task(read_from_pty())
            ws_task = asyncio.create_task(read_from_websocket())

            # Wait for either task to complete
            done, pending = await asyncio.wait(
                [pty_task, ws_task],
                return_when=asyncio.FIRST_COMPLETED
            )

            # Cancel pending tasks
            for task in pending:
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass

    except WebSocketDisconnect:
        logger.info(f"Exec WebSocket disconnected: {namespace}/{pod_name}")
    except Exception as e:
        logger.error(f"Exec WebSocket error: {e}")
        try:
            await websocket.send_json({"type": "error", "error": str(e), "code": 500})
        except Exception:
            pass
    finally:
        # Cleanup
        if master_fd is not None:
            try:
                os.close(master_fd)
            except Exception:
                pass
        if pid is not None and pid > 0:
            try:
                os.kill(pid, 9)
                os.waitpid(pid, 0)
            except Exception:
                pass
        try:
            await websocket.send_json({
                "type": "status",
                "status": "disconnected",
                "message": "Session ended"
            })
        except Exception:
            pass
        logger.info(f"Exec session ended: {namespace}/{pod_name}")


@router.websocket("/pods/{namespace}/{pod_name}/debug")
async def websocket_pod_debug(
    websocket: WebSocket,
    namespace: str,
    pod_name: str,
    container: Optional[str] = Query(None),
    image: str = Query("busybox:latest"),
    target_container: Optional[str] = Query(None),
):
    """
    WebSocket endpoint for debugging pods with ephemeral containers.

    Uses kubectl debug to attach a debug container to the pod.
    Useful for distroless containers that have no shell.

    Parameters:
    - image: Debug container image (default: busybox:latest)
    - target_container: Container to share process namespace with

    Message types:
    - Client sends: {"type": "input", "data": "command\\n"} or raw text
    - Client sends: {"type": "resize", "cols": 80, "rows": 24}
    - Server sends: {"type": "output", "data": "..."}
    - Server sends: {"type": "status", "status": "connected|disconnected", "message": "..."}
    - Server sends: {"type": "error", "error": "...", "code": 500}
    """
    await websocket.accept()
    master_fd = None
    pid = None

    try:
        # Build kubectl debug command
        kubectl_cmd = ["kubectl"]
        if settings.K8S_CONFIG_PATH:
            config_path = os.path.expanduser(settings.K8S_CONFIG_PATH)
            kubectl_cmd.extend(["--kubeconfig", config_path])

        kubectl_cmd.extend([
            "debug", "-it", pod_name,
            "-n", namespace,
            f"--image={image}",
        ])

        # If targeting a specific container, share its process namespace
        if target_container:
            kubectl_cmd.append(f"--target={target_container}")

        # Add shell command
        kubectl_cmd.extend(["--", "/bin/sh"])

        logger.info(f"Starting debug session: {' '.join(kubectl_cmd)}")

        # Create PTY and spawn kubectl debug
        pid, master_fd = pty.fork()

        if pid == 0:
            # Child process - exec kubectl
            os.execvp(kubectl_cmd[0], kubectl_cmd)
        else:
            # Parent process - handle WebSocket communication
            await websocket.send_json({
                "type": "status",
                "status": "connected",
                "message": f"Debug container attached to {namespace}/{pod_name}"
            })

            # Set non-blocking mode
            os.set_blocking(master_fd, False)

            # Create tasks for reading from PTY and WebSocket
            async def read_from_pty():
                """Read output from PTY and send to WebSocket."""
                while True:
                    try:
                        readable, _, _ = select.select([master_fd], [], [], 0.1)
                        if readable:
                            data = os.read(master_fd, 4096)
                            if data:
                                await websocket.send_json({
                                    "type": "output",
                                    "data": data.decode("utf-8", errors="replace")
                                })
                            else:
                                break
                    except OSError:
                        break
                    await asyncio.sleep(0.01)

            async def read_from_websocket():
                """Read input from WebSocket and send to PTY."""
                while True:
                    try:
                        message = await websocket.receive()

                        if message["type"] == "websocket.disconnect":
                            break

                        if "text" in message:
                            text = message["text"]
                            try:
                                data = json.loads(text)
                                if data.get("type") == "input":
                                    os.write(master_fd, data["data"].encode())
                                elif data.get("type") == "resize":
                                    import fcntl
                                    import struct
                                    import termios
                                    cols = data.get("cols", 80)
                                    rows = data.get("rows", 24)
                                    winsize = struct.pack("HHHH", rows, cols, 0, 0)
                                    fcntl.ioctl(master_fd, termios.TIOCSWINSZ, winsize)
                            except json.JSONDecodeError:
                                os.write(master_fd, text.encode())
                        elif "bytes" in message:
                            os.write(master_fd, message["bytes"])

                    except WebSocketDisconnect:
                        break
                    except Exception as e:
                        logger.error(f"Error reading from WebSocket: {e}")
                        break

            # Run both tasks concurrently
            pty_task = asyncio.create_task(read_from_pty())
            ws_task = asyncio.create_task(read_from_websocket())

            done, pending = await asyncio.wait(
                [pty_task, ws_task],
                return_when=asyncio.FIRST_COMPLETED
            )

            for task in pending:
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass

    except WebSocketDisconnect:
        logger.info(f"Debug WebSocket disconnected: {namespace}/{pod_name}")
    except Exception as e:
        logger.error(f"Debug WebSocket error: {e}")
        try:
            await websocket.send_json({"type": "error", "error": str(e), "code": 500})
        except Exception:
            pass
    finally:
        if master_fd is not None:
            try:
                os.close(master_fd)
            except Exception:
                pass
        if pid is not None and pid > 0:
            try:
                os.kill(pid, 9)
                os.waitpid(pid, 0)
            except Exception:
                pass
        try:
            await websocket.send_json({
                "type": "status",
                "status": "disconnected",
                "message": "Debug session ended"
            })
        except Exception:
            pass
        logger.info(f"Debug session ended: {namespace}/{pod_name}")
