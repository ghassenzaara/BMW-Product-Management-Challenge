"""Copy the configured database (Supabase) into the local database, for a fast offline demo:
python -m app.mirror [--yes] [table ...]

``app.demo dump`` cannot read a server newer than the bundled pg_dump, so this copies table by
table with COPY. The local database gets the same migrations first; its own rows are replaced.
Nothing is written to the source. Without ``--yes`` it only lists the tables and their sizes.
"""

from __future__ import annotations

import sys
import time

import psycopg

from app import db, localdb, migrate
from app.config import get_settings


def _tables(conn) -> list[dict]:
    return conn.execute(
        "select c.relname as name, pg_total_relation_size(c.oid) as bytes from pg_class c"
        " join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'"
        " order by 2").fetchall()


def _columns(conn, table: str) -> list[str]:
    return [r["column_name"] for r in conn.execute(
        "select column_name from information_schema.columns where table_schema = 'public' and table_name = %s"
        " and is_generated = 'NEVER' order by ordinal_position", (table,)).fetchall()]


def run(apply: bool = False, only: list[str] | None = None) -> dict:
    settings = get_settings()
    if not settings.db_url:
        raise SystemExit("no remote database configured (SUPABASE_DB_URL is empty)")
    source_url, local_url = settings.db_url, localdb.start(settings.local_db_dir)
    with db.connect(source_url, autocommit=True) as src:
        src.execute("set statement_timeout = 0")  # the large tables take longer than Supabase's 2 min default
        tables = _tables(src)
        result = {"tables": len(tables), "MB": round(sum(t["bytes"] for t in tables) / 1e6)}
        if not apply:
            return {**result, "largest": [(t["name"], round(t["bytes"] / 1e6)) for t in tables[-6:]]}
        migrate.apply_all(local_url, verbose=False)
        with db.connect(local_url, autocommit=True) as dst:
            local = {t["name"] for t in _tables(dst)}
            todo = [t for t in tables if t["name"] in local and (not only or t["name"] in only)]
            # Foreign keys and the append-only audit triggers are switched off while the rows are replaced.
            dst.execute("set session_replication_role = replica")
            if only:  # named tables only: no cascade into the tables that are already copied
                for t in todo:
                    dst.execute(f'delete from public."{t["name"]}"')
            else:
                dst.execute("truncate " + ", ".join(f'public."{t["name"]}"' for t in todo) + " cascade")
            for t in todo:
                started = time.time()
                cols = [c for c in _columns(src, t["name"]) if c in set(_columns(dst, t["name"]))]
                collist = ", ".join(f'"{c}"' for c in cols)
                with src.cursor().copy(f'copy public."{t["name"]}" ({collist}) to stdout (format binary)') as out, \
                        dst.cursor().copy(f'copy public."{t["name"]}" ({collist}) from stdin (format binary)') as into:
                    for data in out:
                        into.write(data)
                print(f'{t["name"]}: {round(t["bytes"] / 1e6, 1)} MB, {round(time.time() - started)} s', flush=True)
            for s in src.execute("select sequencename, last_value from pg_sequences where schemaname = 'public'"
                                 " and last_value is not null").fetchall():
                try:
                    dst.execute("select setval(%s, %s)", (f'public."{s["sequencename"]}"', s["last_value"]))
                except psycopg.Error:
                    pass  # a sequence the local schema does not have
            dst.execute("set session_replication_role = origin")
            dst.execute("analyze")
            result["copied"] = len(todo)
            result["not in the local schema"] = [t["name"] for t in tables if t["name"] not in local]
    return result


if __name__ == "__main__":
    names = [a for a in sys.argv[1:] if not a.startswith("--")]  # table names: copy only these again
    print(run(apply="--yes" in sys.argv[1:], only=names or None))
