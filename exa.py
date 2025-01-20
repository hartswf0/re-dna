import json
import requests
import time
import logging
import platform
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime
from bs4 import BeautifulSoup
import re
import html2text
import sys
from itertools import islice
import math
import os

# Configure logging with debug level
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

API_KEY = "dfd35760-c13a-44df-84bd-0758ee483efe"
BASE_URL = "https://api.exa.ai/contents"
CHUNK_SIZE = 50  # Process URLs in chunks of 50

def chunk_list(lst, n):
    """Yield successive n-sized chunks from lst."""
    for i in range(0, len(lst), n):
        yield list(islice(lst, i, i + n))

class ProcessingStats:
    def __init__(self):
        self.total_urls = 0
        self.processed_urls = 0
        self.successful_urls = 0
        self.failed_urls = 0
        self.start_time = time.time()
        
    def update(self, success: bool):
        """Update processing statistics"""
        self.processed_urls += 1
        if success:
            self.successful_urls += 1
        else:
            self.failed_urls += 1
            
    def get_progress(self) -> Dict[str, Any]:
        """Get current progress statistics"""
        elapsed_time = time.time() - self.start_time
        return {
            'processed': self.processed_urls,
            'total': self.total_urls,
            'successful': self.successful_urls,
            'failed': self.failed_urls,
            'progress_percent': (self.processed_urls / self.total_urls * 100) if self.total_urls > 0 else 0,
            'elapsed_time': elapsed_time,
            'estimated_time_remaining': (elapsed_time / self.processed_urls * (self.total_urls - self.processed_urls)) if self.processed_urls > 0 else 0
        }
        
    def print_progress(self):
        """Print current progress to console"""
        stats = self.get_progress()
        logger.info(f"\nProgress: {stats['progress_percent']:.1f}% ({stats['processed']}/{stats['total']})")
        logger.info(f"Successful: {stats['successful']}, Failed: {stats['failed']}")
        logger.info(f"Time elapsed: {stats['elapsed_time']:.1f}s")
        if stats['estimated_time_remaining'] > 0:
            logger.info(f"Estimated time remaining: {stats['estimated_time_remaining']:.1f}s")

class ContentExtractor:
    @staticmethod
    def extract_sections(html_content: str) -> List[Dict[str, str]]:
        """Extract content sections from HTML"""
        soup = BeautifulSoup(html_content, 'html.parser')
        sections = []
        
        for section in soup.find_all(['section', 'article', 'div']):
            if section.get_text(strip=True):
                sections.append({
                    'type': section.name,
                    'content': section.get_text(strip=True)[:500],
                    'class': section.get('class', []),
                    'id': section.get('id', '')
                })
        return sections

    @staticmethod
    def extract_headings(html_content: str) -> List[Dict[str, str]]:
        """Extract headings from HTML"""
        soup = BeautifulSoup(html_content, 'html.parser')
        headings = []
        
        for tag in soup.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']):
            headings.append({
                'level': tag.name,
                'text': tag.get_text(strip=True),
                'id': tag.get('id', '')
            })
        return headings

    @staticmethod
    def extract_media(html_content: str) -> Dict[str, List[Dict[str, str]]]:
        """Extract media content from HTML"""
        soup = BeautifulSoup(html_content, 'html.parser')
        media = {
            'images': [],
            'videos': [],
            'audio': []
        }
        
        # Extract images
        for img in soup.find_all('img'):
            media['images'].append({
                'src': img.get('src', ''),
                'alt': img.get('alt', ''),
                'title': img.get('title', '')
            })
            
        # Extract videos
        for video in soup.find_all(['video', 'iframe']):
            media['videos'].append({
                'src': video.get('src', ''),
                'type': video.name,
                'provider': 'youtube' if 'youtube' in video.get('src', '') else 'other'
            })
            
        # Extract audio
        for audio in soup.find_all('audio'):
            media['audio'].append({
                'src': audio.get('src', ''),
                'type': audio.get('type', '')
            })
            
        return media

    @staticmethod
    def extract_metadata(html_content: str) -> Dict[str, Any]:
        """Extract metadata from HTML"""
        soup = BeautifulSoup(html_content, 'html.parser')
        metadata = {
            'title': '',
            'description': '',
            'keywords': [],
            'author': '',
            'published_date': '',
            'og': {},
            'twitter': {}
        }
        
        # Basic metadata
        meta_tags = soup.find_all('meta')
        for tag in meta_tags:
            name = tag.get('name', '').lower()
            property = tag.get('property', '').lower()
            content = tag.get('content', '')
            
            if name == 'description' or property == 'og:description':
                metadata['description'] = content
            elif name == 'keywords':
                metadata['keywords'] = [k.strip() for k in content.split(',')]
            elif name == 'author':
                metadata['author'] = content
            elif property.startswith('og:'):
                metadata['og'][property[3:]] = content
            elif property.startswith('twitter:'):
                metadata['twitter'][property[8:]] = content
                
        return metadata

