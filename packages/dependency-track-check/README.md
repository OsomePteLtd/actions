# Dependency-track check action

## This action generates BoM file and uploads it to dependency-track server

### Inputs

|    Input     |                                Description                                 |
| :----------: | :------------------------------------------------------------------------: |
|     url      |                            Dependency Track url                            |
|     key      |                Dependency Track key for uploading artefacts                |
|    token     |                     github token from private npm repo                     |
|    nvmrc     |                            .nvmrc file location                            |
| project_name | Name for project in Dependency Track (if absent will create automatically) |
|   version    |                    Project version in Dependency Track                     |

### Usage

```yaml
jobs:
  dtrack-check:
    runs-on: [self-hosted, Linux, Tier1]
    steps:
      - name: Get ref
        run: |
          if [ "${{ github.event_name }}" == "pull_request" ]
          then
            echo "REF=${{ github.head_ref }}" >> $GITHUB_ENV
          else
            echo "REF=$(echo ${{ github.ref }} | cut -d/ -f 3-4)" >> $GITHUB_ENV
          fi

      - name: Generates BoM and upload to OWASP DTrack
        id: riskscoreFromDT
        uses: osomepteltd/actions/packages/dependency-track-check@master
        with:
          url: 'https://dtrack.osome.club:8443'
          key: '${{ secrets.SECRET_OWASP_DT_KEY }}'
          token: '${{ secrets.OSOME_BOT_TOKEN }}'
          ref: '${{env.REF}}'
          nvmrc: .nvmrc
          project_name: '${{ github.event.repository.name }}'
          version: '${{env.REF}}'
```
