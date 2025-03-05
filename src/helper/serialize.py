# ----- required imports -----

import json

# ----- helper functions ------

def process_leetcode_titles(json_file):
    with open(json_file, 'r') as file:
        data = json.load(file)
    titles = []
    for item in data['data']:
        title = item['Problem Title']
        title = ' '.join(title.split()[1:]).strip()
        formatted_title = title.lower().replace(' ', '-')
        titles.append(formatted_title)
    return titles

# ----- execution code ------

if __name__ == "__main__":
    json_file = 'problems.json'
    result = process_leetcode_titles(json_file)
    with open('questions.txt', 'w') as file_handler:
        for title in result:
            file_handler.write(title + '\n')