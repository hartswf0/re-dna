import json
import os

def combine_data():
    base_dir = 'outputs_20250119_182234'
    
    # Read the dashboard first
    with open(os.path.join(base_dir, 'overall_dashboard.json')) as f:
        dashboard = json.load(f)
    
    # Initialize combined data structure
    combined_data = {
        'metadata': dashboard['run_metadata'],
        'statistics': dashboard['processing_statistics'],
        'documents': []
    }
    
    # Read all group chunks
    for group_num in range(1, dashboard['run_metadata']['total_groups'] + 1):
        group_dir = os.path.join(base_dir, f'group_{str(group_num).zfill(3)}')
        for chunk_num in range(1, 8):  # 1 to 7 chunks per group
            chunk_file = os.path.join(group_dir, f'chunk_{str(chunk_num).zfill(3)}.json')
            if os.path.exists(chunk_file):
                with open(chunk_file) as f:
                    chunk_data = json.load(f)
                    combined_data['documents'].extend(chunk_data.get('documents', []))
    
    # Write combined data
    with open('data.json', 'w') as f:
        json.dump(combined_data, f)

if __name__ == '__main__':
    combine_data()
