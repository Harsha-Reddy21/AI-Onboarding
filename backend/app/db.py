"""
Database operations using SQLite
"""
import sqlite3
import json
from typing import Optional, List
from pathlib import Path
from app.config import DB_PATH
from app.logger import create_logger

log = create_logger("DB")

# Initialize database connection
_conn: Optional[sqlite3.Connection] = None

def get_db() -> sqlite3.Connection:
    global _conn
    if _conn is None:
        log.info("Initializing SQLite database", {"path": str(DB_PATH)})
        _conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
        _conn.row_factory = sqlite3.Row
        _conn.execute("PRAGMA journal_mode = WAL")
        initialize_tables()
        log.info("Database initialized successfully")
    return _conn

def initialize_tables():
    db = get_db()
    log.step("Creating tables if not exists...")

    # Projects table
    db.execute("""
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            github_url TEXT NOT NULL,
            repo_name TEXT NOT NULL,
            commit_sha TEXT DEFAULT '',
            status TEXT NOT NULL DEFAULT 'pending',
            project_md TEXT,
            error_message TEXT,
            created_at TEXT NOT NULL
        )
    """)

    # Documents table
    db.execute("""
        CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            diagram_url TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
    """)

    # Videos table
    db.execute("""
        CREATE TABLE IF NOT EXISTS videos (
            id TEXT PRIMARY KEY,
            document_id TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            video_url TEXT,
            transcript TEXT,
            storyboard TEXT,
            error_message TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
        )
    """)

    # Create indexes
    db.execute("CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents(project_id)")
    db.execute("CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type)")
    db.execute("CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status)")
    db.execute("CREATE INDEX IF NOT EXISTS idx_videos_document_id ON videos(document_id)")
    db.execute("CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status)")

    db.commit()
    log.info("Tables and indexes created")

# ============================================================================
# PROJECT OPERATIONS
# ============================================================================

def create_project(project: dict) -> dict:
    db = get_db()
    log.info("Creating project", {"id": project["id"], "repoName": project["repo_name"]})

    db.execute("""
        INSERT INTO projects (id, github_url, repo_name, commit_sha, status, project_md, error_message, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        project["id"],
        project["github_url"],
        project["repo_name"],
        project.get("commit_sha", ""),
        project["status"],
        project.get("project_md"),
        project.get("error_message"),
        project["created_at"]
    ))
    db.commit()
    log.info("Project created", {"id": project["id"]})
    return project

def get_project(id: str) -> Optional[dict]:
    db = get_db()
    log.debug("Getting project", {"id": id})

    row = db.execute("SELECT * FROM projects WHERE id = ?", (id,)).fetchone()
    if row:
        log.debug("Project found", {"id": id, "status": row["status"]})
        return dict(row)
    log.debug("Project not found", {"id": id})
    return None

def get_all_projects() -> List[dict]:
    db = get_db()
    log.debug("Getting all projects")

    rows = db.execute("SELECT * FROM projects ORDER BY created_at DESC").fetchall()
    projects = [dict(row) for row in rows]
    log.debug("Projects retrieved", {"count": len(projects)})
    return projects

def update_project(id: str, updates: dict) -> Optional[dict]:
    db = get_db()
    log.info("Updating project", {"id": id, "updates": list(updates.keys())})

    fields = []
    values = []

    if "commit_sha" in updates:
        fields.append("commit_sha = ?")
        values.append(updates["commit_sha"])
    if "status" in updates:
        fields.append("status = ?")
        values.append(updates["status"])
    if "project_md" in updates:
        fields.append("project_md = ?")
        values.append(updates["project_md"])
    if "error_message" in updates:
        fields.append("error_message = ?")
        values.append(updates["error_message"])

    if not fields:
        log.warn("No fields to update")
        return get_project(id)

    values.append(id)
    db.execute(f"UPDATE projects SET {', '.join(fields)} WHERE id = ?", values)
    db.commit()

    result = db.execute("SELECT changes()").fetchone()
    if result and result[0] > 0:
        log.info("Project updated", {"id": id, "changes": result[0]})
        return get_project(id)

    log.warn("Project not found for update", {"id": id})
    return None

def update_project_status(id: str, status: str, error_message: Optional[str] = None):
    db = get_db()
    log.info("Updating project status", {"id": id, "status": status})

    db.execute("UPDATE projects SET status = ?, error_message = ? WHERE id = ?", (status, error_message, id))
    db.commit()
    log.info("Project status updated", {"id": id, "status": status})

def delete_project(id: str) -> bool:
    db = get_db()
    log.info("Deleting project", {"id": id})

    result = db.execute("DELETE FROM projects WHERE id = ?", (id,))
    db.commit()
    deleted = result.rowcount > 0

    if deleted:
        log.info("Project deleted", {"id": id})
    else:
        log.warn("Project not found for deletion", {"id": id})

    return deleted

# ============================================================================
# DOCUMENT OPERATIONS
# ============================================================================

def create_document(doc: dict) -> dict:
    db = get_db()
    log.info("Creating document", {"id": doc["id"], "type": doc["type"], "projectId": doc["project_id"]})

    db.execute("""
        INSERT INTO documents (id, project_id, type, title, content, diagram_url, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        doc["id"],
        doc["project_id"],
        doc["type"],
        doc["title"],
        doc["content"],
        doc.get("diagram_url"),
        doc["created_at"]
    ))
    db.commit()
    log.info("Document created", {"id": doc["id"], "type": doc["type"]})
    return doc

