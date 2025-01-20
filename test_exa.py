import requests
import json

def test_exa_api():
    # API configuration
    api_key = "dfd35760-c13a-44df-84bd-0758ee483efe"
    url = "https://api.exa.ai/search"
    
    # Simple test query
    headers = {
        "Content-Type": "application/json",
        "x-api-key": api_key
    }
    
    data = {
        "query": "test query",
        "useAutoprompt": True,
        "type": "keyword",
        "numResults": 1
    }
    
    try:
        print("Testing Exa API connection...")
        response = requests.post(url, headers=headers, json=data)
        
        print(f"Status Code: {response.status_code}")
        print(f"Response Headers: {json.dumps(dict(response.headers), indent=2)}")
        
        if response.status_code == 200:
            print("\nAPI Key is valid! Response content:")
            print(json.dumps(response.json(), indent=2))
        else:
            print(f"\nError: {response.text}")
            
    except requests.exceptions.RequestException as e:
        print(f"Connection Error: {str(e)}")
    except Exception as e:
        print(f"Unexpected Error: {str(e)}")

if __name__ == "__main__":
    test_exa_api()
