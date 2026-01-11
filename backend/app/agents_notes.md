# AI Agents Implementation Notes

## Current Status

The agents are implemented with basic functionality using `google-generativeai`. However, the original TypeScript implementation uses the Vercel AI SDK which provides:

1. **Function Calling**: Automatic tool execution based on AI decisions
2. **Streaming**: Real-time response streaming
3. **Step-by-step execution**: Tool calls are executed automatically

## What's Missing

### Function Calling
The Python implementation currently uses simple text generation. To fully replicate the TypeScript behavior, we need:

1. **Tool Definition**: Define tools as functions that Gemini can call
2. **Function Calling API**: Use Gemini's function calling capabilities
3. **Iterative Execution**: Execute tools, get results, feed back to model

### Implementation Approach

The Gemini Python SDK supports function calling. Here's the pattern:

```python
import google.generativeai as genai

# Define tools
tools = [
    {
        "function_declarations": [
            {
                "name": "listTree",
                "description": "List directory contents",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "path": {"type": "STRING"}
                    }
                }
            }
        ]
    }
]

# Create model with tools
model = genai.GenerativeModel(
    model_name="gemini-3-pro-preview",
    tools=tools
)

# Execute with function calling
response = model.generate_content(prompt)
# Check for function calls in response
# Execute functions
# Continue conversation
```

### Next Steps

1. Implement proper function calling in `agents.py`
2. Add tool execution loop
3. Implement streaming for Q&A agent
4. Add step-by-step logging

## Alternative: Keep TypeScript Agents

If function calling in Python proves complex, consider:

1. Keep agents in TypeScript/Node.js
2. Create a Node.js subprocess wrapper
3. Call from Python via subprocess or HTTP

This maintains the original sophisticated agent implementation while using FastAPI for routing.

