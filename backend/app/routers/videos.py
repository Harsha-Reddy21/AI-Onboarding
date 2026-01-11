"""
Videos router - handles video generation
"""
import uuid
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from sse_starlette.sse import EventSourceResponse
from app.models import VideoGenerateRequest, VideoResponse, VideosResponse
from app import db
from app.logger import create_logger
import json

router = APIRouter()
log = create_logger("VAPI")

@router.get("", response_model=VideosResponse)
@router.get("/{video_id}", response_model=VideoResponse)
async def get_video(
    video_id: str = None,
    document_id: str = Query(None, alias="documentId"),
    project_id: str = Query(None, alias="projectId")
):
    """Get video(s)"""
    if video_id:
        video = db.get_video(video_id)
        if not video:
            raise HTTPException(status_code=404, detail="Video not found")
        return VideoResponse(**video)

    if document_id:
        videos = db.get_videos_by_document(document_id)
        return VideosResponse(videos=[VideoResponse(**v) for v in videos])

    if project_id:
        videos = db.get_videos_by_project(project_id)
        return VideosResponse(videos=[VideoResponse(**v) for v in videos])

    raise HTTPException(status_code=400, detail="Missing query parameters (id, documentId, or projectId)")

@router.post("/stream")
async def generate_video(request: VideoGenerateRequest):
    """Start video generation from a document - returns SSE stream"""
    log.separator("VIDEO GENERATION STREAM")

    document_id = request.documentId

    if not document_id:
        raise HTTPException(status_code=400, detail="Document ID required")

    # Get the document
    document = db.get_document(document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # Create video record
    from datetime import datetime
    video = {
        "id": str(uuid.uuid4()),
        "document_id": document_id,
        "status": "generating",
        "video_url": None,
        "transcript": None,
        "storyboard": None,
        "created_at": datetime.now().isoformat(),
    }

    db.create_video(video)
    log.info("Video record created", {"id": video["id"], "documentId": document_id})

    # TODO: Implement actual video generation
    # For now, return placeholder SSE stream
    async def event_generator():
        try:
            yield {
                "event": "status",
                "data": json.dumps({
                    "phase": "storyboard",
                    "message": "Video generation is being migrated. Please check back soon.",
                    "progress": 5
                })
            }

            # Update video status to error for now
            db.update_video_status(video["id"], "error", "Video generation not yet implemented")
            
            yield {
                "event": "error",
                "data": json.dumps({
                    "message": "Video generation functionality is being migrated",
                    "videoId": video["id"]
                })
            }
        except Exception as e:
            log.error("Video generation failed", {"videoId": video["id"], "error": str(e)})
            db.update_video_status(video["id"], "error", str(e))
            yield {
                "event": "error",
                "data": json.dumps({"message": str(e), "videoId": video["id"]})
            }

    return EventSourceResponse(event_generator())

@router.delete("/{video_id}")
async def delete_video(video_id: str):
    """Delete a video"""
    # Get video to find the file path
    video = db.get_video(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    # TODO: Delete the video file if it exists
    # if video.get("video_url"):
    #     await delete_video_file(video["video_url"])

    # Delete from database
    deleted = db.delete_video(video_id)
    if deleted:
        log.info("Video deleted", {"id": video_id})
        return {"success": True}

    raise HTTPException(status_code=500, detail="Failed to delete video")

