# lokalise-download-action

Download localisation files in any format to a directory

### Inputs

|        Input        |                            Description                            |
| :-----------------: | :---------------------------------------------------------------: |
|   lokalise-token    |                             API token                             |
| lokalise-project-id |                     Unique project identifier                     |
|      file-path      |               Unzip to this folder. (default "./")                |
|       format        |               File format (e.g. json, strings, xml)               |
|  bundle-structure   |    Bundle structure, used when original-filenames set to false    |
|  original-filename  |             Enable to use original filenames/formats              |
| placeholder-format  |     Override the default placeholder format for the file type     |
|       trigger       | Trigger integration exports (must be enabled in project settings) |

> **_Detailed information_**: `lokalise2 file download --help`

<br>

### Usage

```yaml
name: Lokilise sync

on:
  workflow_dispatch:
  schedule:
    - cron: '0 0 1 * *' # At 00:00 on day-of-month 1

jobs:
  deploy:
    runs-on: [self-hosted, Linux]

    steps:
      - name: Lokalise Download
        uses: osomepteltd/actions/packages/bump-packages@master
        with:
          lokalise-token:
          lokalise-project-id:
          file-path: './public/locales'
          format: json
          bundle-structure: '/%LANG_ISO%.json'
          original-filename: true
          placeholder-format: 'i18n'
          trigger: 'github'
```
