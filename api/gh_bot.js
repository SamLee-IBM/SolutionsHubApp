import dotenv from "dotenv";
import {App} from "octokit";
import { Octokit } from "octokit";

// export const dynamic = 'force-dynamic'; // static by default, unless reading the request
export const runtime = 'nodejs';
import { waitUntil } from '@vercel/functions';

 
export function GET(request) {
  return new Response(`Hello from ${process.env.VERCEL_REGION}`);
}

export async function POST(request) {
    // This reads your `.env` file and adds the variables from that file to the `process.env` object in Node.js.
    dotenv.config();

    // This assigns the values of your environment variables to local variables.
    const appId = process.env.APP_ID;
    const installation_id = process.env.INSTALLATION_ID;
    const entAppId = process.env.ENTERPRISE_APP_ID;
    const entInstallation_id = process.env.ENTERPRISE_INSTALLATION_ID;

    // This reads the contents of your private key file.
    const privateKey = process.env.PRIVATE_KEY
    const entPrivateKey = process.env.ENTERPRISE_PRIVATE_KEY


    // This creates a new instance of the Octokit App class.
    const github_app = new App({
        appId: appId,
        privateKey: privateKey,
    });

    const entGithubApp = new App({
        Octokit: Octokit.defaults({
            baseUrl: "https://github.ibm.com/api/v3",
          }),
        appId: entAppId,
        privateKey: entPrivateKey,
    });

    const octokit = await github_app.getInstallationOctokit(installation_id);
    const entOctokit = await entGithubApp.getInstallationOctokit(entInstallation_id);

    var chunks = []
    for await (const chunk of request.body) {
        chunks.push(chunk);
    }
    var body = Buffer.concat(chunks).toString();
    const bodyObj = JSON.parse(body);
    console.log(bodyObj)

    if (Object.hasOwn(bodyObj, "challenge")) {
        
        return new Response(JSON.stringify(bodyObj))
    }
    else if (Object.hasOwn(bodyObj, "event")) {
       //Now create the repo on github
        
        var eventData = bodyObj["event"]["columnValues"];
        console.log(eventData);
        console.log(eventData['multi_select5__1']['chosenValues'])
        //create the repo
        const repoName = eventData["short_text1__1"]["value"].replaceAll(" ", "-");
        var ce_org = "ibm-client-engineering";
        var data = {"owner": ce_org, "name": repoName, "description": eventData["long_text0__1"]["text"], "include_all_branches": false}
        //check internal v external
        //--------------------- EXTERNAL ---------------------//
        if (eventData["single_select9__1"]["label"]["text"] == "External") {
            try {
                const result = await octokit.request("POST /repos/{org}/{template}/generate", {
                    org: ce_org,
                    template: "solution-template-quarto",
                    data: data,
                    headers: {
                        "x-github-api-version": "2022-11-28",
                        "Accept": "application/vnd.github+json"
                    },
                });

                console.log(result);

            } catch (error) {
                if (error.response.status != 422) { //if it is failing for any reason other than that a repo already exists
                    console.error(`Error! Status: ${error.response.status}. Message: ${error.response.data.message}`)
                    return new Response("Error creating repo", {status: 401});
                }
            }
               
            //assign user to the repo
            const username = eventData['short_text_mkka39g4']['value']
            try {
                const assignResult = await octokit.request("PUT /repos/{org}/{repo}/collaborators/{username}", {
                    org: ce_org,
                    repo: repoName,
                    username: username,
                    permission: "admin",
                    headers: {
                        "x-github-api-version": "2022-11-28",
                        "Accept": "application/vnd.github+json"
                    },
                });
            console.log(assignResult)
            } catch (error) {
                if (error.response.status != 422) { //if it is failing for any reason other than that a repo already exists
                    console.error(`Error! Status: ${error.response.status}. Message: ${error.response.data.message}`)
                    return new Response("Error adding collaborator", {status: 401});
                }
            }

            //Apply custom properties to the repo
            let customProps = [{"property_name": "Technology", "value": eventData['multi_select5__1']['chosenValues'].map((prop) => prop.name)},
                { "property_name": "Industry", "value": eventData["single_select_mkm0qkdh"]["label"]["text"]},
                { "property_name": "Title", "value": eventData["short_text_mkm0807n"]["value"]},
                { "property_name": "Technology-Pillar", "value": eventData["multi_select_mkm2e7hf"]["chosenValues"].map((prop) => prop.name)}]
            console.log(customProps)
            try {
                const propResult = await octokit.request("PATCH /repos/{org}/{repo}/properties/values", {
                    org: ce_org,
                    repo: repoName,
                    properties: customProps,
                    headers: {
                        "x-github-api-version": "2022-11-28",
                        "Accept": "application/vnd.github+json"
                    },
                });

                console.log(propResult)
            } catch (error) {
                if (error.response.status != 422) {
                    console.error(`Error! Status: ${error.response.status}. Message: ${error.response.data.message}`)
                } else {
                    console.log(`Error (need to update this custom property to match case)! Status: ${error.response.status}. Message: ${error.response.data.message}`)
                }
            }

            try {
                //trigger the action to create the gh-pages branch
                const branchCreateResult = await octokit.request('POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches', {
                    owner: ce_org,
                    repo: repoName,
                    workflow_id: 'create_branch.yml',
                    ref: 'main',
                    headers: {
                    'X-GitHub-Api-Version': '2022-11-28'
                    }
                });
                console.log(branchCreateResult);
            } catch(error) {
                console.error(`Error! Status: ${error.response.status}. Message: ${error.response.data.message}`)
                return new Response("Error creating gh-pages branch", {status: 401});
            }

            //enable github pages
            try {
                //check if pages is already configured
                const pagesCheckResult = await octokit.request("GET /repos/{org}/{repo}/pages", {
                    org: ce_org,
                    repo: repoName,
                    headers: {
                        "x-github-api-version": "2022-11-28"
                    },
                });
                console.log(pagesCheckResult)
            } catch(error) {
                //now we need to update the deployment
                try {
                    const pagesResult = await octokit.request("POST /repos/{org}/{repo}/pages", {
                        org: ce_org,
                        repo: repoName,
                        source: {
                            branch: "gh-pages",
                            path: "/"
                        },
                        headers: {
                            "x-github-api-version": "2022-11-28",
                            "Accept": "application/vnd.github+json"
                        },
                    });
    
                    console.log(pagesResult)
                } catch (error) {
                    console.error(`Error! Status: ${error.response.status}. Message: ${error.response.data.message}`)
                    return new Response("Error enabling github pages", {status: 401});
                }
                
            }


                

            //add main branch protection rule
            try {
                console.log("trying to create branch protection rule");
                const ruleResult = await octokit.request('POST /repos/{owner}/{repo}/rulesets', {
                    owner: ce_org,
                    repo: repoName,
                    name: 'Main Branch Protection',
                    target: 'branch',
                    enforcement: 'active',
                    bypass_actors: [
                      {
                        actor_id: 5, //admin
                        actor_type: 'RepositoryRole',
                        bypass_mode: 'always'
                      },
                      {
                        actor_id: 1, //admin
                        actor_type: 'OrganizationAdmin',
                        bypass_mode: 'always'
                      },
                    ],
                    conditions: {
                      ref_name: {
                        include: [
                          '~DEFAULT_BRANCH'
                        ],
                        exclude: []
                      }
                    },
                    rules: [
                        {
                            type: "non_fast_forward"
                        },
                        {
                            type: "deletion"
                        },
                        {
                            type: "update"
                        },
                        {
                            type: "pull_request",
                            parameters: {
                                required_approving_review_count: 1,
                                dismiss_stale_reviews_on_push: true,
                                require_code_owner_review: true,
                                require_last_push_approval: true,
                                required_review_thread_resolution: false,
                                automatic_copilot_code_review_enabled: false,
                                allowed_merge_methods: [
                                    "merge",
                                    "squash",
                                    "rebase"
                                ]
                            },
                        }
                    ],
                    headers: {
                      'X-GitHub-Api-Version': '2022-11-28',
                      "Accept": "application/vnd.github+json"
                    }
                  });

                console.log(ruleResult);
            } catch(error) {
                console.error(`Error! Status: ${error.response.status}. Message: ${error.response.data.message}`)
                return new Response("Error creating ruleset", {status: 401});
            }



        } else {  //--------------------- INTERNAL ---------------------//
            try {
                const result = await entOctokit.request("POST /repos/{org}/{template}/generate", {
                    org: ce_org,
                    template: "solution-template-quarto",
                    data: data,
                    headers: {
                        "x-github-api-version": "2022-11-28",
                        "Accept": "application/vnd.github+json"
                    },
                });

                console.log(result);
            } catch (error) {
                if (error.response.status != 422) { //if it is failing for any reason other than that a repo already exists
                    console.error(`Error! Status: ${error.response.status}. Message: ${error.response.data.message}`)
                    return new Response("Error creating repo", {status: 401});
                }
            }
            
            //assign user to the repo
            const username = eventData['short_text_Mjj51gLS']['value']

            try {
                const assignResult = await entOctokit.request("PUT /repos/{org}/{repo}/collaborators/{username}", {
                    org: ce_org,
                    repo: repoName,
                    username: username,
                    permission: "admin",
                    headers: {
                        "x-github-api-version": "2022-11-28",
                        "Accept": "application/vnd.github+json"
                    },
                });

                console.log(assignResult)
            } catch (error) {
                console.error(`Error! Status: ${error.response.status}. Message: ${error.response.data.message}`)
                return new Response("Error adding collaborator", {status: 401});
            }   
    
            //Apply custom properties to the repo
            let customProps = [{ "property_name": "Technology", "value": eventData['multi_select5__1']['chosenValues'].map((prop) => prop.name).toString()},
                            { "property_name": "Industry", "value": eventData["single_select_mkm0qkdh"]["label"]["text"]},
                            { "property_name": "Title", "value": eventData["short_text_mkm0807n"]["value"]}]

            try {
                const propResult = await entOctokit.request("PATCH /repos/{org}/{repo}/properties/values", {
                    org: ce_org,
                    repo: repoName,
                    properties: customProps,
                    headers: {
                        "x-github-api-version": "2022-11-28",
                        "Accept": "application/vnd.github+json"
                    },
                });

                console.log(propResult)
            } catch (error) {
                if (error.response.status != 422) {
                    console.error(`Error! Status: ${error.response.status}. Message: ${error.response.data.message}`)
                } else {
                    console.log(`Error (need to update this custom property to match case)! Status: ${error.response.status}. Message: ${error.response.data.message}`)
                }
            }




               //add main branch protection rule
            try {
                const ruleResult = await entOctokit.request('POST /repos/{owner}/{repo}/rulesets', {
                    owner: ce_org,
                    repo: repoName,
                    name: 'Main Branch Protection',
                    target: 'branch',
                    enforcement: 'active',
                    bypass_actors: [
                      {
                        actor_id: 5, //admin
                        actor_type: 'RepositoryRole',
                        bypass_mode: 'always'
                      },
                      {
                        actor_id: 1, //admin
                        actor_type: 'OrganizationAdmin',
                        bypass_mode: 'always'
                      },
                    ],
                    conditions: {
                      ref_name: {
                        include: [
                          '~DEFAULT_BRANCH'
                        ],
                        exclude: []
                      }
                    },
                    rules: [
                        {
                            type: "non_fast_forward"
                        },
                        {
                            type: "deletion"

                        },
                        {
                            type: "update",
                            parameters: {
                                update_allows_fetch_and_merge: true
                            }
                        },
                        {
                            type: "pull_request",
                            parameters: {
                                required_approving_review_count: 1,
                                dismiss_stale_reviews_on_push: true,
                                require_code_owner_review: true,
                                require_last_push_approval: true,
                                required_review_thread_resolution: false
                            },
                        }
                    ],
                    headers: {
                      'X-GitHub-Api-Version': '2022-11-28',
                      "Accept": "application/vnd.github+json"
                    }
                  })
                console.log(ruleResult)
            } catch(error) {
                if (error.response.status != 422) {
                    console.error(`Error! Status: ${error.response.status}. Message: ${error.response.data.message}`)
                    return new Response("Error enabling github pages", {status: 401});
                } else {
                    console.log(`Error (ruleset probably already exists)! Status: ${error.response.status}. Message: ${error.response.data.message}`)
                }

                
            }


            //now attempt to add the github token to the repo's travis build config so that it can deploy to gh pages successfully
            const CEBOT_GH_TRAVIS_TOKEN = process.env.CEBOT_GH_TRAVIS_TOKEN;
            const CEBOT_TRAVIS_API_KEY = process.env.CEBOT_TRAVIS_API_KEY;
            let url = `https://v3.travis.ibm.com/api/repo/${ce_org}%2F${repoName}/env_vars`;
            waitUntil(fetch(url, {
                body: JSON.stringify({ "env_var.name": "GITHUB_TOKEN", "env_var.value": CEBOT_GH_TRAVIS_TOKEN, "env_var.public": false }),
                headers: {
                    'Content-Type': 'application/json',
                    "Travis-API-Version": "3",
                    "Authorization": `token ${CEBOT_TRAVIS_API_KEY}`
                },
                method: 'POST',
                }).then((response) => {
                    console.log(response.status)
                    if (response.status === 403) {
                        console.log(response);
                        console.error(`Error communicating with travis (forbidden) Status: ${response.status}`)
                    } else if (response.status === 201) {
                        console.log(response);
                    } else {
                        console.log(response);
                        console.error(`Error (unclear why)! Status: ${response.status}`)
                }}));

        }

        return new Response("Success!");
    }
    else {
        return new Response("request not recognized", {status: 401})
    }
}