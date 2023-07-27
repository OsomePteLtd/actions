# Bump packages

This action updates packages to the latest version from package.json which contain in `packages` array

### Inputs

|  Input  |           Description            |
| :-----: | :------------------------------: |
|  token  |           Github Token           |
| prToken | Token for approving pull request |

### Usage

```yaml
name: Bump packages

on:
  workflow_dispatch:

jobs:
  bump-package-version:
    name: Bump package
    runs-on: [self-hosted, Linux]
    needs: setup
    permissions:
      pull-requests: write

    steps:
      - name: Bump Packages
        uses: osomepteltd/actions/packages/bump-packages@master
        with:
          token: ${{ secrets.OSOME_BOT_TOKEN }}
          prToken: ${{ secrets.GITHUB_TOKEN }}
```
