"""
@author nich
@website x.com/nichxbt
@github github.com/nirholas
@license Apache-2.0
"""
import asyncio

from . import server


def main() -> None:
    asyncio.run(server.main())


__all__ = ["main", "server"]
