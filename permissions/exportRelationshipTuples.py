#!/usr/bin/env python3
"""Export Keto relation tuples to clean JSON format"""

import json
import sys
import urllib.request

# Fetch data from Keto
url = "http://keto:4466/relation-tuples"
with urllib.request.urlopen(url) as response:
    data = json.loads(response.read())

tuples = data.get('relation_tuples', [])

# Clean up the format - remove empty relation fields from subject_set
cleaned = []
seen = set()

for t in tuples:
    cleaned_tuple = {
        'namespace': t['namespace'],
        'object': t['object'],
        'relation': t['relation']
    }
    
    if 'subject_set' in t:
        subject_set = {
            'namespace': t['subject_set']['namespace'],
            'object': t['subject_set']['object']
        }
        # Only include relation if it's not empty
        if t['subject_set'].get('relation'):
            subject_set['relation'] = t['subject_set']['relation']
        cleaned_tuple['subject_set'] = subject_set
    
    # Create a hashable key to detect duplicates
    tuple_key = json.dumps(cleaned_tuple, sort_keys=True)
    if tuple_key not in seen:
        seen.add(tuple_key)
        cleaned.append(cleaned_tuple)

# Sort for consistency
cleaned.sort(key=lambda x: (x['namespace'], x['object'], x['relation'], 
                            json.dumps(x.get('subject_set', {}), sort_keys=True)))

# Output to stdout or file
output = json.dumps(cleaned, indent=2)
if len(sys.argv) > 1:
    with open(sys.argv[1], 'w') as f:
        f.write(output)
    print(f"Exported {len(cleaned)} relation tuples to {sys.argv[1]}")
else:
    print(output)
