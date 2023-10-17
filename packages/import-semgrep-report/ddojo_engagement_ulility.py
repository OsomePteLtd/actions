import requests
import json
import sys


def create_engagements(project, id, headers):
    json_data = {
        "tags": [
            project
        ],
        "name": "semgrep",
        "description": f'{project} semgrep engagement',
        # "version": "string",
        "testing_lead": "Admin User",
        "first_contacted": "2023-06-20",
        "target_start": "2023-06-20",
        "target_end": "9999-12-31",
        "engagement_type": "CI/CD",
        "product": id,
    }
    try:
        print(f"Going to create engagement for {project}")
        r = requests.post(url + "engagements/", headers=headers,
                          verify=True, json=json_data)
        print(r.status_code)
    except requests.exceptions.RequestException as e:
        print(e)
    if r.status_code == 201:
        data = json.loads(r.text)
        engegement_id = data['id']
        print(
            f'Engagement for product {project} has been successfully created')
        print(project, engegement_id)


def get_product_id(url, project, headers):
    try:
        r = requests.get(url + f"products/?name={project}",
                         headers=headers, verify=True)
    except requests.exceptions.RequestException as e:
        print(e)
        print(r.status_code)
    data = json.loads(r.text)
    for i in data['results']:
        if project == i['name']:
            id = i['id']
            return id


def check_engagement_exists(url, project, headers):
    try:
        r = requests.get(url + f"engagements/?tag={project}",
                         headers=headers, verify=True)
    except requests.exceptions.RequestException as e:
        print(e)
    if r.status_code == 200:
        data = json.loads(r.text)
        count = 0
        for i in data['results']:
            if project in i['tags'] and i['name'] == 'semgrep':
                id = i['id']
                count += 1
        if count > 0:
            return True
        else:
            return False


if __name__ == "__main__":
    if len(sys.argv) == 7:
        endpoint = "/api/v2/"
        url = sys.argv[2] + endpoint
        project = sys.argv[4]
        token = sys.argv[6]
        headers = {
            'accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': f'Token {token}',
        }
        if check_engagement_exists(url, project, headers):
            print(f"{project} product already has semgrep engagement")
        else:
            id = get_product_id(url, project, headers)
            print(f"Going to create semgrep engegement for {project}")
            create_engagements(project, id, headers)
    else:
        print(
            'Usage: python3 ddojo_create_engagement.py --host DOJO_URL --project PRODUCT_NAME --token TOKEN')
