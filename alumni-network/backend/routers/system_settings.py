from fastapi import APIRouter

from core.settings_cache import get_system_settings

router = APIRouter(prefix="/api/system-settings")


@router.get("/public")
async def public_settings():
    settings = await get_system_settings()
    return {
        "portalName": settings["portalName"],
        "supportEmail": settings["supportEmail"],
        "enablePublicLandingPage": settings["enablePublicLandingPage"],
        "allowNewRegistrations": settings["allowNewRegistrations"],
        "showAlumniStatsOnLanding": settings["showAlumniStatsOnLanding"],
        "maintenanceMode": settings["maintenanceMode"],
    }
