"""
Repository tools for codebase exploration
Port of TypeScript repo-tools.ts
"""
import os
import re
from pathlib import Path
from typing import List, Dict, Any, Optional
from app.logger import create_logger

log = create_logger("TOOLS")

# Default ignore patterns
IGNORE_PATTERNS = [
    'node_modules',
    '.git',
    'dist',
    'build',
    'coverage',
    '.next',
    '__pycache__',
    'vendor',
    '.cache',
    '*.lock',
    '*.min.js',
    '*.map',
    '*.png',
    '*.jpg',
    '*.gif',
    '*.ico',
    '*.woff',
    '*.woff2',
    '*.ttf',
    '*.eot',
    '*.svg',
    '*.mp4',
    '*.mp3',
    '*.pdf',
    '*.zip',
    '*.tar',
    '*.gz',
]

# Text file extensions
TEXT_FILE_EXTENSIONS = [
    '.ts', '.tsx', '.js', '.jsx', '.py', '.rb', '.go', '.rs',
    '.java', '.c', '.cpp', '.h', '.hpp', '.css', '.scss', '.sass',
    '.html', '.xml', '.json', '.yaml', '.yml', '.md', '.txt',
    '.sh', '.bash', '.zsh', '.sql', '.graphql', '.vue', '.svelte',
    '.php', '.swift', '.kt', '.scala', '.clj', '.ex', '.exs',
    '.toml', '.ini', '.cfg', '.conf', '.env', '.dockerfile',
    'Dockerfile', 'Makefile', '.gitignore', '.eslintrc', '.prettierrc',
]

def should_ignore(file_path: str) -> bool:
    """Check if a file/directory should be ignored"""
    name = os.path.basename(file_path)
    for pattern in IGNORE_PATTERNS:
        if pattern.startswith('*.'):
            if name.endswith(pattern[1:]):
                return True
        else:
            if name == pattern or pattern in file_path.replace('\\', '/'):
                return True
    return False

def is_text_file(filename: str) -> bool:
    """Check if a file is a text file"""
    return any(filename.endswith(ext) or filename == ext for ext in TEXT_FILE_EXTENSIONS)

