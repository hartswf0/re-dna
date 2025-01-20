import json
import os

def combine_chunks():
    all_documents = []
    chunks_dir = "data"
    
    # Iterate through chunk directories
    for chunk_dir in sorted(os.listdir(chunks_dir)):
        if chunk_dir.startswith("chunk_"):
            chunk_path = os.path.join(chunks_dir, chunk_dir)
            if os.path.isdir(chunk_path):
                # Find the successful.json file in this directory
                for file in os.listdir(chunk_path):
                    if file.endswith("_successful.json"):
                        with open(os.path.join(chunk_path, file), 'r') as f:
                            chunk_data = json.load(f)
                            if isinstance(chunk_data, dict) and 'documents' in chunk_data:
                                all_documents.extend(chunk_data['documents'])
                            elif isinstance(chunk_data, list):
                                all_documents.extend(chunk_data)
    
    # Create the combined data structure
    combined_data = {
        "documents": all_documents
    }
    
    # Write the combined data
    with open('data.json', 'w') as f:
        json.dump(combined_data, f, indent=2)

if __name__ == "__main__":
    combine_chunks()
