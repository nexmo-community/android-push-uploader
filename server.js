const express = require("express");
const Busboy = require("busboy");
const Vonage = require("nexmo");
const https = require("https");

const app = express();
app.use(express.json());
app.use(express.static("public"));

app.get("/", (request, response) => {
  response.sendFile(__dirname + "/views/index.html");
});

app.post("/upload", (request, response) => {
  const busboy = new Busboy({ headers: request.headers });

  var formParameters = new Map();
  busboy.on('field', function(fieldname, val) {
    formParameters.set(fieldname, val);
  });

  var formFiles = new Map();
  busboy.on("file", function(fieldname, file, filename, encoding, mimetype) {
    file.on("data", data => {
      formFiles.set(fieldname, data);
    });
  });

  busboy.on("finish", async function() {
    // console.log(formParameters)
    console.log("finish")
    console.log()

    var appId = formParameters.get('appid');
    var firebaseProjectId = formParameters.get("firebaseprojectid");
    var firebaseToken = formParameters.get("firebasetoken");
    var privateKey = formFiles.get("privatekey").toString();

    console.log("privateKey: " + privateKey)
    console.log("appId: " + appId)
    console.log("firebaseToken: " + firebaseToken)
    console.log("firebaseProjectId: " + firebaseProjectId)

    const linkServicesResponse = await linkServices(privateKey, appId, firebaseProjectId, firebaseToken);
    response.status(200).send(linkServicesResponse);
  });

  return request.pipe(busboy);
});

// Link the Vonage backend push service with the Firebase application
async function linkServices(privateKey, appId, firebaseProjectId, firebaseToken) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.nexmo.com",
      path: `/v1/applications/${appId}/push_tokens/android`,
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + getJwt(appId, privateKey)
      }
    };

    const postData = JSON.stringify({
      token: firebaseToken,
      projectId: firebaseProjectId
    });

    const req = https.request(options, res => {
      console.log(`statusCode: ${res.statusCode}`);
      console.log(`res: ${res.statusMessage}`);
      res.setEncoding("utf8");
      res.on("data", d => {
        console.log(d);
      });
      res.on("end", function() {
        resolve({ message: res.statusMessage, code: res.statusCode });
      });
    });

    req.on("error", error => {
      console.error(error);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

const listener = app.listen(process.env.PORT, () => {
  console.log("App available at: http://localhost:" + listener.address().port + "/");
});

function getJwt(appId, privateKey) {
  const vonage = new Vonage(
    {
      applicationId: appId,
      privateKey: privateKey
    },
    { debug: true }
  );

  const jwt = vonage.generateJwt({
    exp: Math.round(new Date().getTime() / 1000) + 120,
    acl: {
      paths: {
        "/*/users/**": {},
        "/*/conversations/**": {},
        "/*/sessions/**": {},
        "/*/devices/**": {},
        "/*/image/**": {},
        "/*/media/**": {},
        "/*/applications/**": {},
        "/*/push/**": {},
        "/*/knocking/**": {}
      }
    }
  });

  return jwt;
}
