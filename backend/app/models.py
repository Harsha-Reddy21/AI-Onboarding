"""
Pydantic models for request/response validation
"""
from pydantic import BaseModel
from typing import Optional, List, Literal
from datetime import datetime

# Status types
ProjectStatus = Literal["pending", "scanning", "generating", "ready", "error"]
DocType = Literal["overview", "how_it_works", "training", "terms", "user_journeys", "troubleshooting", "custom"]
VideoStatus = Literal["pending", "generating", "ready", "error"]

# Request/Response Models
class IngestRequest(BaseModel):
    githubUrl: str

class IngestResponse(BaseModel):
    projectId: str
    status: str

class ProjectResponse(BaseModel):
    id: str
    github_url: str
    commit_sha: str
    status: ProjectStatus
    project_md: Optional[str] = None
    created_at: str
    repo_name: str
    error_message: Optional[str] = None

class ProjectsResponse(BaseModel):
    projects: List[ProjectResponse]

class DocGenerateRequest(BaseModel):
    projectId: str
    docType: DocType
    customTitle: Optional[str] = None

class DocumentResponse(BaseModel):
    id: str
    project_id: str
    type: DocType
    title: str
    content: str
    diagram_url: Optional[str] = None
    created_at: str

class DocumentsResponse(BaseModel):
    documents: List[DocumentResponse]

class ChatRequest(BaseModel):
    messages: List[dict]
    projectId: str
    sessionId: Optional[str] = None

class VideoGenerateRequest(BaseModel):
    documentId: str

class VideoResponse(BaseModel):
    id: str
    document_id: str
    status: VideoStatus
    video_url: Optional[str] = None
    transcript: Optional[str] = None
    storyboard: Optional[dict] = None
    created_at: str

class VideosResponse(BaseModel):
    videos: List[VideoResponse]

class Slide(BaseModel):
    title: str
    bullets: List[str]
    imagePrompt: str
    voiceover: str
    imageUrl: Optional[str] = None
    audioUrl: Optional[str] = None

class Storyboard(BaseModel):
    slides: List[Slide]

