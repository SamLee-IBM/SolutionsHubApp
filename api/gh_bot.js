import dotenv from "dotenv";
import {App} from "octokit";
import { Octokit } from "octokit";

// export const dynamic = 'force-dynamic'; // static by default, unless reading the request
export const runtime = 'nodejs';


 
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
        try {
            var eventData = bodyObj["event"]["columnValues"];
            console.log(eventData);
            console.log(eventData['multi_select5__1']['chosenValues'])
            //create the repo
            const repoName = eventData["short_text1__1"]["value"].replaceAll(" ", "-");
            var ce_org = "ibm-client-engineering";
            var data = {"owner": ce_org, "name": repoName, "description": eventData["long_text0__1"]["text"]}
            
            //check internal v external
            if (eventData["single_select9__1"]["label"]["text"] == "External") {
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
                
                //assign user to the repo
                const username = eventData['short_text_Mjj51gLS']['value']
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

                //Apply custom properties to the repo
                let customProps = [{"property_name": "Technology", "value": eventData['multi_select5__1']['chosenValues'].map((prop) => prop.name)},
                    { "property_name": "Industry", "value": eventData["single_select__1"]["label"]["text"]},
                    { "property_name": "Title", "value":eventData["short_text1__1"]["value"]}]
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
            } else {
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
                
                //assign user to the repo
                const username = eventData['short_text_mkka39g4']['value']
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

                //Apply custom properties to the repo
                let customProps = [{ "property_name": "Technology", "value": eventData['multi_select5__1']['chosenValues'].map((prop) => prop.name)},
                                    { "property_name": "Industry", "value": eventData["single_select__1"]["label"]["text"]},
                                    { "property_name": "Title", "value":eventData["short_text1__1"]["value"]}];
                console.log(customProps);
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
            }
            
            } catch (error) {
                if (error.response) {
                console.error(`Error! Status: ${error.response.status}. Message: ${error.response.data.message}`)
            }
            console.error(error);

            return new Response("Error creating repo", {status: 401});
        }

        return new Response("Success!");
    }
    else {
        return new Response("request not recognized", {status: 401})
    }
}