def get_document(id: str) -> Optional[dict]:
    db = get_db()
    log.debug("Getting document", {"id": id})

    row = db.execute("SELECT * FROM documents WHERE id = ?", (id,)).fetchone()
    return dict(row) if row else None

def get_documents_by_project(project_id: str) -> List[dict]:
    db = get_db()
    log.debug("Getting documents for project", {"projectId": project_id})

    rows = db.execute("SELECT * FROM documents WHERE project_id = ? ORDER BY created_at DESC", (project_id,)).fetchall()
    documents = [dict(row) for row in rows]
    log.debug("Documents retrieved", {"projectId": project_id, "count": len(documents)})
    return documents

def get_document_by_project_and_type(project_id: str, doc_type: str) -> Optional[dict]:
    db = get_db()
    log.debug("Getting document by project and type", {"projectId": project_id, "docType": doc_type})

    row = db.execute("SELECT * FROM documents WHERE project_id = ? AND type = ?", (project_id, doc_type)).fetchone()
    if row:
        log.debug("Document found", {"id": row["id"], "type": row["type"]})
        return dict(row)
    return None

def get_all_documents() -> List[dict]:
    db = get_db()
    log.debug("Getting all documents")

    rows = db.execute("SELECT * FROM documents ORDER BY created_at DESC").fetchall()
    return [dict(row) for row in rows]

def delete_document(id: str) -> bool:
    db = get_db()
    log.info("Deleting document", {"id": id})

    result = db.execute("DELETE FROM documents WHERE id = ?", (id,))
    db.commit()
    return result.rowcount > 0

def delete_documents_by_project(project_id: str) -> int:
    db = get_db()
    log.info("Deleting documents for project", {"projectId": project_id})

    result = db.execute("DELETE FROM documents WHERE project_id = ?", (project_id,))
    db.commit()
    log.info("Documents deleted", {"projectId": project_id, "count": result.rowcount})
    return result.rowcount

# ============================================================================
# VIDEO OPERATIONS
# ============================================================================

