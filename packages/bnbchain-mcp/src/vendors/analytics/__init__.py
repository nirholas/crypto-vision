"""
@author Nich
@website x.com/nichxbt
@github github.com/nirholas
@license MIT
"""
import asyncio

from . import server


def main() -> None:
    asyncio.run(server.main())


__all__ = ["main", "server"]
