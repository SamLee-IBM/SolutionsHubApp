// These are the dependencies for this file.
//
// You installed the `dotenv` and `octokit` modules earlier. The `@octokit/webhooks` is a dependency of the `octokit` module, so you don't need to install it separately. The `fs` and `http` dependencies are built-in Node.js modules.
import dotenv from "dotenv";
import {App} from "octokit";
import http from "http";
import express from 'express';

const app = express();

// This reads your `.env` file and adds the variables from that file to the `process.env` object in Node.js.
dotenv.config();

// This assigns the values of your environment variables to local variables.
const appId = process.env.APP_ID;
const privateKeyPath = process.env.PRIVATE_KEY_PATH;
const installation_id = process.env.INSTALLATION_ID;

// This reads the contents of your private key file.
const privateKey = process.env.PRIVATE_KEY

// This creates a new instance of the Octokit App class.
const github_app = new App({
  appId: appId,
  privateKey: privateKey,
});

const octokit = await github_app.getInstallationOctokit(installation_id);

app.post("/", (req, res) => {
 
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
            res.statusCode = 200
            res.end(body)
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
                console.error(error)
                res.statusCode = 402
                res.end("Error creating repo")
            }

            res.statusCode = 200
            res.end()
        }
        else {
            res.status(401).json({ error_message : "request not recognized" })
        }
     
        
    });
    
    

   
 });


// This determines where your server will listen.
//
// For local development, your server will listen to port 3000 on `localhost`. When you deploy your app, you will change these values. For more information, see "[Deploy your app](#deploy-your-app)."
const port = 3000;

// This creates a Node.js server that listens for incoming HTTP requests (including webhook payloads from GitHub) on the specified port. When the server receives a request, it executes the `middleware` function that you defined earlier. Once the server is running, it logs messages to the console to indicate that it is listening.
app.listen(port, () => {
  console.log(`Server is listening for events`);
  console.log('Press Ctrl + C to quit.')
});
