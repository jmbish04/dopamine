# Dopamine Local Python AI Integration

The `dopamine` worker provides a dedicated endpoint to assist local hardware scripts on the Raspberry Pi in understanding and troubleshooting complex logs. This utilizes the backend `env.AI.run()` binding on Cloudflare Edge to format logs and telemetry directly into structured JSON using AI.

## Endpoint Details

- **URL**: `https://dopamine.hacolby.workers.dev/api/printer/ai`
- **Method**: `POST`
- **Headers**:
  - `Content-Type: application/json`
- **Request Body**:
  - `prompt`: (string) The specific question or unformatted block of text/logs you want analyzed.
  - `schema`: (object, optional) A JSON Schema specifying the shape of data you want returned.
  - `model`: (string, optional) Defaults to `@cf/meta/llama-3.3-70b-instruct-fp8-fast`.

## Sample Python Implementation

Below is an example of an implementation utilizing Python's `requests` library to intercept local error text, send it to the AI diagnostician, and extract structured debugging plans.

```python
import requests
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
        "prompt": f"Analyze these Raspberry Pi logs and tell me what broke:\n\n{log_text}",
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
    diagnose_logs(sample_logs)
```

## Running the Example

Depending on your Python environment, make sure your requirements are installed:

```bash
pip install requests
```

Then run the script. The model will parse the stack trace and return the extracted structured attributes organically back to your script without needing to regex log lines manually.
