"""Acceptance adapter to the canonical GORGONA PostgreSQL/browser fixtures.

Run with GORGONA_API_DIR pointing to an existing platform api/ checkout, using
that checkout's Python environment and GBA_TEST_ADMIN_DSN. No backend is copied.
"""

import asyncio
import os
import selectors
import shutil
import socket
import subprocess
import sys
import threading
import time
from pathlib import Path

API = Path(os.environ["GORGONA_API_DIR"]).resolve()
SITE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API))
sys.path.insert(0, str(API / "src"))

import psycopg  # noqa: E402
import pytest  # noqa: E402
import uvicorn  # noqa: E402
from pydantic import SecretStr  # noqa: E402

from gorgona_booking.api.app import create_app  # noqa: E402
from gorgona_booking.config import Settings  # noqa: E402
from gorgona_booking.db.provisioning import owner_tenant_transaction  # noqa: E402
from tests.integration.booking_support import BookingWorld  # noqa: E402
from tests.integration.conftest import ProvisionedDatabase  # noqa: E402
from tests.integration.customer_support import customer_day, seed_customer_setup  # noqa: E402

pytest_plugins = ["tests.integration.conftest"]
pytestmark = pytest.mark.postgres


def port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def test_site_to_real_gorgona(
    world: BookingWorld,
    owner_conn: psycopg.Connection,
    test_database: ProvisionedDatabase,
) -> None:
    npm = shutil.which("npm.cmd" if os.name == "nt" else "npm")
    assert npm is not None
    api_port, site_port = port(), port()
    host = f"127.0.0.1:{api_port}"
    seed_customer_setup(owner_conn, world)
    with owner_tenant_transaction(owner_conn, world.a.tenant_id):
        owner_conn.execute(
            "insert into gba.tenant_hosts (host, tenant_id) values (%s, %s)",
            (host, world.a.tenant_id),
        )
    app = create_app(
        Settings(
            environment="test",
            database_url=SecretStr(test_database.app_dsn),
            customer_web_dir=API.parent / "web/out",
        )
    )
    server = uvicorn.Server(
        uvicorn.Config(app, host="127.0.0.1", port=api_port, log_level="error", access_log=False, proxy_headers=False)
    )

    def serve() -> None:
        if os.name == "nt":
            asyncio.run(server.serve(), loop_factory=lambda: asyncio.SelectorEventLoop(selectors.SelectSelector()))
        else:
            asyncio.run(server.serve())

    thread = threading.Thread(target=serve, daemon=True)
    thread.start()
    try:
        deadline = time.monotonic() + 15
        while not server.started and thread.is_alive() and time.monotonic() < deadline:
            time.sleep(0.05)
        assert server.started
        env = {
            key: value for key, value in os.environ.items()
            if not any(word in key.upper() for word in ("DSN", "DATABASE_URL", "SECRET", "PASSWORD", "TOKEN", "API_KEY"))
        }
        env.update(
            NEXT_PUBLIC_GORGONA_BOOKING_URL=f"http://{host}/book/",
            KA_BOOKING_TEST_URL=f"http://{host}/book/",
            KA_SITE_PORT=str(site_port),
            GBA_BROWSER_DAY=customer_day(),
        )
        for args in (["run", "build"], ["run", "test:e2e", "--", "--grep-invert", "unconfigured salon"]):
            result = subprocess.run([npm, *args], cwd=SITE, env=env, capture_output=True, encoding="utf-8", errors="replace", timeout=180, check=False)
            assert result.returncode == 0, result.stdout + result.stderr
            print(result.stdout)
        with owner_tenant_transaction(owner_conn, world.a.tenant_id):
            row = owner_conn.execute(
                "select count(*) from gba.bookings b join gba.booking_customers c "
                "on c.tenant_id=b.tenant_id and c.booking_id=b.id "
                "where b.status='CONFIRMED' and c.customer_name='FAKE KA Website Guest'"
            ).fetchone()
            assert row == (2,), "Each real browser project must persist a confirmed appointment"
        with owner_tenant_transaction(owner_conn, world.b.tenant_id):
            assert owner_conn.execute("select count(*) from gba.booking_customers").fetchone() == (0,)
    finally:
        server.should_exit = True
        thread.join(timeout=10)
        assert not thread.is_alive()
