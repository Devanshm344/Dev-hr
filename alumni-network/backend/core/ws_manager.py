from typing import Dict, Set

from fastapi import WebSocket
from fastapi.encoders import jsonable_encoder


class ConnectionManager:
    def __init__(self) -> None:
        self.active: Dict[int, Set[WebSocket]] = {}

    def connect(self, user_id: int, websocket: WebSocket) -> None:
        self.active.setdefault(user_id, set()).add(websocket)

    def disconnect(self, user_id: int, websocket: WebSocket) -> None:
        conns = self.active.get(user_id)
        if not conns:
            return
        conns.discard(websocket)
        if not conns:
            self.active.pop(user_id, None)

    def is_online(self, user_id: int) -> bool:
        return bool(self.active.get(user_id))

    async def send_to_user(self, user_id: int, payload: dict) -> None:
        encoded = jsonable_encoder(payload)
        for ws in list(self.active.get(user_id, ())):
            try:
                await ws.send_json(encoded)
            except Exception:
                self.disconnect(user_id, ws)


manager = ConnectionManager()
