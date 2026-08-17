def affected_count(status: str) -> int:
    """Parses asyncpg's execute() status tag, e.g. 'DELETE 1' or 'UPDATE 0'."""
    try:
        return int(status.rsplit(" ", 1)[-1])
    except (ValueError, IndexError):
        return 0


def build_set_clause(field_map: dict, body: dict, start_index: int = 1):
    """Mirrors the repeated Next.js pattern of building a dynamic UPDATE SET clause
    from a body-key -> column-name map. Returns (set_clauses, values)."""
    set_clauses: list[str] = []
    values: list = []
    idx = start_index
    for body_key, column in field_map.items():
        if body_key in body:
            values.append(body[body_key])
            set_clauses.append(f"{column} = ${idx}")
            idx += 1
    return set_clauses, values
