## Osome GitHub Actions

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