class DocumentProcessor:
    def __init__(self):
        self.categories = {
            'transcription': [],
            'knowledge_management': [],
            'research': [],
            'technical': []
        }
        
        self.category_keywords = {
            'transcription': ['transcription', 'transcribe', 'audio', 'verbatim'],
            'knowledge_management': ['knowledge management', 'km', 'organizational knowledge'],
            'research': ['research', 'study', 'scientific', 'analysis'],
            'technical': ['technical', 'system', 'implementation', 'software']
        }

    def _categorize_document(self, doc: Dict) -> str:
        """Categorize document based on keywords in title and text"""
        text_lower = (doc.get('title', '') + " " + doc.get('content', {}).get('text', '')).lower()
        
        category_scores = {
            category: sum(1 for keyword in keywords if keyword in text_lower)
            for category, keywords in self.category_keywords.items()
        }
        
        return max(category_scores.items(), key=lambda x: x[1])[0] if any(category_scores.values()) else 'technical'

    def process_document(self, response_data: Dict) -> Optional[Dict]:
        """Process a document from API response"""
        if not response_data or 'results' not in response_data:
            return None
            
        result = response_data['results'][0] if response_data['results'] else None
        if not result:
            return None
            
        try:
            # Extract content using BeautifulSoup
            content = {
                'text': result.get('text', ''),
                'html': result.get('text', ''),
                'metadata': {
                    'sections': ContentExtractor.extract_sections(result.get('text', '')),
                    'headings': ContentExtractor.extract_headings(result.get('text', '')),
                    'media_counts': {
                        'images': len(ContentExtractor.extract_media(result.get('text', ''))['images']),
                        'videos': len(ContentExtractor.extract_media(result.get('text', ''))['videos']),
                        'audio': len(ContentExtractor.extract_media(result.get('text', ''))['audio'])
                    }
                }
            }
            
            # Create processed document
            processed_doc = {
                'url': result.get('url'),
                'title': result.get('title'),
                'author': result.get('author'),
                'published_date': result.get('publishedDate'),
                'content': content
            }
            
            # Categorize document
            category = self._categorize_document(processed_doc)
            if category:
                self.categories[category].append(processed_doc)
                processed_doc['category'] = category
                
            return processed_doc
            
        except Exception as e:
            logger.error(f"Error processing document: {str(e)}", exc_info=True)
            return None

def get_url_content(url: str) -> Dict[str, Any]:
    """Fetch content from URL using Exa API with enhanced content retrieval"""
    headers = {
        "Content-Type": "application/json",
        "x-api-key": API_KEY
    }
    
    data = {
        "ids": [url],
        "text": {
            "includeHtmlTags": True,
            "maxCharacters": 10000,
            "extractImages": True,
            "extractMetadata": True
        },
        "metadata": {
            "favicon": True,
            "title": True,
            "description": True,
            "openGraph": True,
            "twitter": True
        }
    }
    
    try:
        logger.debug(f"Request details for {url}:")
        logger.debug(f"Headers: {headers}")
        logger.debug(f"Payload: {json.dumps(data, indent=2)}")
        
        response = requests.post(BASE_URL, headers=headers, json=data, timeout=30)
        
        logger.debug(f"Response status: {response.status_code}")
        logger.debug(f"Response headers: {dict(response.headers)}")
        
        if response.status_code != 200:
            logger.error(f"Non-200 response: {response.text}")
            return {"error": "APIError", "status": response.status_code, "message": response.text}
            
        response_data = response.json()
        logger.debug(f"Response body: {json.dumps(response_data, indent=2)}")
        return response_data
        
    except requests.exceptions.Timeout:
        logger.error(f"Timeout while processing {url}")
        return {"error": "Timeout", "message": "Request timed out"}
        
    except requests.exceptions.ConnectionError as e:
        logger.error(f"Connection error for {url}: {str(e)}")
        return {"error": "ConnectionError", "message": str(e)}
        
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON response for {url}: {str(e)}")
        return {"error": "JSONDecodeError", "message": str(e)}
        
    except Exception as e:
        logger.error(f"Unexpected error for {url}: {str(e)}", exc_info=True)
        return {"error": "UnexpectedError", "message": str(e)}

