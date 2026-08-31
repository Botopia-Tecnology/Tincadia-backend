"""
Auditoria de salas LiveKit: detecta salas zombie (bots sin humanos) que
siguen facturando minutos de participante.

Uso:
    python livekit_rooms.py            # solo lista (no borra nada)
    python livekit_rooms.py --clean    # cierra las salas sin humanos

Credenciales: toma LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET del entorno.
"""
import argparse
import asyncio
import datetime
import os
import sys

from livekit import api

AGENT_PREFIX = "transcriber-"


def _fmt(delta: datetime.timedelta) -> str:
    s = int(delta.total_seconds())
    h, m = divmod(s // 60, 60)
    d, h = divmod(h, 24)
    return f"{d}d {h}h {m}m" if d else f"{h}h {m}m"


async def main(clean: bool) -> int:
    url = os.getenv("LIVEKIT_URL")
    key = os.getenv("LIVEKIT_API_KEY")
    secret = os.getenv("LIVEKIT_API_SECRET")
    if not (url and key and secret):
        print("ERROR: faltan LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET")
        return 2

    # El SDK de servidor espera https://, no wss://
    url = url.replace("wss://", "https://").replace("ws://", "http://")

    lk = api.LiveKitAPI(url, key, secret)
    zombies = []
    try:
        rooms = await lk.room.list_rooms(api.ListRoomsRequest())
        now = datetime.datetime.now(datetime.timezone.utc)
        print(f"=== {len(rooms.rooms)} sala(s) activa(s) ===\n")

        for r in rooms.rooms:
            created = datetime.datetime.fromtimestamp(r.creation_time, datetime.timezone.utc)
            ps = await lk.room.list_participants(api.ListParticipantsRequest(room=r.name))
            humans = [p for p in ps.participants if not p.identity.startswith(AGENT_PREFIX)]
            bots = [p for p in ps.participants if p.identity.startswith(AGENT_PREFIX)]

            flag = "ZOMBIE" if (bots and not humans) else "ok"
            print(f"[{flag}] {r.name}")
            print(f"    edad={_fmt(now - created)}  humanos={len(humans)}  bots={len(bots)}")
            for p in ps.participants:
                joined = datetime.datetime.fromtimestamp(p.joined_at, datetime.timezone.utc)
                print(f"      - {p.identity}  (conectado hace {_fmt(now - joined)})")

            if bots and not humans:
                zombies.append(r.name)
            print()

        if not zombies:
            print("No hay salas zombie.")
            return 0

        print(f"Salas zombie detectadas: {len(zombies)}")
        if not clean:
            print("Ejecuta con --clean para cerrarlas.")
            return 0

        for name in zombies:
            await lk.room.delete_room(api.DeleteRoomRequest(room=name))
            print(f"  cerrada: {name}")
        print(f"\n{len(zombies)} sala(s) cerrada(s).")
        return 0
    finally:
        await lk.aclose()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--clean", action="store_true", help="cerrar las salas sin humanos")
    args = ap.parse_args()
    sys.exit(asyncio.run(main(args.clean)))