class RepoTools:
    """Repository tools for exploring codebases"""
    
    def __init__(self, repo_path: str):
        self.repo_path = Path(repo_path).resolve()
        log.info("Created RepoTools", {"repoPath": str(self.repo_path)})
    
    async def list_tree(self, dir_path: str = ".") -> Dict[str, Any]:
        """List directory contents (one level only)"""
        full_path = self.repo_path / dir_path
        
        if not full_path.exists() or not full_path.is_dir():
            return {
                "error": f"Cannot read directory: {dir_path}",
                "entries": [],
                "total": 0,
                "path": dir_path,
                "listing": "",
                "directories": [],
                "files": []
            }
        
        entries = []
        
        try:
            for item in full_path.iterdir():
                relative_path = item.relative_to(self.repo_path)
                relative_str = str(relative_path).replace('\\', '/')
                
                if should_ignore(relative_str):
                    continue
                
                if item.is_dir():
                    # Count children
                    child_count = 0
                    try:
                        child_count = sum(1 for c in item.iterdir() if not should_ignore(str(c.relative_to(self.repo_path)).replace('\\', '/')))
                    except:
                        pass
                    entries.append({
                        "path": relative_str,
                        "type": "directory",
                        "size": child_count
                    })
                elif item.is_file():
                    try:
                        size = item.stat().st_size
                        entries.append({
                            "path": relative_str,
                            "type": "file",
                            "size": size
                        })
                    except:
                        pass
        except Exception as e:
            log.warn(f"Error listing directory {dir_path}", {"error": str(e)})
            return {
                "error": f"Cannot read directory: {dir_path}",
                "entries": [],
                "total": 0,
                "path": dir_path,
                "listing": "",
                "directories": [],
                "files": []
            }
        
        # Sort: directories first, then files, alphabetically
        entries.sort(key=lambda e: (e["type"] != "directory", e["path"]))
        
        # Format as compact list
        listing_lines = []
        for e in entries:
            if e["type"] == "directory":
                listing_lines.append(f"📁 {os.path.basename(e['path'])}/ ({e['size']} items)")
            else:
                size_kb = f"{round(e['size']/1024)}KB" if e['size'] > 1024 else f"{e['size']}B"
                listing_lines.append(f"📄 {os.path.basename(e['path'])} ({size_kb})")
        
        listing = "\n".join(listing_lines)
        
        return {
            "path": dir_path,
            "listing": listing,
            "directories": [e["path"] for e in entries if e["type"] == "directory"],
            "files": [e["path"] for e in entries if e["type"] == "file"],
            "entries": entries,
            "total": len(entries)
        }
    
    async def read_file(self, file_path: str, offset: int = 0, limit: Optional[int] = None) -> Dict[str, Any]:
        """Read file contents"""
        full_path = self.repo_path / file_path
        
        if not full_path.exists() or not full_path.is_file():
            return {
                "error": f"Failed to read file: {file_path}",
                "content": "",
                "totalLines": 0,
                "startLine": 0,
                "endLine": 0,
                "truncated": False
            }
        
        try:
            content = full_path.read_text(encoding='utf-8', errors='ignore')
            lines = content.split('\n')
            total_lines = len(lines)
            
            # If no limit specified, read entire file
            effective_limit = limit if limit is not None else total_lines
            selected_lines = lines[offset:offset + effective_limit]
            truncated = offset + effective_limit < total_lines
            
            # Add line numbers
            numbered_content = "\n".join(
                f"{offset + idx + 1}: {line}"
                for idx, line in enumerate(selected_lines)
            )
            
            return {
                "content": numbered_content,
                "totalLines": total_lines,
                "startLine": offset + 1,
                "endLine": min(offset + effective_limit, total_lines),
                "truncated": truncated
            }
        except Exception as e:
            log.warn(f"Error reading file {file_path}", {"error": str(e)})
            return {
                "error": f"Failed to read file: {file_path}",
                "content": "",
                "totalLines": 0,
                "startLine": 0,
                "endLine": 0,
                "truncated": False
            }
    
    async def grep(self, pattern: str, file_pattern: Optional[str] = None, max_results: Optional[int] = None) -> Dict[str, Any]:
        """Search for pattern in files"""
        hits = []
        query_lower = pattern.lower()
        max_hits = max_results if max_results is not None else 1000
        
        async def search_directory(dir_path: Path):
            if len(hits) >= max_hits:
                return
            
            try:
                for item in dir_path.iterdir():
                    if len(hits) >= max_hits:
                        break
                    
                    relative_path = item.relative_to(self.repo_path)
                    relative_str = str(relative_path).replace('\\', '/')
                    
                    if should_ignore(relative_str):
                        continue
                    
                    if item.is_dir():
                        await search_directory(item)
                    elif item.is_file():
                        # Check file pattern
                        if file_pattern:
                            ext = item.suffix
                            if file_pattern.startswith('*.') and ext != file_pattern[1:]:
                                continue
                        
                        if not is_text_file(item.name):
                            continue
                        
                        try:
                            stats = item.stat()
                            if stats.st_size > 2 * 1024 * 1024:  # Skip files > 2MB
                                continue
                            
                            content = item.read_text(encoding='utf-8', errors='ignore')
                            lines = content.split('\n')
                            
                            for i, line in enumerate(lines):
                                if len(hits) >= max_hits:
                                    break
                                if query_lower in line.lower():
                                    hits.append({
                                        "path": relative_str,
                                        "lineNo": i + 1,
                                        "excerpt": line.strip()[:500]
                                    })
                        except Exception:
                            # Skip files we can't read
                            pass
            except Exception:
                # Directory might not be readable
                pass
        
        await search_directory(self.repo_path)
        return {"hits": hits, "total": len(hits)}
    
    async def read_snippet(self, file_path: str, start_line: int, end_line: int) -> Dict[str, Any]:
        """Read a specific section of a file with context"""
        full_path = self.repo_path / file_path
        
        if not full_path.exists() or not full_path.is_file():
            return {
                "error": f"Failed to read file: {file_path}",
                "content": "",
                "requestedRange": {"start": start_line, "end": end_line},
                "actualRange": {"start": 0, "end": 0}
            }
        
        try:
            content = full_path.read_text(encoding='utf-8', errors='ignore')
            lines = content.split('\n')
            
            # Add generous context
            context_before = 10
            context_after = 10
            actual_start = max(1, start_line - context_before)
            actual_end = min(len(lines), end_line + context_after)
            
            selected_lines = lines[actual_start - 1:actual_end]
            numbered_content = "\n".join(
                f"{'>' if actual_start + idx >= start_line and actual_start + idx <= end_line else ' '} {actual_start + idx}: {line}"
                for idx, line in enumerate(selected_lines)
            )
            
            return {
                "content": numbered_content,
                "requestedRange": {"start": start_line, "end": end_line},
                "actualRange": {"start": actual_start, "end": actual_end}
            }
        except Exception as e:
            log.warn(f"Error reading snippet from {file_path}", {"error": str(e)})
            return {
                "error": f"Failed to read file: {file_path}",
                "content": "",
                "requestedRange": {"start": start_line, "end": end_line},
                "actualRange": {"start": 0, "end": 0}
            }

def create_repo_tools(repo_path: str) -> RepoTools:
    """Factory function to create repository tools"""
    return RepoTools(repo_path)

