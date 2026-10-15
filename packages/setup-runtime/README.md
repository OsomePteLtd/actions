# `setup-runtime`

Composite action that installs a language runtime from a version file. For Node it also writes npm registry auth. `.github/workflows/backend.yml` calls it instead of repeating read-nvmrc + setup-node + `.npmrc` in every job.

There is no `package.json`. This matches the other YAML-only composites in `packages/` (`fail-on-code-and-migrations`, `e2e-gate-check`). Lerna does not build it.

## Inputs

| Input | Default | Description |
| --- | --- | --- |
| `runtime` | `node` | `node`, `python`, `go`, or `java` |
| `version-file` | `.nvmrc` | Version file for that runtime |
| `github-packages-token` | empty | Token for `npm.pkg.github.com` (node only) |
| `npmjs-token` | empty | Read-only token for `registry.npmjs.org` (node only) |

## Usage

```yaml
- uses: osomepteltd/actions/packages/setup-runtime@master
  with:
    runtime: node
    version-file: .nvmrc
    github-packages-token: ${{ secrets.OSOME_BOT_TOKEN }}
    npmjs-token: ${{ secrets.NPMJS_KEY_READ_ONLY }}
```

`@master` until this repo has a `v1` tag.
