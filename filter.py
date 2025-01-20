import re
import json

def extract_urls_from_markdown(file_path):
    """
    Extract URLs from a markdown file.
    
    Args:
        file_path (str): Path to the markdown file
    
    Returns:
        list: A list of unique URLs found in the file
    """
    with open(file_path, 'r') as file:
        content = file.read()
    
    # Regular expression to match URLs
    url_pattern = r'\[(\d+)\]\s*(https?://\S+)'
    
    # Find all URLs in the file
    urls = re.findall(url_pattern, content)
    
    # Create a list of unique URLs, preserving the original order
    unique_urls = []
    seen_urls = set()
    for index, url in urls:
        if url not in seen_urls:
            unique_urls.append({
                'index': int(index),
                'url': url
            })
            seen_urls.add(url)
    
    return unique_urls

def save_urls_to_json(urls, output_path='urls_index.json'):
    """
    Save extracted URLs to a JSON file.
    
    Args:
        urls (list): List of URL dictionaries
        output_path (str): Path to save the JSON file
    """
    with open(output_path, 'w') as file:
        json.dump(urls, file, indent=2)
    print(f"URLs saved to {output_path}")

def main():
    input_file = 'data.md'
    output_file = 'urls_index.json'
    
    urls = extract_urls_from_markdown(input_file)
    save_urls_to_json(urls, output_file)

if __name__ == '__main__':
    main()