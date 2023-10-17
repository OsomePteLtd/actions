# Import semgrep report

## This actions performs:

- creates semgrep report
- check target engagement in DefectDojo if does not exist creates it
- uploads report to DefectDojo

### Usage

```yaml
name: Import semgrep report
on:
  workflow_dispatch:
  schedule:
    - cron: '0 6 * * 1,2,3,4,5' # at 6:00 UTC (9:00 MSK), only on Monday, Tuesday, Wednesday, Thursday, and Friday

jobs:
  import_semgrep_report:
    runs-on: [self-hosted, Linux]
    container:
      image: ghcr.io/osomepteltd/semgrep:16102023
      credentials:
        username: osome-bot
        password: ${{ secrets.OSOME_BOT_TOKEN }}
    steps:
      - name: Generate semgrep report and upload to DefectDojo
        id: riskscoreFromDT
        uses: osomepteltd/actions/packages/import-semgrep-report@master
        with:
          project: '${{ github.event.repository.name }}'
          defectDojoToken: '${{ secrets.DDOJO_TOKEN }}'
          ref: '${{ github.ref }}'
          ghToken: '${{ secrets.OSOME_BOT_TOKEN }}'
```