def deduplicate_urls(urls_data: List[Dict]) -> List[Dict]:
    """Deduplicate URLs while preserving the first occurrence's metadata"""
    seen_urls = set()
    unique_urls = []
    
    for item in urls_data:
        url = item.get('url')
        if url and url not in seen_urls:
            seen_urls.add(url)
            unique_urls.append(item)
    
    return unique_urls

def process_url_chunk(chunk: List[Dict], processor: DocumentProcessor, stats: ProcessingStats, output_dir: Path) -> tuple[List, List]:
    """Process a chunk of URLs and save results"""
    chunk_results = []
    chunk_failures = []
    
    for item in chunk:
        if not isinstance(item, dict):
            logger.error(f"Invalid item format: {item}")
            continue
            
        url = item.get('url')
        if not url:
            logger.warning(f"Skipping item without URL: {item}")
            continue
            
        try:
            logger.info(f"Processing URL {item.get('index', 'unknown')}: {url}")
            response = get_url_content(url)
            
            if response and 'error' not in response:
                processed_doc = processor.process_document(response)
                if processed_doc:
                    chunk_results.append(processed_doc)
                    
                    # Save individual document data
                    doc_file = output_dir / f"doc_{stats.successful_urls + 1:04d}.json"
                    with open(doc_file, "w", encoding='utf-8') as f:
                        json.dump(processed_doc, f, indent=2, ensure_ascii=False)
                        
                    stats.update(True)
                    logger.info(f"Successfully processed: {url}")
                else:
                    failure = {
                        "url": url,
                        "error": "ProcessingError",
                        "message": "Failed to process document content",
                        "timestamp": datetime.now().isoformat()
                    }
                    chunk_failures.append(failure)
                    stats.update(False)
                    logger.error(f"Failed to process content: {url}")
            else:
                failure = {
                    "url": url, 
                    "error": response.get('error', 'APIError'), 
                    "message": response.get('message', 'Unknown API error'),
                    "timestamp": datetime.now().isoformat()
                }
                chunk_failures.append(failure)
                stats.update(False)
                logger.error(f"Failed to fetch: {url}")
                
        except Exception as e:
            logger.error(f"Processing failed for {url}: {str(e)}", exc_info=True)
            failure = {
                "url": url, 
                "error": "ProcessingError", 
                "message": str(e),
                "timestamp": datetime.now().isoformat()
            }
            chunk_failures.append(failure)
            stats.update(False)
            
        finally:
            time.sleep(1)  # Rate limiting
            
    return chunk_results, chunk_failures

def save_chunk_results(chunk_num: int, results: List, failures: List, output_dir: Path):
    """Save chunk results to JSON files"""
    # Save successful results
    if results:
        chunk_file = output_dir / f"chunk_{chunk_num:03d}_successful.json"
        with open(chunk_file, "w", encoding='utf-8') as f:
            json.dump({
                'metadata': {
                    'chunk_number': chunk_num,
                    'timestamp': datetime.now().isoformat(),
                    'total_successful': len(results)
                },
                'documents': results
            }, f, indent=2, ensure_ascii=False)
            
    # Save failures
    if failures:
        failure_file = output_dir / f"chunk_{chunk_num:03d}_failed.json"
        with open(failure_file, "w", encoding='utf-8') as f:
            json.dump({
                'metadata': {
                    'chunk_number': chunk_num,
                    'timestamp': datetime.now().isoformat(),
                    'total_failed': len(failures)
                },
                'failed_urls': failures
            }, f, indent=2, ensure_ascii=False)

