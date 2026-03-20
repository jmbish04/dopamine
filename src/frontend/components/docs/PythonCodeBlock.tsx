import { 
  CodeBlock,
  CodeBlockHeader,
  CodeBlockBody,
  CodeBlockFiles,
  CodeBlockFilename,
  CodeBlockItem,
  CodeBlockContent
} from "../kibo-ui/code-block/index";

const pythonCode = `import requests
import json

def diagnose_logs(log_text):
    """
    Sends raw logs to the Dopamine Worker AI to request a structured diagnosis.
    """
    url = "https://dopamine.hacolby.workers.dev/api/printer/ai"
    
    # We define the JSON Schema we expect the model to return
    schema = {
        "type": "object",
        "properties": {
            "is_critical": {
                "type": "boolean",
                "description": "True if the issue requires immediate manual intervention."
            },
            "root_cause_guess": {
                "type": "string",
                "description": "A short sentence highlighting the core failure."
            },
            "suggested_fix": {
                "type": "string",
                "description": "Recommended bash commands or fixes."
            }
        },
        "required": ["is_critical", "root_cause_guess", "suggested_fix"]
    }
    
    payload = {
        "prompt": f"Analyze these Raspberry Pi logs and tell me what broke:\\n\\n{log_text}",
        "schema": schema
    }
    
    try:
        response = requests.post(
            url, 
            json=payload, 
            headers={"Content-Type": "application/json"}
        )
        response.raise_for_status()
        
        data = response.json()
        if data.get("success"):
            print("AI Diagnostic Output:")
            print(json.dumps(data.get("response"), indent=2))
            return data.get("response")
        else:
            print("AI Error:", data.get("error"))
            
    except requests.exceptions.RequestException as e:
        print("Network request failed:", str(e))

# Example Execution
if __name__ == "__main__":
    sample_logs = "Print hardware failed: Device not found (Unable to open USB printer on (1208, 3624): [Errno 13] Access denied (insufficient permissions))"
    diagnose_logs(sample_logs)`;

const codeData = [
  {
    language: "python",
    filename: "diagnostics.py",
    code: pythonCode,
  },
];

export function PythonCodeBlock() {
  return (
    <CodeBlock
      data={codeData}
      defaultValue="python"
      className="border-white/10"
    >
      <CodeBlockHeader>
        <CodeBlockFiles>
          {(item) => (
            <CodeBlockFilename value={item.language}>
              {item.filename}
            </CodeBlockFilename>
          )}
        </CodeBlockFiles>
      </CodeBlockHeader>
      <CodeBlockBody>
        {(item) => (
          <CodeBlockItem value={item.language}>
            <CodeBlockContent>{item.code}</CodeBlockContent>
          </CodeBlockItem>
        )}
      </CodeBlockBody>
    </CodeBlock>
  );
}