def create_video(video: dict) -> dict:
    db = get_db()
    log.info("Creating video", {"id": video["id"], "documentId": video["document_id"]})

    storyboard_json = json.dumps(video.get("storyboard")) if video.get("storyboard") else None

    db.execute("""
        INSERT INTO videos (id, document_id, status, video_url, transcript, storyboard, error_message, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        video["id"],
        video["document_id"],
        video["status"],
        video.get("video_url"),
        video.get("transcript"),
        storyboard_json,
        video.get("error_message"),
        video["created_at"]
    ))
    db.commit()
    log.info("Video created", {"id": video["id"]})
    return video

def get_video(id: str) -> Optional[dict]:
    db = get_db()
    log.debug("Getting video", {"id": id})

    row = db.execute("SELECT * FROM videos WHERE id = ?", (id,)).fetchone()
    if row:
        video = dict(row)
        if video.get("storyboard"):
            video["storyboard"] = json.loads(video["storyboard"])
        return video
    return None

def get_videos_by_document(document_id: str) -> List[dict]:
    db = get_db()
    log.debug("Getting videos for document", {"documentId": document_id})

    rows = db.execute("SELECT * FROM videos WHERE document_id = ? ORDER BY created_at DESC", (document_id,)).fetchall()
    videos = []
    for row in rows:
        video = dict(row)
        if video.get("storyboard"):
            video["storyboard"] = json.loads(video["storyboard"])
        videos.append(video)
    log.debug("Videos retrieved", {"documentId": document_id, "count": len(videos)})
    return videos

def get_videos_by_project(project_id: str) -> List[dict]:
    db = get_db()
    log.debug("Getting videos for project", {"projectId": project_id})

    rows = db.execute("""
        SELECT v.* FROM videos v
        JOIN documents d ON v.document_id = d.id
        WHERE d.project_id = ?
        ORDER BY v.created_at DESC
    """, (project_id,)).fetchall()
    videos = []
    for row in rows:
        video = dict(row)
        if video.get("storyboard"):
            video["storyboard"] = json.loads(video["storyboard"])
        videos.append(video)
    log.debug("Videos retrieved", {"projectId": project_id, "count": len(videos)})
    return videos

def update_video(id: str, updates: dict) -> Optional[dict]:
    db = get_db()
    log.info("Updating video", {"id": id, "updates": list(updates.keys())})

    fields = []
    values = []

    if "status" in updates:
        fields.append("status = ?")
        values.append(updates["status"])
    if "video_url" in updates:
        fields.append("video_url = ?")
        values.append(updates["video_url"])
    if "transcript" in updates:
        fields.append("transcript = ?")
        values.append(updates["transcript"])
    if "storyboard" in updates:
        fields.append("storyboard = ?")
        values.append(json.dumps(updates["storyboard"]) if updates["storyboard"] else None)

    if not fields:
        log.warn("No fields to update")
        return get_video(id)

    values.append(id)
    db.execute(f"UPDATE videos SET {', '.join(fields)} WHERE id = ?", values)
    db.commit()

    result = db.execute("SELECT changes()").fetchone()
    if result and result[0] > 0:
        log.info("Video updated", {"id": id, "changes": result[0]})
        return get_video(id)

    log.warn("Video not found for update", {"id": id})
    return None

def update_video_status(id: str, status: str, error_message: Optional[str] = None):
    db = get_db()
    log.info("Updating video status", {"id": id, "status": status})

    db.execute("UPDATE videos SET status = ?, error_message = ? WHERE id = ?", (status, error_message, id))
    db.commit()
    log.info("Video status updated", {"id": id, "status": status})

def delete_video(id: str) -> bool:
    db = get_db()
    log.info("Deleting video", {"id": id})

    result = db.execute("DELETE FROM videos WHERE id = ?", (id,))
    db.commit()
    deleted = result.rowcount > 0

    if deleted:
        log.info("Video deleted", {"id": id})
    else:
        log.warn("Video not found for deletion", {"id": id})

    return deleted

def delete_videos_by_document(document_id: str) -> int:
    db = get_db()
    log.info("Deleting videos for document", {"documentId": document_id})

    result = db.execute("DELETE FROM videos WHERE document_id = ?", (document_id,))
    db.commit()
    log.info("Videos deleted", {"documentId": document_id, "count": result.rowcount})
    return result.rowcount

