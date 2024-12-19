# Solutions Hub Backend App

This application will handle webhooks from the monday form to create github repos, assign the submitter as a collaborator, set custom properties, and configure the repo to build the github pages site. To make the github API requests, for both github.com and for the github.ibm.com enterprise server, we use [octokit](https://github.com/octokit).

## Vercel Setup
This application utilizes [Vercel functions](https://vercel.com/docs/functions), which run on demand. There are two endpoints, one GET endpoint (which is really just a test endpoint), and one POST endpoint, which handles all regular requests. Both endpoints are defined in [api/gh_bot.js](api/gh_bot.js).

## POST Endpoint

### monday.com Integration
Monday has a github integration; IBM does not pay for it. We are using the custom webhook automation that monday.com offers, which verifies the webhook by sending a `{"challenge": <RANDOM_STRING>}`, expecting the exact same body in the response. The first step of the post endpoint checks whether the request body contains a challenge field.

### External API requests
There are 4 external API requests.

1. Create a repo using the [quarto template](https://github.com/ibm-client-engineering/solution-template-quarto) with a given title and description
2. Add the given github username as an admin on the repository.
3. Add the given custom properties (Industry, Technology, Title) to the repo
4. Enable github pages to 