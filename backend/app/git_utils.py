"""
Git utilities for cloning repositories
"""
import re
import os
import tempfile
import shutil
from pathlib import Path
from typing import Optional
import httpx
from git import Repo
from app.logger import create_logger

log = create_logger("GIT")

async def get_default_branch(owner: str, repo: str) -> str:
    """Fetch the actual default branch from GitHub API"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://api.github.com/repos/{owner}/{repo}",
                headers={"Accept": "application/vnd.github.v3+json", "User-Agent": "SeniorBen-App"}
            )
            if response.is_success:
                data = response.json()
                default_branch = data.get("default_branch", "main")
                log.info("Fetched default branch from GitHub API", {"owner": owner, "repo": repo, "defaultBranch": default_branch})
                return default_branch
    except Exception as e:
        log.warn("Error fetching default branch, using 'main'", {"error": str(e)})
    return "main"

def parse_github_url(url: str) -> Optional[dict]:
    """Parse GitHub URL to extract owner, repo, and optional branch"""
    log.debug("Parsing GitHub URL", {"url": url})

    patterns = [
        r"^(?:https?://)?github\.com/([^/]+)/([^/]+?)(?:\.git)?(?:/tree/([^/]+))?$",
        r"^(?:https?://)?github\.com/([^/]+)/([^/]+?)(?:\.git)?$",
    ]

    for pattern in patterns:
        match = re.match(pattern, url.strip())
        if match:
            result = {
                "owner": match.group(1),
                "repo": match.group(2).replace(".git", ""),
                "branch": match.group(3) if len(match.groups()) > 2 and match.group(3) else "main",
                "commitSha": ""
            }
            log.info("URL parsed successfully", result)
            return result

    log.warn("Failed to parse GitHub URL - no pattern matched", {"url": url})
    return None

async def clone_repository(github_url: str) -> dict:
    """Clone a repository to a temporary directory"""
    log.separator("GIT CLONE OPERATION")
    log.info("Starting clone operation", {"githubUrl": github_url})

    repo_info = parse_github_url(github_url)
    if not repo_info:
        log.error("Cannot clone - invalid GitHub URL")
        raise ValueError("Invalid GitHub URL")

    # Fetch the actual default branch from GitHub API (unless URL specified a branch)
    if repo_info["branch"] == "main":
        repo_info["branch"] = await get_default_branch(repo_info["owner"], repo_info["repo"])

    # Create temp directory
    temp_dir = tempfile.mkdtemp(prefix="seniorben-")
    repo_path = os.path.join(temp_dir, repo_info["repo"])
    log.info("Created temp directory", {"tempDir": temp_dir, "repoPath": repo_path})

    try:
        # Clone the repository
        log.step(f"Cloning {repo_info['owner']}/{repo_info['repo']} (branch: {repo_info['branch']})...")
        clone_url = f"https://github.com/{repo_info['owner']}/{repo_info['repo']}.git"
        
        repo = Repo.clone_from(
            clone_url,
            repo_path,
            branch=repo_info["branch"],
            depth=1,
            single_branch=True
        )

        # Get the commit SHA
        log.step("Fetching commit SHA...")
        repo_info["commitSha"] = repo.head.commit.hexsha

        log.info("Repository cloned successfully", {
            "owner": repo_info["owner"],
            "repo": repo_info["repo"],
            "branch": repo_info["branch"],
            "commitSha": repo_info["commitSha"],
            "path": repo_path,
        })

        return {"repoPath": repo_path, "repoInfo": repo_info}
    except Exception as error:
        error_msg = str(error)
        log.error("Clone failed", {"branch": repo_info["branch"], "error": error_msg[:200]})

        # Clean up on failure
        log.step("Cleaning up after failed clone...")
        try:
            shutil.rmtree(temp_dir, ignore_errors=True)
            log.info("Cleanup after failure complete")
        except:
            log.warn("Failed to clean up temp directory")

        # Provide helpful error message
        if "SSL" in error_msg or "RPC failed" in error_msg:
            raise ValueError("Network error while cloning. This might be due to a large repository or unstable connection. Please try again.")
        elif "not found" in error_msg or "Could not find remote branch" in error_msg:
            raise ValueError(f"Branch '{repo_info['branch']}' not found. The repository may have been deleted or made private.")
        else:
            raise ValueError(f"Failed to clone repository: {error_msg[:200]}")

async def cleanup_repository(repo_path: str):
    """Clean up a cloned repository"""
    log.step("Cleaning up cloned repository...")
    log.debug("Repository path", {"repoPath": repo_path})

    try:
        # Get the parent temp directory
        parent_dir = os.path.dirname(repo_path)
        shutil.rmtree(parent_dir, ignore_errors=True)
        log.info("Repository cleaned up successfully", {"parentDir": parent_dir})
    except Exception as error:
        log.warn("Failed to cleanup repository", {
            "repoPath": repo_path,
            "error": str(error)
        })

