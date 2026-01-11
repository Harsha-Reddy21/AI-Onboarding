"""
Docs router - handles document generation
"""
import uuid
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from sse_starlette.sse import EventSourceResponse
from app.models import DocGenerateRequest, DocumentResponse, DocumentsResponse
from app import db
from app import git_utils
from app.logger import create_logger
from app.agents import create_agents
import json
from datetime import datetime

router = APIRouter()
log = create_logger("DOCS")

def get_doc_title(doc_type: str) -> str:
    titles = {
        "architecture": "Architecture Overview",
        "data_flow": "Data Flow",
        "onboarding": "Onboarding Guide",
        "glossary": "Domain Glossary",
        "user_flows": "User Flows",
        "extension": "Extension Points",
        "custom": "Custom Documentation",
    }
    return titles.get(doc_type, doc_type)

def get_topic_from_doc_type(doc_type: Optional[str] = None) -> Optional[str]:
    """Get topic description from doc type"""
    if not doc_type:
        return None
    
    topics = {
        "overview": "Platform overview - what it does and why users use it, explained simply for support staff",
        "how_it_works": "How the platform works - simple explanation for employees helping users",
        "training": "Employee training guide - how to support users effectively and answer their questions",
        "terms": "Terms and features glossary - what things mean to users in simple language",
        "user_journeys": "User journeys - common tasks users perform and how to help them",
        "troubleshooting": "Troubleshooting guide - common problems users face and step-by-step solutions",
    }
    return topics.get(doc_type)

@router.post("", response_model=DocumentResponse)
async def generate_document(request: DocGenerateRequest):
    """Generate a document"""
    log.separator("NEW DOC GENERATION REQUEST")

    try:
        project_id = request.projectId
        doc_type = request.docType
        custom_title = request.customTitle

        if not project_id or not doc_type:
            log.warn("Missing required fields", {"projectId": project_id, "docType": doc_type})
            raise HTTPException(status_code=400, detail="Project ID and doc type are required")

        # For custom docs, require a title
        if doc_type == "custom" and not custom_title:
            log.warn("Custom doc type requires a title", {"projectId": project_id, "docType": doc_type})
            raise HTTPException(status_code=400, detail="Custom doc type requires a title")

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
            log.warn("Project is not ready", {"projectId": project_id, "status": project["status"]})
            raise HTTPException(status_code=400, detail="Project is not ready yet")

        # Check if doc already exists (skip for custom docs)
        if doc_type != "custom":
            log.step("Checking for existing document...")
            existing_doc = db.get_document_by_project_and_type(project_id, doc_type)
            if existing_doc:
                log.info("Found existing document, returning cached version", {
                    "docId": existing_doc["id"],
                    "type": existing_doc["type"],
                    "createdAt": existing_doc["created_at"],
                })
                return DocumentResponse(**existing_doc)
            log.info("No existing document found, will generate new one")

        # Clone repo for doc generation
        log.start_timer("clone-for-docs")
        log.step("Cloning repository for doc generation...")
        clone_result = await git_utils.clone_repository(project["github_url"])
        repo_path = clone_result["repoPath"]
        log.end_timer("clone-for-docs", f"Path: {repo_path}")

        try:
            log.step("Creating doc agents...")
            agents = create_agents(repo_path)
            doc_agent = agents["docAgents"].get(doc_type)
            
            if not doc_agent:
                log.error("Invalid doc type requested", {"docType": doc_type, "availableTypes": list(agents["docAgents"].keys())})
                raise HTTPException(status_code=400, detail="Invalid doc type")

            log.info("Doc agent ready", {"docType": doc_type})

            # Generate doc
            log.start_timer("generate-doc")
            doc_title = custom_title or get_doc_title(doc_type)
            log.step(f"Generating {doc_title} documentation...")
            log.info("Agent is exploring the codebase and generating documentation...")

            if doc_type == "custom" and custom_title:
                prompt = f"""Generate the most comprehensive documentation about "{custom_title}" for this codebase.

Here is the PROJECT.md summary for context:

{project.get("project_md", "")}

YOUR MISSION: Create exhaustive documentation about "{custom_title}".

EXPLORATION REQUIREMENTS:
1. Use listTree with depth=15+ to see the full structure
2. Use grep to find ALL relevant code patterns
3. Read every relevant file
4. Cross-reference findings across multiple files
5. Do NOT stop early - use all your tool calls until you have enough information to create the documentation.

The goal is to create documentation so thorough that someone could fully understand "{custom_title}" without reading any code."""
            else:
                prompt = f"""Generate the most comprehensive {doc_type} documentation for this codebase.

Here is the PROJECT.md summary for context:

{project.get("project_md", "")}

YOUR MISSION: Create exhaustive {doc_type} documentation.

EXPLORATION REQUIREMENTS:
1. Use listTree with depth=15+ to see the full structure
2. Use grep to find ALL relevant code patterns
3. Read every relevant file COMPLETELY
4. Cross-reference findings across multiple files
5. Do NOT stop early - use all your tool calls

The goal is to create documentation so thorough that someone could fully understand the {doc_type} without reading any code."""

            log.debug("Sending prompt to agent", {"promptLength": len(prompt)})
            result = await doc_agent["generate"](prompt)
            doc_content = result["text"]

            log.end_timer("generate-doc", f"Generated {len(doc_content)} characters")

            # Create document record
            doc = {
                "id": str(uuid.uuid4()),
                "project_id": project_id,
                "type": doc_type,
                "title": doc_title,
                "content": doc_content,
                "diagram_url": None,
                "created_at": datetime.now().isoformat(),
            }

            db.create_document(doc)
            log.info("Document created and stored in SQLite", {
                "docId": doc["id"],
                "type": doc["type"],
                "title": doc["title"],
                "contentLength": len(doc["content"]),
            })

            log.separator(f"DOC GENERATION COMPLETE: {doc_type}")
            return DocumentResponse(**doc)
        finally:
            log.step("Cleaning up repository...")
            await git_utils.cleanup_repository(repo_path)
            log.info("Cleanup complete")
    except HTTPException:
        raise
    except Exception as error:
        log.error("Doc generation error", {
            "error": str(error),
        })
        raise HTTPException(status_code=500, detail="Failed to generate documentation")

