# :package: `get-deployment-stages`

This actions supports four different types of webhook events: `pull_request`, `push`, `repository_dispatch`, and `workflow_dispatch` and returns context-aware list of environments to which a ref should be deployed to.

## Usage

### `pull_request`

By default, a workflow only runs when a pull_request's activity type is `opened`, `synchronize`, or `reopened`. For each of these activity types this package tries to generate environment name from the ref. Otherwise, when pull request labels match one of the environment labels listed below, it outputs their respective environment instead:

| Label              | Environment |
|--------------------|-------------|
| Deployed to stage  | `stage`     |
| Deployed to test-1 | `test-1`    |
| Deployed to test-2 | `test-2`    |
| Deployed to test-3 | `test-3`    |
| Deployed to test-4 | `test-4`    |
| Deployed to test-5 | `test-5`    |
| Deployed to test-6 | `test-6`    |
| Deployed to test-7 | `test-7`    |
| Deployed to test-8 | `test-8`    |
| Deployed to test-9 | `test-9`    |

When `closed` activity type is provided by specifying it in types property of the workflow, this package will output a list of all transient environments that this ref has been deployed to. It's intended usage is to deactivate these environments in the next step of your workflow.

### `push`
This workflow uses for a tag to a commit on the main/master branch. As a default this workflow returns the stage environment.


### `workflow_dispatch`
The manual trigger workflow works only with stage environments like the stage and all tests.

Using `workflow_dispatch` for deploying feature branches to transient environments is not supported.

> :warning: In order to use `workflow_dispatch` you'll need to conditionally disable caching for this type of event in your workflow files.

### `repository_dispatch`
This workflow uses for deployment to the production by the slack bot.
