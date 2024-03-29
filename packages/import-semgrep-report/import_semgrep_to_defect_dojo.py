import requests
import sys


def uploadToDefectDojo(is_new_import, token, url, product_name, engagement_name, filename):
    multipart_form_data = {
        'file': (filename, open(filename, 'rb')),
        'scan_type': (None, 'Semgrep JSON Report'),
        'product_name': (None, product_name),
        'engagement_name': (None, engagement_name),
        'auto_create_context': (None, True),
        'deduplication_on_engagement': (None, True)
    }
    endpoint = '/api/v2/import-scan/' if is_new_import else '/api/v2/reimport-scan/'
    r = requests.post(
        url + endpoint,
        files=multipart_form_data,
        headers={
            'Authorization': 'Token ' + token,
        }
    )
    if r.status_code != 201:
        sys.exit(f'Post failed: {r.text}')
    print(f"{filename} for {product_name} successfully uploded to DefectDojo")


if __name__ == "__main__":
    if len(sys.argv) == 11:
        url = sys.argv[2]
        product_name = sys.argv[4]
        engagement_name = sys.argv[6]
        report = sys.argv[8]
        token = sys.argv[10]
        uploadToDefectDojo(False, token, url, product_name, engagement_name, report)
    else:
        print(
            'Usage: python3 import_semgrep_to_defect_dojo.py --host DOJO_URL --product PRODUCT_NAME --engagement ENGAGEMENT_NAME --report REPORT_FILE token TOKEN')
