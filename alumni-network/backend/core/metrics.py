import asyncio
import logging

import psutil

from core.db import get_pool

logger = logging.getLogger(__name__)

_sampler_task: asyncio.Task | None = None


async def get_current_cpu_usage_pct(sample_ms: int = 200) -> int:
    return round(await asyncio.to_thread(psutil.cpu_percent, sample_ms / 1000))


def get_current_memory_usage_pct() -> int:
    return round(psutil.virtual_memory().percent)


async def _sample_loop():
    while True:
        try:
            cpu = await get_current_cpu_usage_pct()
            memory = get_current_memory_usage_pct()
            await get_pool().execute("INSERT INTO system_metrics_samples (cpu_pct, memory_pct) VALUES ($1, $2)", cpu, memory)
        except Exception:
            logger.exception("Failed to record system metrics sample")
        await asyncio.sleep(5 * 60)


def ensure_metrics_sampler() -> None:
    global _sampler_task
    if _sampler_task is not None and not _sampler_task.done():
        return
    _sampler_task = asyncio.create_task(_sample_loop())


def stop_metrics_sampler() -> None:
    global _sampler_task
    if _sampler_task is not None:
        _sampler_task.cancel()
        _sampler_task = None
