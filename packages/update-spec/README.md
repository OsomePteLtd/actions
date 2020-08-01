# :punch: `bump-version`

Bumps application version, commits, creates a tag and pushes the changes back to the repository.

## Usage

Use the command below to quickly add a workflow with this action to your repository (do note that it clears your `.npmrc` file and creates it from scratch – backup or adjust if needed):
```bash
echo 'always-auth=true\nmessage="v%s"\ntag-version-prefix="v"' > .npmrc && \
wget -P .github/workflows https://raw.githubusercontent.com/osomepteltd/actions/master/packages/bump-version/examples/default.yml && \
wget -P .github/workflows https://raw.githubusercontent.com/osomepteltd/actions/master/packages/bump-version/examples/bump-version.yml
```

The above command creates two workflows:

- Workflow `bump-version` subscribes to all push events to the `master` branch that are not tagged and have changes in files other than `package.json`.
- Workflow `default` subscribes to all tagged pushes to the `master` branch. You should add your custom steps that should run on every new version to this workflow.

It also sets the default package registry to GitHub Package Registry and changes commit message and tag format to match `vX.Y.Z` by creating an `.npmrc` file.

## Configuration

It is possible to configure the commit message and the tag prefix. In order to do so, create a `.npmrc` file in the root of your repository with the following content:

```ini
# Configure commit message
# Token %s contains the version number
message="v%s"

# Configure tag prefix
# Version number is appended after it
tag-version-prefix="v"
```
