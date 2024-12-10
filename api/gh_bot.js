import dotenv from "dotenv";
import {App} from "octokit";

export const dynamic = 'force-dynamic'; // static by default, unless reading the request
export const runtime = 'nodejs';


 
export function GET(request) {
  return new Response(`Hello from ${process.env.VERCEL_REGION}`);
}

export function POST(request) {
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

    const octokit = github_app.getInstallationOctokit(installation_id);

    var chunks = []
    req.on('data', chunk => {
        chunks.push(chunk);
    }).on('error', err => {
        // This prints the error message and stack trace to `stderr`.
        console.error(err.stack);
    }).on('end', () => {
        var body = Buffer.concat(chunks).toString();
        // at this point, `body` has the entire request body stored in it as a string
        console.log(body)

        const bodyObj = JSON.parse(body)

        if (Object.hasOwn(bodyObj, "challenge")) {
            return new Response(bodyObj)
        }
        else if (Object.hasOwn(bodyObj, "event")) {
        //Now create the repo on github
            try {
                var eventData = bodyObj["event"]["columnValues"];
                var ce_org = "ibm-client-engineering";
                var data = {"owner": ce_org, "name": eventData["short_text1__1"]["value"], "description": eventData["long_text__1"]["text"]}
                octokit.request("POST /repos/{org}/{template}/generate", {
                    org: ce_org,
                    template: "Quarto-Sample",
                    data: data,
                    headers: {
                        "x-github-api-version": "2022-11-28",
                        "Accept": "application/vnd.github+json"
                    },
                });
            
                } catch (error) {
                    if (error.response) {
                    console.error(`Error! Status: ${error.response.status}. Message: ${error.response.data.message}`)
                }
                console.error(error);

                return new Response("Error creating repo", {status: 401});
            }

            res.statusCode = 200;
            return new Response("Sucess!");
        }
        else {
            return new Response("request not recognized", {status: 401})
        }
    });
}