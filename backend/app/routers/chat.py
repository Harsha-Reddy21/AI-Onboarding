"""
Chat router - handles Q&A chat with codebase
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from sse_starlette.sse import EventSourceResponse
from app.models import ChatRequest
from app import db
from app.logger import create_logger
import json

router = APIRouter()
log = create_logger("CHAT")

@router.post("")
async def chat(request: ChatRequest):
    """Chat with codebase - returns SSE stream"""
    log.separator("NEW CHAT REQUEST")

    try:
        messages = request.messages
        project_id = request.projectId
        client_session_id = request.sessionId

        log.info("Received chat request", {
            "projectId": project_id,
            "sessionId": client_session_id[:12] + "..." if client_session_id else "none",
            "messageCount": len(messages) if messages else 0,
        })

        if not project_id:
            log.warn("Missing project ID")
            raise HTTPException(status_code=400, detail="Project ID is required")

        log.step(f"Looking up project: {project_id}")
        project = db.get_project(project_id)
        if not project:
            log.error("Project not found", {"projectId": project_id})
            raise HTTPException(status_code=404, detail="Project not found")

        log.info("Found project", {
            "repoName": project["repo_name"],
            "status": project["status"],
        })

        if project["status"] != "ready":
            log.warn("Project not ready for chat", {"projectId": project_id, "status": project["status"]})
            raise HTTPException(status_code=400, detail="Project is not ready yet")

        # TODO: Implement session management and Q&A agent
        # For now, return placeholder SSE stream
        async def event_generator():
            try:
                # Send session ID
                yield {
                    "event": "session",
                    "data": json.dumps({"sessionId": "placeholder-session-id"})
                }

                # Send placeholder response
                yield {
                    "event": "text",
                    "data": json.dumps({"text": "Chat functionality is being migrated. Please check back soon."})
                }

                # Signal completion
                yield {
                    "event": "complete",
                    "data": json.dumps({"success": True})
                }
            except Exception as e:
                log.error("Error during chat processing", {"error": str(e)})
                yield {
                    "event": "error",
                    "data": json.dumps({"message": str(e)})
                }

        return EventSourceResponse(event_generator())
    except HTTPException:
        raise
    except Exception as error:
        log.error("Chat request failed", {
            "error": str(error),
        })
        raise HTTPException(status_code=500, detail="Failed to process chat")

