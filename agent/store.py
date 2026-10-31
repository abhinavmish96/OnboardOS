"""SQLite store for ChatKit threads and items, so Onboardy's conversations survive a refresh
or a restart. One file, JSON rows, keyed by the admin's id."""

import json
import sqlite3
from pathlib import Path
from typing import Any

from chatkit.store import NotFoundError, Store
from chatkit.types import Attachment, Page, ThreadItem, ThreadMetadata
from pydantic import TypeAdapter

ITEM = TypeAdapter(ThreadItem)
ATTACHMENT = TypeAdapter(Attachment)
DB = Path(__file__).parent / ".data" / "onboardy.sqlite"


class SQLiteStore(Store[dict[str, Any]]):
    def __init__(self, path: Path = DB) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(path, check_same_thread=False)
        self.db.executescript(
            """
            create table if not exists threads (
              id text primary key, owner text not null, created_at text not null, data text not null);
            create table if not exists items (
              id text primary key, thread_id text not null, owner text not null,
              created_at text not null, data text not null);
            create index if not exists items_thread on items (thread_id, created_at);
            create table if not exists attachments (id text primary key, owner text, data text);
            """
        )

    @staticmethod
    def _owner(context: dict[str, Any]) -> str:
        return str(context.get("user_id") or "admin")

    async def load_thread(self, thread_id: str, context: dict[str, Any]) -> ThreadMetadata:
        row = self.db.execute(
            "select data from threads where id = ? and owner = ?", (thread_id, self._owner(context))
        ).fetchone()
        if row is None:
            raise NotFoundError(f"thread {thread_id} not found")
        return ThreadMetadata.model_validate_json(row[0])

    async def save_thread(self, thread: ThreadMetadata, context: dict[str, Any]) -> None:
        meta = ThreadMetadata.model_validate(thread.model_dump())  # metadata only, never items
        self.db.execute(
            "insert into threads (id, owner, created_at, data) values (?, ?, ?, ?) "
            "on conflict (id) do update set data = excluded.data",
            (meta.id, self._owner(context), meta.created_at.isoformat(), meta.model_dump_json()),
        )
        self.db.commit()

    async def load_threads(
        self, limit: int, after: str | None, order: str, context: dict[str, Any]
    ) -> Page[ThreadMetadata]:
        rows = self.db.execute(
            f"select id, data from threads where owner = ? order by created_at {'desc' if order == 'desc' else 'asc'}",
            (self._owner(context),),
        ).fetchall()
        return _page([(r[0], ThreadMetadata.model_validate_json(r[1])) for r in rows], after, limit)

    async def delete_thread(self, thread_id: str, context: dict[str, Any]) -> None:
        owner = self._owner(context)
        self.db.execute("delete from items where thread_id = ? and owner = ?", (thread_id, owner))
        self.db.execute("delete from threads where id = ? and owner = ?", (thread_id, owner))
        self.db.commit()

    async def load_thread_items(
        self, thread_id: str, after: str | None, limit: int, order: str, context: dict[str, Any]
    ) -> Page[ThreadItem]:
        rows = self.db.execute(
            f"select id, data from items where thread_id = ? and owner = ? "
            f"order by created_at {'desc' if order == 'desc' else 'asc'}, rowid {'desc' if order == 'desc' else 'asc'}",
            (thread_id, self._owner(context)),
        ).fetchall()
        return _page([(r[0], ITEM.validate_json(r[1])) for r in rows], after, limit)

    async def add_thread_item(self, thread_id: str, item: ThreadItem, context: dict[str, Any]) -> None:
        await self.save_item(thread_id, item, context)

    async def save_item(self, thread_id: str, item: ThreadItem, context: dict[str, Any]) -> None:
        self.db.execute(
            "insert into items (id, thread_id, owner, created_at, data) values (?, ?, ?, ?, ?) "
            "on conflict (id) do update set data = excluded.data",
            (item.id, thread_id, self._owner(context), item.created_at.isoformat(), ITEM.dump_json(item).decode()),
        )
        self.db.commit()

    async def load_item(self, thread_id: str, item_id: str, context: dict[str, Any]) -> ThreadItem:
        row = self.db.execute(
            "select data from items where id = ? and thread_id = ? and owner = ?",
            (item_id, thread_id, self._owner(context)),
        ).fetchone()
        if row is None:
            raise NotFoundError(f"item {item_id} not found")
        return ITEM.validate_json(row[0])

    async def delete_thread_item(self, thread_id: str, item_id: str, context: dict[str, Any]) -> None:
        self.db.execute(
            "delete from items where id = ? and thread_id = ? and owner = ?",
            (item_id, thread_id, self._owner(context)),
        )
        self.db.commit()

    async def save_attachment(self, attachment: Attachment, context: dict[str, Any]) -> None:
        self.db.execute(
            "insert or replace into attachments (id, owner, data) values (?, ?, ?)",
            (attachment.id, self._owner(context), ATTACHMENT.dump_json(attachment).decode()),
        )
        self.db.commit()

    async def load_attachment(self, attachment_id: str, context: dict[str, Any]) -> Attachment:
        row = self.db.execute("select data from attachments where id = ?", (attachment_id,)).fetchone()
        if row is None:
            raise NotFoundError(f"attachment {attachment_id} not found")
        return ATTACHMENT.validate_json(row[0])

    async def delete_attachment(self, attachment_id: str, context: dict[str, Any]) -> None:
        self.db.execute("delete from attachments where id = ?", (attachment_id,))
        self.db.commit()


def _page(rows: list[tuple[str, Any]], after: str | None, limit: int) -> Page[Any]:
    start = 0
    if after:
        ids = [r[0] for r in rows]
        start = ids.index(after) + 1 if after in ids else 0
    chunk = rows[start : start + limit]
    has_more = start + limit < len(rows)
    return Page(data=[r[1] for r in chunk], has_more=has_more, after=chunk[-1][0] if chunk and has_more else None)


def dumps(obj: Any) -> str:
    return json.dumps(obj, default=str)
