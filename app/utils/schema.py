from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

_column_cache: dict[tuple[str, str], bool] = {}


async def table_has_column(
    db: AsyncSession,
    table_name: str,
    column_name: str,
) -> bool:
    """Return whether the current schema has a given column on a table."""
    cache_key = (table_name, column_name)
    cached = _column_cache.get(cache_key)
    if cached is not None:
        return cached

    result = await db.execute(
        text(
            """
            select 1
            from information_schema.columns
            where table_schema = current_schema()
              and table_name = :table_name
              and column_name = :column_name
            limit 1
            """
        ),
        {
            "table_name": table_name,
            "column_name": column_name,
        },
    )
    exists = result.scalar_one_or_none() is not None
    _column_cache[cache_key] = exists
    return exists
