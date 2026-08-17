from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

from core.db import close_pool, connect_pool, ensure_schema
from core.metrics import stop_metrics_sampler
from routers import (
    admin,
    alumni_directory,
    announcements,
    assistant,
    auth,
    benefits,
    cms,
    connections,
    contact_messages,
    documents,
    events,
    faqs,
    feedback,
    forum,
    group_messages,
    hr,
    hr_communications,
    messages,
    notifications,
    presence,
    register,
    service_requests,
    settings as settings_router,
    staff_notifications,
    stories,
    system_settings,
    users,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_pool()
    await ensure_schema()
    yield
    stop_metrics_sampler()
    await close_pool()


app = FastAPI(title="TechDemocracy Alumni Network API", lifespan=lifespan)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    # Match the existing frontend's expected error shape: { error: "<message>" }
    return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})


app.include_router(auth.router)
app.include_router(register.router)
app.include_router(presence.router)
app.include_router(system_settings.router)
app.include_router(alumni_directory.router)
app.include_router(benefits.router)
app.include_router(service_requests.router)
app.include_router(events.router)
app.include_router(connections.router)
app.include_router(messages.router)
app.include_router(group_messages.router)
app.include_router(forum.router)
app.include_router(stories.router)
app.include_router(announcements.router)
app.include_router(faqs.router)
app.include_router(notifications.router)
app.include_router(documents.router)
app.include_router(settings_router.router)
app.include_router(feedback.router)
app.include_router(users.router)
app.include_router(hr.router)
app.include_router(hr_communications.router)
app.include_router(staff_notifications.router)
app.include_router(contact_messages.router)
app.include_router(admin.router)
app.include_router(cms.router)
app.include_router(assistant.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
