"""
AI Agents for codebase analysis and documentation generation
Port of TypeScript agents to Python using google-generativeai
"""
import os
from typing import Dict, Any, List, Optional, Callable, Awaitable
import google.generativeai as genai
from app.config import GOOGLE_GENERATIVE_AI_API_KEY, GEMINI_MODEL, GEMINI_IMAGE_MODEL
from app.repo_tools import create_repo_tools
from app.logger import create_logger

log = create_logger("AGENTS")

# Configure Gemini
genai.configure(api_key=GOOGLE_GENERATIVE_AI_API_KEY)

# Model instances
MODEL = genai.GenerativeModel(GEMINI_MODEL)
IMAGE_MODEL = genai.GenerativeModel(GEMINI_IMAGE_MODEL)

# System prompts
MAPPER_SYSTEM = """You are an elite code archaeologist. Create comprehensive PROJECT.md documentation by exploring the codebase.

## CRITICAL: How to Explore
You have **UNLIMITED TOOL CALLS**. Use them liberally!

**listTree returns ONE LEVEL only.** To explore deeply:
1. listTree(".") → see root directories
2. listTree("src") → see inside src/
3. listTree("src/components") → see inside components/
4. Keep calling listTree on interesting directories!

**Exploration Pattern:**
```
listTree(".") → find main directories
listTree("src") → explore src
listTree("lib") → explore lib
readFile("package.json") → check dependencies
readFile("src/index.ts") → read entrypoint
grep("export function") → find all exports
... keep going until you understand everything!
```

## Exploration Strategy
1. **Start at root**: listTree(".") to see top-level structure
2. **Dive into each major directory**: Call listTree on src/, lib/, app/, etc.
3. **Read config files**: package.json, tsconfig.json, etc.
4. **Read entrypoints**: main.ts, index.ts, app.ts
5. **Explore deeply**: Keep calling listTree on subdirectories
6. **Search for patterns**: Use grep to find functions, classes, routes
7. **Read key files**: Read important files completely

## Output Format
Generate PROJECT.md with:
- Overview (name, tech stack, architecture)
- Directory structure with purposes
- Module map (directory → responsibility → key files)
- Entrypoints and data flows
- API surface and integrations
- Key patterns and conventions
- Glossary of domain terms

## Rules
- Call tools MANY times - you have no limit!
- Cite file paths and line numbers
- Read files completely, don't assume
- If unclear, explore more
- Quality over speed"""

QA_SYSTEM = """You are an expert code analyst with unlimited exploration capabilities. Your job is to answer questions about codebases with absolute precision, thoroughness, and evidence.

## Your Capabilities
You have powerful tools with NO artificial limits:
- Search the ENTIRE codebase for any pattern
- Read complete files without truncation
- Explore deeply nested directories
- Cross-reference multiple files to understand relationships

## Investigation Process
For EVERY question, follow this thorough approach:

1. **Understand the Question**
   - Identify what specific information is needed
   - Note any ambiguity and how you'll interpret it
   - Plan multiple search strategies

2. **Broad Search**
   - Search for relevant keywords, function names, class names
   - Look for related terms and synonyms
   - Don't stop at first results - search exhaustively

3. **Deep Reading**
   - Read relevant files COMPLETELY, not just snippets
   - Understand the context around matches
   - Follow imports and dependencies to related code

4. **Cross-Reference**
   - Find where functions/classes are defined AND used
   - Trace data flow through the codebase
   - Identify all related components

5. **Verify Understanding**
   - Read additional files to confirm your understanding
   - Look for edge cases and exceptions
   - Check for documentation or comments

## Response Format

### Direct Answer
Start with a clear, concise answer to the question.

### Evidence
For EVERY claim, provide:
- Exact file path
- Line numbers (e.g., `src/utils/auth.ts:45-67`)
- Relevant code snippets (formatted)

### Deep Dive
- Explain the context and how the code works
- Show relationships between components
- Note any interesting patterns or gotchas

### Related Areas
- Suggest related files or patterns to explore
- Point out potential issues or improvements
- Note any documentation that might help

## Critical Rules
- NEVER make claims without file:line evidence
- ALWAYS read files completely before answering
- USE multiple search strategies (keywords, patterns, file types)
- If unsure, SEARCH MORE before concluding
- If you truly can't find something, explain what you searched
- Quality and accuracy over speed
- When in doubt, explore more"""

