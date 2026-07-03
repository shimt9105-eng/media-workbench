import json
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "data" / "media_insights.sqlite"

TABLES = {
    "content_creation": "content_creation_records",
    "user_pain": "user_pain_records",
}


def connect():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init(_payload):
    with connect() as conn:
        for table in TABLES.values():
            conn.execute(
                f"""
                CREATE TABLE IF NOT EXISTS {table} (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
                    input_type TEXT NOT NULL,
                    text_input TEXT,
                    skill_name TEXT NOT NULL,
                    files_json TEXT,
                    ocr_text TEXT,
                    prompt TEXT,
                    output_json TEXT NOT NULL,
                    title TEXT,
                    summary TEXT
                )
                """
            )
        legacy = conn.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'insight_records'"
        ).fetchone()
        if legacy:
            conn.execute(
                """
                INSERT INTO content_creation_records (
                    created_at, input_type, text_input, skill_name, files_json,
                    ocr_text, prompt, output_json, title, summary
                )
                SELECT
                    created_at, input_type, text_input, skill_name, files_json,
                    ocr_text, prompt, output_json, title, summary
                FROM insight_records
                """
            )
            conn.execute("DROP TABLE insight_records")
    return {"ok": True}


def table_for(payload):
    analysis_type = payload.get("analysis_type", "content_creation")
    if analysis_type not in TABLES:
        raise SystemExit(f"unknown analysis_type: {analysis_type}")
    return TABLES[analysis_type]


def insert(payload):
    table = table_for(payload)
    with connect() as conn:
        cursor = conn.execute(
            f"""
            INSERT INTO {table} (
                input_type, text_input, skill_name, files_json, ocr_text,
                prompt, output_json, title, summary
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                payload.get("input_type", ""),
                payload.get("text_input", ""),
                payload.get("skill_name", ""),
                json.dumps(payload.get("files_json", []), ensure_ascii=False),
                payload.get("ocr_text", ""),
                payload.get("prompt", ""),
                json.dumps(payload.get("output_json", {}), ensure_ascii=False),
                payload.get("title", ""),
                payload.get("summary", ""),
            ),
        )
        conn.commit()
        return {"id": cursor.lastrowid}


def list_records(_payload):
    with connect() as conn:
        rows = conn.execute(
            """
            SELECT
                'content_creation' AS analysis_type,
                'content_creation:' || id AS record_key,
                id, created_at, input_type, skill_name, title, summary
            FROM content_creation_records
            UNION ALL
            SELECT
                'user_pain' AS analysis_type,
                'user_pain:' || id AS record_key,
                id, created_at, input_type, skill_name, title, summary
            FROM user_pain_records
            ORDER BY created_at DESC, id DESC
            LIMIT 50
            """
        ).fetchall()
        return [dict(row) for row in rows]


def get(payload):
    table = table_for(payload)
    with connect() as conn:
        row = conn.execute(
            f"SELECT * FROM {table} WHERE id = ?",
            (payload["id"],),
        ).fetchone()
        if not row:
            raise SystemExit("record not found")
        data = dict(row)
        data["analysis_type"] = payload.get("analysis_type")
        data["record_key"] = f"{payload.get('analysis_type')}:{data['id']}"
        data["files_json"] = json.loads(data.get("files_json") or "[]")
        data["output_json"] = json.loads(data.get("output_json") or "{}")
        return data


ACTIONS = {
    "init": init,
    "insert": insert,
    "list": list_records,
    "get": get,
}


def main():
    action = sys.argv[1]
    payload = json.loads(sys.stdin.read() or "{}")
    if action not in ACTIONS:
        raise SystemExit(f"unknown action: {action}")
    print(json.dumps(ACTIONS[action](payload), ensure_ascii=False))


if __name__ == "__main__":
    main()
