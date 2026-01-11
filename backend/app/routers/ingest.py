"""
Ingest router - handles repository ingestion
"""
import uuid
from fastapi import APIRouter, HTTPException, BackgroundTasks
from app.models import IngestRequest, IngestResponse, ProjectResponse, ProjectsResponse
from app import db
from app import git_utils
from app.logger import create_logger
from app.agents import create_agents

router = APIRouter()
log = create_logger("INGEST")

async def process_repository(project_id: str, github_url: str):
    """Background task to process repository"""
    log.separator(f"PROCESSING REPO: {project_id[:8]}...")
    repo_path = None

    try:
        # Clone repository
        log.start_timer("clone-repo")
        log.step("Cloning repository from GitHub...")
        result = await git_utils.clone_repository(github_url)
        repo_path = result["repoPath"]
        log.end_timer("clone-repo", f"Path: {repo_path}")

        # Update commit SHA in database
        db.update_project(project_id, {"commit_sha": result["repoInfo"]["commitSha"]})
        log.info("Updated project with commit SHA", {
            "projectId": project_id,
            "commitSha": result["repoInfo"]["commitSha"],
        })

        # Create agents with repo tools
        log.step("Creating AI agents with repo tools...")
        agents = create_agents(repo_path)
        log.info("Agents created successfully")

        # Generate PROJECT.md
        log.start_timer("generate-project-md")
        log.step("Running Mapper Agent to generate PROJECT.md...")
        log.info("This will take a while as the agent explores the codebase...")

        prompt = """Analyze this repository and generate the most comprehensive PROJECT.md file possible.

Your mission is to explore EVERYTHING. You have unlimited tool calls - use them all.

Start with:
1. listTree on "." with depth=20 to see the ENTIRE structure
2. Read package.json, tsconfig.json, and ALL config files completely
3. For each major directory, explore it fully with listTree and read key files
4. Use grep to find all exports, imports, API routes, database models
5. Read every entrypoint, every core module, every configuration

Do NOT stop early. Use all your tool calls. Explore exhaustively.
The goal is to create documentation so complete that someone could understand
the entire codebase just from reading it."""

        mapper_result = await agents["mapperAgent"]["generate"](prompt)
        response = {"text": mapper_result["text"]}
        log.end_timer("generate-project-md", f"Generated {len(response['text'])} characters")

        # Update project with results
        db.update_project(project_id, {
            "project_md": response["text"],
            "status": "ready",
        })

        log.info("Project processing complete!", {
            "projectId": project_id,
            "status": "ready",
            "projectMdLength": len(response["text"]),
        })

        log.separator(f"COMPLETED: {project_id[:8]}...")
    except Exception as error:
        error_msg = str(error)
        log.error("Repository processing error", {
            "projectId": project_id,
            "error": error_msg,
        })

        db.update_project_status(project_id, "error", error_msg)
    finally:
        # Cleanup
        if repo_path:
            log.step("Cleaning up cloned repository...")
            await git_utils.cleanup_repository(repo_path)
            log.info("Repository cleanup complete")

@router.post("", response_model=IngestResponse)
async def ingest_repository(request: IngestRequest, background_tasks: BackgroundTasks):
    """Start repository ingestion"""
    log.separator("NEW INGEST REQUEST")

    try:
        github_url = request.githubUrl

        if not github_url:
            log.warn("Missing GitHub URL in request")
            raise HTTPException(status_code=400, detail="GitHub URL is required")

        # Validate URL
        log.step("Validating GitHub URL...")
        repo_info = git_utils.parse_github_url(github_url)
        if not repo_info:
            log.error("Invalid GitHub URL format", {"githubUrl": github_url})
            raise HTTPException(status_code=400, detail="Invalid GitHub URL")

        log.info("URL validated successfully", {
            "owner": repo_info["owner"],
            "repo": repo_info["repo"],
            "branch": repo_info["branch"],
        })

        # Create project record
        from datetime import datetime
        project_id = str(uuid.uuid4())
        project = {
            "id": project_id,
            "github_url": github_url,
            "commit_sha": "",
            "status": "scanning",
            "project_md": None,
            "created_at": datetime.now().isoformat(),
            "repo_name": f"{repo_info['owner']}/{repo_info['repo']}",
        }

        db.create_project(project)
        log.info("Created project record in SQLite", {
            "projectId": project_id,
            "repoName": project["repo_name"],
            "status": project["status"],
        })

        # Start async processing
        log.step("Starting async repository processing...")
        background_tasks.add_task(process_repository, project_id, github_url)

        log.info("Returning immediate response to client", {"projectId": project_id, "status": "scanning"})
        return IngestResponse(projectId=project_id, status="scanning")
    except HTTPException:
        raise
    except Exception as error:
        log.error("Ingest request failed", {
            "error": str(error),
        })
        raise HTTPException(status_code=500, detail="Failed to start ingestion")

@router.get("", response_model=ProjectsResponse)
@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str = None):
    """Get project(s)"""
    if project_id:
        project = db.get_project(project_id)
        if not project:
            log.warn("Project not found", {"projectId": project_id})
            raise HTTPException(status_code=404, detail="Project not found")
        log.debug("Fetching project", {"projectId": project_id, "status": project["status"]})
        return ProjectResponse(**project)
    else:
        all_projects = db.get_all_projects()
        log.debug("Fetching all projects", {"count": len(all_projects)})
        return ProjectsResponse(projects=[ProjectResponse(**p) for p in all_projects])

