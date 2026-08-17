from fastapi import APIRouter, Depends

from app.engagement.deps import get_current_user

router = APIRouter(tags=["me"])


@router.get("/me")
def get_me(user: dict = Depends(get_current_user)) -> dict:
    # `id` is an INTEGER in Postgres, so it comes back from get_current_user as a
    # Python int — but every other id-shaped field in this API is a string (UUID),
    # and the frontend's User type declares id: string. Left as a raw int, it
    # round-trips as a JSON number, and any request body built from it directly
    # (e.g. project_manager_id) hits Pydantic's strict str validation as a bare
    # int and fails with an opaque 422. Stringify only in this response so the
    # wire shape matches the declared contract, without touching user["id"]'s
    # int type anywhere it's used internally in the backend.
    return {"data": {**user, "id": str(user["id"])}}
