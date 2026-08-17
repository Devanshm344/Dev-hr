"""Connection pool + FastAPI dependency.

The dependency yields a connection whose transaction is committed when the
request handler finishes without error and rolled back otherwise. Services
that need multi-statement atomicity simply run their statements on this
connection — one request, one transaction.
"""
from collections.abc import Iterator
from contextlib import contextmanager

import psycopg2
import psycopg2.extras
from psycopg2.pool import ThreadedConnectionPool

from app.engagement.core.config import get_settings

psycopg2.extras.register_uuid()

_pool: ThreadedConnectionPool | None = None


def init_pool() -> None:
    global _pool
    if _pool is None:
        _pool = ThreadedConnectionPool(minconn=1, maxconn=10, dsn=get_settings().database_url)


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.closeall()
        _pool = None


@contextmanager
def connection() -> Iterator[psycopg2.extensions.connection]:
    if _pool is None:
        init_pool()
    assert _pool is not None
    conn = _pool.getconn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        _pool.putconn(conn)


def get_db() -> Iterator[psycopg2.extensions.connection]:
    with connection() as conn:
        yield conn


def dict_cursor(conn: psycopg2.extensions.connection):
    return conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