@router.post("/stream")
async def generate_document_stream(request: DocGenerateRequest):
    """Generate a document with SSE streaming"""
    log.separator("STREAMING DOC GENERATION")

    project_id = request.projectId
    doc_type = request.docType
    custom_title = request.customTitle

    if not project_id:
        raise HTTPException(status_code=400, detail="Project ID required")

    project = db.get_project(project_id)
    if not project or project["status"] != "ready":
        raise HTTPException(status_code=400, detail="Project not ready")

    # Check for existing doc (skip for custom)
    if doc_type and doc_type != "custom":
        existing_doc = db.get_document_by_project_and_type(project_id, doc_type)
        if existing_doc:
            async def event_generator():
                yield {
                    "event": "complete",
                    "data": json.dumps({"type": "complete", "document": existing_doc})
                }
            return EventSourceResponse(event_generator())

    # Determine the topic
    topic = custom_title or get_topic_from_doc_type(doc_type)

    async def event_generator():
        repo_path = ""
        try:
            # Clone
            yield {
                "event": "status",
                "data": json.dumps({"message": "Cloning repository..."})
            }
            clone_result = await git_utils.clone_repository(project["github_url"])
            repo_path = clone_result["repoPath"]
            yield {
                "event": "status",
                "data": json.dumps({"message": "Repository cloned. Starting exploration..."})
            }

            # Create the doc agent
            agents = create_agents(repo_path)
            doc_agent = agents["docAgents"].get(doc_type or "custom")
            
            if not doc_agent:
                # Fallback to custom agent
                doc_agent = agents["docAgents"]["custom"]

            # Generate documentation
            prompt = f"""Generate comprehensive documentation for this codebase.
            
Here is the PROJECT.md summary for context:

{project.get("project_md", "")}

Topic: {topic or "general overview"}

Explore the codebase thoroughly and create detailed documentation."""
            
            result = await doc_agent["generate"](prompt)
            
            # Save to database
            doc = {
                "id": str(uuid.uuid4()),
                "project_id": project_id,
                "type": doc_type or "custom",
                "title": custom_title or get_doc_title(doc_type or "custom"),
                "content": result["text"],
                "diagram_url": None,
                "created_at": datetime.now().isoformat(),
            }

            db.create_document(doc)
            log.info("Document saved", {"id": doc["id"], "title": doc["title"]})

            yield {
                "event": "complete",
                "data": json.dumps({"document": doc})
            }
        except Exception as error:
            log.error("Streaming doc error", {"error": str(error)})
            yield {
                "event": "error",
                "data": json.dumps({
                    "message": str(error) if isinstance(error, Exception) else "Unknown error"
                })
            }
        finally:
            if repo_path:
                await git_utils.cleanup_repository(repo_path)

    return EventSourceResponse(event_generator())

@router.get("", response_model=DocumentsResponse)
async def get_documents(
    project_id: str = Query(None, alias="projectId")
):
    """Get documents"""
    if project_id:
        log.debug("Fetching documents for project", {"projectId": project_id})
        project_docs = db.get_documents_by_project(project_id)
        log.info("Found documents", {"projectId": project_id, "count": len(project_docs)})
        return DocumentsResponse(documents=[DocumentResponse(**d) for d in project_docs])

    log.debug("Fetching all documents")
    all_docs = db.get_all_documents()
    return DocumentsResponse(documents=[DocumentResponse(**d) for d in all_docs])

@router.get("/{doc_id}", response_model=DocumentResponse)
async def get_document(
    doc_id: str
):
    """Get document by ID"""
    log.debug("Fetching document by ID", {"docId": doc_id})
    doc = db.get_document(doc_id)
    if not doc:
        log.warn("Document not found", {"docId": doc_id})
        raise HTTPException(status_code=404, detail="Document not found")
    return DocumentResponse(**doc)

@router.delete("/{doc_id}")
async def delete_document(doc_id: str):
    """Delete a document"""
    log.separator("DELETE DOCUMENT REQUEST")

    try:
        log.step(f"Deleting document: {doc_id}")

        # Check if document exists
        doc = db.get_document(doc_id)
        if not doc:
            log.warn("Document not found for deletion", {"docId": doc_id})
            raise HTTPException(status_code=404, detail="Document not found")

        # Delete the document
        deleted = db.delete_document(doc_id)

        if deleted:
            log.info("Document deleted successfully", {"docId": doc_id, "title": doc["title"]})
            return {"success": True, "deletedId": doc_id}
        else:
            log.error("Failed to delete document", {"docId": doc_id})
            raise HTTPException(status_code=500, detail="Failed to delete document")
    except HTTPException:
        raise
    except Exception as error:
        log.error("Delete document error", {
            "error": str(error),
        })
        raise HTTPException(status_code=500, detail="Failed to delete document")
