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
| placeholder-format  |     Override the default placeholder format for the file type     |
|       trigger       | Trigger integration exports (must be enabled in project settings) |
|   add-newline-eof   |               Enable to add new line at end of file               |
| filter-repositories |    Pull requests will be created only for listed repositories     |
|  filter-filenames   |      Only keys attributed to selected files will be included      |
|    plural-format    |       Override the default plural format for the file type        |
|     indentation     |    Provide to override default indentation in supported files     |
|     export-sort     | Allowed value are first_added, last_added, last_updated, a_z, z_a |
|  original-filename  |             Enable to use original filenames/formats              |

> **_Detailed information_**: `lokalise2 file download --help`

<br>

### Usage

```yaml
name: Lokalise sync

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
          lokalise-token: '<token>'
          lokalise-project-id: '<project_id>'
          file-path: './src/locales'
          format: json
          bundle-structure: 'src/locales/%LANG_ISO%'
          placeholder-format: 'i18n'
          trigger: 'github'
          add-newline-eof: true
          filter-repositories: 'websome'
          filter-filenames: '<filter_filename>'
          plural-format: 'icu'
          indentation: '2cp'
          export-sort: 'a_z'
```
