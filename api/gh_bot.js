import dotenv from "dotenv";
import {App} from "octokit";

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

    // This reads the contents of your private key file.
    const privateKey = process.env.PRIVATE_KEY


    // This creates a new instance of the Octokit App class.
    const github_app = new App({
        appId: appId,
        privateKey: privateKey,
    });

    const octokit = await github_app.getInstallationOctokit(installation_id);

    var chunks = []
    for await (const chunk of request.body) {
        chunks.push(chunk);
    }
    var body = Buffer.concat(chunks).toString();
    const bodyObj = JSON.parse(body);
    console.log(bodyObj)

    return new Response("Success!");
    

    if (Object.hasOwn(bodyObj, "challenge")) {
        
        return new Response(JSON.stringify(bodyObj))
    }
    else if (Object.hasOwn(bodyObj, "event")) {
       //Now create the repo on github
        try {
            var eventData = bodyObj["event"]["columnValues"];
            console.log(eventData);
            //create the repo
            var ce_org = "ibm-client-engineering";
            var data = {"owner": ce_org, "name": eventData["short_text1__1"]["value"], "description": eventData["long_text__1"]["text"]}
            // const result = await octokit.request("POST /repos/{org}/{template}/generate", {
            //     org: ce_org,
            //     template: "Quarto-Sample",
            //     data: data,
            //     headers: {
            //         "x-github-api-version": "2022-11-28",
            //         "Accept": "application/vnd.github+json"
            //     },
            // });

            // console.log(result);
            const email = "samuel.l@ibm.com"
            //get username from email
            const queryString = 'q=' + encodeURIComponent(`${email} in:email`);
            const search_result = await octokit.request("GET /search/users", {
                q: queryString,
                headers: {
                    "x-github-api-version": "2022-11-28",
                    "Accept": "application/vnd.github+json"
                },
            });
            console.log(search_result);
            

            //assign user to the repo
            // const assign_result = await octokit.request("POST /repos/{org}/{template}/generate", {
            //     org: ce_org,
            //     template: "Quarto-Sample",
            //     data: data,
            //     headers: {
            //         "x-github-api-version": "2022-11-28",
            //         "Accept": "application/vnd.github+json"
            //     },
            // });
        
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