def main():
    processor = DocumentProcessor()
    all_results = []
    all_failures = []
    
    input_file = "urls_index.json"
    
    if not Path(input_file).exists():
        logger.critical(f"{input_file} not found in current directory")
        logger.info(f"Current working directory: {Path.cwd()}")
        logger.info("Available files: " + ", ".join(str(f) for f in Path.cwd().glob("*.json")))
        return
    
    try:
        with open(input_file, "r") as f:
            urls_data = json.load(f)
            
        # Deduplicate URLs
        urls_data = deduplicate_urls(urls_data)
        logger.info(f"Successfully loaded {len(urls_data)} unique URLs")
        
    except json.JSONDecodeError as e:
        logger.critical(f"Invalid JSON in {input_file}: {str(e)}")
        logger.debug("First 1000 characters of file content:")
        with open(input_file, "r") as f:
            logger.debug(f.read(1000))
        return
    
    # Initialize processing stats
    stats = ProcessingStats()
    stats.total_urls = len(urls_data)
    
    # Create base output directory with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    base_output_dir = Path(os.path.join(os.path.dirname(__file__), 'data', 'outputs')) / timestamp
    base_output_dir.mkdir(exist_ok=True)
    
    # Process URLs in chunks of 50, but organize outputs in groups of 100
    current_group = 1
    current_group_dir = base_output_dir / f"group_{current_group:03d}"
    current_group_dir.mkdir(exist_ok=True)
    
    for chunk_num, chunk in enumerate(chunk_list(urls_data, CHUNK_SIZE), 1):
        logger.info(f"\nProcessing chunk {chunk_num}/{math.ceil(len(urls_data)/CHUNK_SIZE)}")
        
        # Check if we need to create a new group directory
        group_number = ((chunk_num - 1) * CHUNK_SIZE) // 100 + 1
        if group_number != current_group:
            current_group = group_number
            current_group_dir = base_output_dir / f"group_{current_group:03d}"
            current_group_dir.mkdir(exist_ok=True)
        
        chunk_results, chunk_failures = process_url_chunk(chunk, processor, stats, current_group_dir)
        all_results.extend(chunk_results)
        all_failures.extend(chunk_failures)
        
        # Save chunk results in the current group directory
        save_chunk_results(chunk_num, chunk_results, chunk_failures, current_group_dir)
        
        # Print progress after each chunk
        stats.print_progress()
    
    # Generate final dashboard for each group
    for group_dir in sorted(base_output_dir.glob("group_*")):
        group_results = []
        group_failures = []
        
        # Collect results from all chunks in this group
        for chunk_file in group_dir.glob("chunk_*_successful.json"):
            with open(chunk_file, "r", encoding='utf-8') as f:
                data = json.load(f)
                group_results.extend(data.get('documents', []))
                
        for chunk_file in group_dir.glob("chunk_*_failed.json"):
            with open(chunk_file, "r", encoding='utf-8') as f:
                data = json.load(f)
                group_failures.extend(data.get('failed_urls', []))
        
        # Generate and save group dashboard
        dashboard_data = {
            'run_metadata': {
                'timestamp': datetime.now().isoformat(),
                'duration_seconds': time.time() - stats.start_time,
                'python_version': platform.python_version(),
                'platform': platform.platform(),
                'group_number': int(group_dir.name.split('_')[1])
            },
            'processing_statistics': {
                'total_urls_in_group': len(group_results) + len(group_failures),
                'successful_urls': len(group_results),
                'failed_urls': len(group_failures),
                'success_rate_percent': (len(group_results) / (len(group_results) + len(group_failures)) * 100) if (len(group_results) + len(group_failures)) > 0 else 0
            },
            'content_statistics': {
                'categories': {cat: len([doc for doc in group_results if doc.get('category') == cat]) 
                             for cat in processor.categories.keys()},
                'category_distribution_percent': {
                    cat: round(len([doc for doc in group_results if doc.get('category') == cat]) / len(group_results) * 100, 2) if group_results else 0
                    for cat in processor.categories.keys()
                }
            },
            'error_analysis': {
                'error_types': {},
                'error_distribution_percent': {}
            }
        }
        
        # Count error types for this group
        error_counts = {}
        for failure in group_failures:
            error_type = failure.get('error', 'Unknown')
            error_counts[error_type] = error_counts.get(error_type, 0) + 1
        
        dashboard_data['error_analysis']['error_types'] = error_counts
        if group_failures:
            dashboard_data['error_analysis']['error_distribution_percent'] = {
                error_type: round(count / len(group_failures) * 100, 2)
                for error_type, count in error_counts.items()
            }
        
        # Save group dashboard
        with open(group_dir / "group_dashboard.json", "w", encoding='utf-8') as f:
            json.dump(dashboard_data, f, indent=2, ensure_ascii=False)
    
    # Generate overall dashboard
    overall_dashboard = {
        'run_metadata': {
            'timestamp': datetime.now().isoformat(),
            'duration_seconds': time.time() - stats.start_time,
            'python_version': platform.python_version(),
            'platform': platform.platform(),
            'total_groups': len(list(base_output_dir.glob("group_*")))
        },
        'processing_statistics': {
            'total_urls': stats.total_urls,
            'successful_urls': stats.successful_urls,
            'failed_urls': stats.failed_urls,
            'success_rate_percent': (stats.successful_urls / stats.total_urls * 100) if stats.total_urls > 0 else 0,
            'average_processing_time': (time.time() - stats.start_time) / stats.total_urls if stats.total_urls > 0 else 0
        },
        'content_statistics': {
            'categories': {cat: len(docs) for cat, docs in processor.categories.items()},
            'category_distribution_percent': {
                cat: round(len(docs) / len(all_results) * 100, 2) if all_results else 0
                for cat, docs in processor.categories.items()
            }
        },
        'error_analysis': {
            'error_types': {},
            'error_distribution_percent': {}
        }
    }
    
    # Count overall error types
    error_counts = {}
    for failure in all_failures:
        error_type = failure.get('error', 'Unknown')
        error_counts[error_type] = error_counts.get(error_type, 0) + 1
    
    overall_dashboard['error_analysis']['error_types'] = error_counts
    if all_failures:
        overall_dashboard['error_analysis']['error_distribution_percent'] = {
            error_type: round(count / len(all_failures) * 100, 2)
            for error_type, count in error_counts.items()
        }
    
    # Save overall dashboard
    with open(base_output_dir / "overall_dashboard.json", "w", encoding='utf-8') as f:
        json.dump(overall_dashboard, f, indent=2, ensure_ascii=False)
    
    # Print final summary
    logger.info(f"\nProcessing Complete!")
    logger.info(f"Total URLs processed: {stats.total_urls}")
    logger.info(f"Successfully processed: {stats.successful_urls} ({overall_dashboard['processing_statistics']['success_rate_percent']:.2f}%)")
    logger.info(f"Failed to process: {stats.failed_urls}")
    logger.info(f"\nResults saved in directory: {base_output_dir}")
    
    if all_results:
        logger.info(f"\nOverall Category Distribution:")
        for category, docs in processor.categories.items():
            percentage = overall_dashboard['content_statistics']['category_distribution_percent'][category]
            logger.info(f"{category}: {len(docs)} documents ({percentage:.2f}% of successful)")
    
    if all_failures:
        logger.info(f"\nOverall Error Distribution:")
        for error_type, count in error_counts.items():
            percentage = overall_dashboard['error_analysis']['error_distribution_percent'][error_type]
            logger.info(f"{error_type}: {count} occurrences ({percentage:.2f}% of failures)")
    
    logger.info(f"\nOutput Structure in {base_output_dir}/:")
    logger.info("- Group directories (group_001/, group_002/, etc.)")
    logger.info("  - Individual document files (doc_*.json)")
    logger.info("  - Chunk results (chunk_*_successful.json, chunk_*_failed.json)")
    logger.info("  - Group dashboard (group_dashboard.json)")
    logger.info("- Overall dashboard (overall_dashboard.json)")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("\nProcess interrupted by user")
    except Exception as e:
        logger.error(f"Fatal error: {str(e)}", exc_info=True)
        sys.exit(1)