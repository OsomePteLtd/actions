## Osome GitHub Actions

[![slack](https://img.shields.io/badge/slack-platform-brightgreen.svg?logo=slack)](https://ooosome.slack.com/archives/CEK7WGGB0)

This repository provides a set of GitHub Actions to make common tasks easier.

## Packages

### :punch: [`bump-version`](packages/bump-version)

Bumps application version, commits, creates a tag and pushes the changes back to the repository. Read more [here](packages/bump-version).

```yaml
- name: Bump application version
  uses: 'OsomePteLtd/actions/packages/bump-version@master'
  with:
    token: ${{ secrets.OSOME_BOT_TOKEN }}
```

### :robot: [`update-spec`](packages/update-spec)

Updates specs, commits and pushes updated types

```yaml
- name: Update spec
  uses: 'OsomePteLtd/actions/packages/pdate-spec@master'
  with:
    token: ${{ secrets.OSOME_BOT_TOKEN }}
    npm: ${{ secrets.NPM_KEY_PUBLISHING }}
```
