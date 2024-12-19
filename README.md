# Solutions Hub Backend App

This application will handle webhooks from the monday form to create github repos, assign the submitter as a collaborator, set custom properties, and configure the repo to build the github pages site. To make the github API requests, for both github.com and for the github.ibm.com enterprise server, we use [octokit](https://github.com/octokit).

## Vercel Setup
This application utilizes [Vercel functions](https://vercel.com/docs/functions), which run on demand. There are two endpoints, one GET endpoint (which is really just a test endpoint), and one POST endpoint, which handles all regular requests. Both endpoints are defined in [api/gh_bot.js](api/gh_bot.js).

## POST Endpoint

### monday.com Integration
Monday has a github integration; IBM does not pay for it. We are using the custom webhook automation that monday.com offers, which verifies the webhook by sending a `{"challenge": <RANDOM_STRING>}`, expecting the exact same body in the response. The first step of the post endpoint checks whether the request body contains a challenge field.

### External API requests
There are 6 steps composed of 7 API requests.

1. Create a repo using the [quarto template](https://github.com/ibm-client-engineering/solution-template-quarto) with a given title and description
2. Add the given github username as an admin on the repository.
3. Add the given custom properties (Industry, Technology, Title) to the repo.
4. Create the gh-pages branch using the [create_branch.yml](https://github.com/ibm-client-engineering/solution-template-quarto/blob/main/.github/workflows/create_branch.yml) github action.
5. Enable github pages to deploy from the gh-pages branch. [^1][^2]
6. Create a ruleset to limit users' ability to make pushes to the main branch.

[^1]: It takes a little bit of time for the repo to be ready for this step. Instead of idling the application for a set amount of time in the hopes that it is enough for the repository to be ready for this step I decided to just have the function fail. Monday.com will attempt the webhook again in another minute, and it should be ready by then.
[^2]: This step is prone to timeouts, especially if github pages is already configured. To prevent the timeout from breaking the whole system there is an additional API call to check if github pages is already setup, and this step will be skipped if it is.

### Internal API requests
There are 6 steps composed of 6 API requests to github and one to travis.

1. Create a repo using the [quarto template](https://github.com/ibm-client-engineering/solution-template-quarto) with a given title and description
2. Add the given github username as an admin on the repository.
3. Add the given custom properties (Industry, Technology, Title) to the repo.
4. Send the CE_BOT Github API token to travis so that it can deploy the gh pages site [^3]
5. Enable github pages to deploy from the gh-pages branch. [^1][^2]
6. Create a ruleset to limit users' ability to make pushes to the main branch.

[^3]: The internal github enterprise server does not allow for github actions, so we must use travis :/