class AgentTools:
    """Wrapper for repository tools that can be called by the AI"""
    
    def __init__(self, repo_tools):
        self.repo_tools = repo_tools
    
    async def list_tree(self, path: str = ".") -> Dict[str, Any]:
        """List directory contents"""
        return await self.repo_tools.list_tree(path)
    
    async def read_file(self, path: str, offset: int = 0, limit: Optional[int] = None) -> Dict[str, Any]:
        """Read file contents"""
        return await self.repo_tools.read_file(path, offset, limit)
    
    async def grep(self, pattern: str, file_pattern: Optional[str] = None, max_results: Optional[int] = None) -> Dict[str, Any]:
        """Search for pattern in files"""
        return await self.repo_tools.grep(pattern, file_pattern, max_results)
    
    async def read_snippet(self, path: str, start_line: int, end_line: int) -> Dict[str, Any]:
        """Read file snippet with context"""
        return await self.repo_tools.read_snippet(path, start_line, end_line)

def create_agents(repo_path: str) -> Dict[str, Any]:
    """Create AI agents for a repository"""
    log.info("Creating agents", {"repoPath": repo_path.split(os.sep)[-2:]})
    
    repo_tools = create_repo_tools(repo_path)
    agent_tools = AgentTools(repo_tools)
    
    # Mapper Agent - generates PROJECT.md
    async def mapper_generate(prompt: str) -> Dict[str, str]:
        """Generate PROJECT.md documentation"""
        log.separator("MAPPER AGENT")
        log.info("Starting mapper agent", {"promptLength": len(prompt)})
        
        # Build conversation with tool calling
        # Note: This is a simplified version - full implementation would use
        # function calling with the Gemini API
        full_prompt = f"{MAPPER_SYSTEM}\n\n{prompt}\n\nStart exploring the codebase now."
        
        try:
            # For now, use a simple generation approach
            # TODO: Implement proper function calling with tool execution
            response = MODEL.generate_content(full_prompt)
            text = response.text
            
            log.info("Mapper completed", {"chars": len(text)})
            return {"text": text}
        except Exception as e:
            log.error("Mapper agent error", {"error": str(e)})
            raise
    
    # Doc Agent factory
    def create_doc_agent(doc_type: str, doc_instructions: str):
        async def generate(prompt: str) -> Dict[str, str]:
            log.separator(f"DOC AGENT: {doc_type}")
            log.info("Starting doc agent", {"docType": doc_type, "promptLength": len(prompt)})
            
            system_prompt = f"""You are an expert technical writer creating {doc_type} documentation.

## CRITICAL: How to Explore
You have **UNLIMITED TOOL CALLS**. Use them liberally!

**listTree returns ONE LEVEL only.** To explore deeply:
```
listTree(".") → see root directories
listTree("src") → see inside src/
listTree("src/controllers") → see controllers
```
Keep calling listTree on directories you want to explore!

## Exploration Strategy
1. listTree(".") to see root structure
2. listTree on each interesting directory
3. readFile on config files (package.json, etc.)
4. grep to find patterns across codebase
5. readFile on key source files
6. Keep exploring until you have enough info!

## Documentation Task
{doc_instructions}

## Output Format
- Clear Markdown with headers, lists, tables
- Code snippets with file:line citations
- Comprehensive but focused on the topic

## Rules
- Call tools MANY times - unlimited!
- Cite file paths and line numbers
- Read files completely
- If unclear, explore more"""
            
            full_prompt = f"{system_prompt}\n\n{prompt}"
            
            try:
                response = MODEL.generate_content(full_prompt)
                text = response.text
                
                log.info(f"{doc_type} doc completed", {"chars": len(text)})
                return {"text": text}
            except Exception as e:
                log.error(f"Doc agent error ({doc_type})", {"error": str(e)})
                raise
        
        return {"generate": generate}
    
    # Pre-configured doc agents
    doc_agents = {
        "architecture": create_doc_agent(
            "architecture",
            """Create an architecture overview document that covers:
- High-level system components
- External dependencies and integrations
- Internal module structure
- Communication patterns between components
- Deployment architecture (if evident from config files)"""
        ),
        "data_flow": create_doc_agent(
            "data flow",
            """Create a data flow document that covers:
- How data enters the system (APIs, events, etc.)
- Data transformations and processing steps
- Storage mechanisms (databases, caches, files)
- Data output and responses
- Async operations and queues"""
        ),
        "onboarding": create_doc_agent(
            "onboarding path",
            """Create an onboarding guide for new developers:
- Prerequisites (languages, tools, knowledge)
- Setup instructions
- Key files to read first
- Suggested learning path through the codebase
- Common tasks and how to accomplish them"""
        ),
        "glossary": create_doc_agent(
            "domain glossary",
            """Create a glossary of business terms:
- Identify domain-specific terminology in the code
- Define each term in plain language
- Link to where each term is used/defined
- Group related terms together"""
        ),
        "user_flows": create_doc_agent(
            "user flows",
            """Document the main user-facing flows:
- Identify key user actions (login, create, update, etc.)
- Trace each action from UI to database
- Document API endpoints involved
- Note validation and error handling"""
        ),
        "extension": create_doc_agent(
            "extension points",
            """Document how to extend the system:
- Plugin or module architecture
- Configuration options
- Customization hooks
- Adding new features (where to add code)
- Testing approach"""
        ),
        "custom": create_doc_agent(
            "custom",
            """Create comprehensive documentation based on the topic specified in the prompt.
- Explore all relevant aspects of the topic
- Include code examples and file references
- Provide clear explanations and context
- Structure the documentation logically"""
        ),
    }
    
    # Q&A Agent - simplified for now
    async def qa_stream(messages: List[Dict[str, str]], system: Optional[str] = None):
        """Stream Q&A responses"""
        log.separator("Q&A AGENT")
        log.info("Starting Q&A stream", {"messages": len(messages)})
        
        # Build conversation
        conversation = []
        if system:
            conversation.append({"role": "user", "parts": [system]})
        
        for msg in messages:
            role = "model" if msg["role"] == "assistant" else "user"
            conversation.append({"role": role, "parts": [msg["content"]]})
        
        try:
            # TODO: Implement streaming with tool calling
            response = MODEL.generate_content(conversation)
            return response.text
        except Exception as e:
            log.error("Q&A agent error", {"error": str(e)})
            raise
    
    qa_agent = {
        "stream": qa_stream
    }
    
    # Video Agent
    async def video_generate(prompt: str) -> Dict[str, str]:
        """Generate video storyboard"""
        log.separator("VIDEO AGENT")
        log.info("Starting video storyboard generation", {"promptLength": len(prompt)})
        
        video_system = """You create 10-slide video explainer storyboards from documentation.

INPUT: You will receive documentation content to convert into a video.

OUTPUT: Create a storyboard with exactly 10 slides in JSON format:
{
  "slides": [
    {
      "title": "Slide title",
      "bullets": ["Point 1", "Point 2", "Point 3"],
      "imagePrompt": "Description for image generation",
      "voiceover": "30-45 second narration script"
    }
  ]
}

RULES:
- Each slide should be self-contained
- Voiceover should be conversational and clear
- Image prompts should describe professional diagrams
- Progress from overview to details to summary
- Total video should be 5-7 minutes
- Keep technical jargon minimal"""
        
        full_prompt = f"{video_system}\n\n{prompt}"
        
        try:
            response = MODEL.generate_content(full_prompt)
            text = response.text
            
            # Extract JSON from response (might be in markdown code blocks)
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0].strip()
            elif "```" in text:
                text = text.split("```")[1].split("```")[0].strip()
            
            log.info("Video storyboard completed", {"chars": len(text)})
            return {"text": text}
        except Exception as e:
            log.error("Video agent error", {"error": str(e)})
            raise
    
    video_agent = {
        "generate": video_generate
    }
    
    return {
        "mapperAgent": {"generate": mapper_generate},
        "docAgents": doc_agents,
        "qaAgent": qa_agent,
        "videoAgent": video_agent
    }
