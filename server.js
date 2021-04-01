const express = require("express");
const Busboy = require("busboy");
const Vonage = require("nexmo");
const https = require("https");

const PORT = '3200';

const app = express();
app.use(express.json());
app.use(express.static("public"));

app.get("/", (request, response) => {
  response.sendFile(__dirname + "/views/index.html");
});

app.post("/upload", (request, response) => {
  const busboy = new Busboy({ headers: request.headers });
  const files = [];
  const buffers = {};  

  var formData = new Map();
  busboy.on('field', function(fieldname, val) {
    formData.set(fieldname, val);
  });

  busboy.on("file", function(fieldname, file, filename, encoding, mimetype) {
    buffers[fieldname] = [];
    file.on("data", data => {
      buffers[fieldname].push(data);
    });

    file.on("end", () => {
      files.push({
        fileBuffer: Buffer.concat(buffers[fieldname]),
        fileType: mimetype,
        fileName: filename,
        fileEnc: encoding
      });
    });
  });

  busboy.on("finish", async function() {
    console.log(formData)

    var appId = formData.get('appid');
    var firebaseProjectId = formData.get('firebaseprojectid');
    var firebaseToken = formData.get('firebasetoken');

    const linkServicesResponse = await linkServices(files, appId, firebaseProjectId, firebaseToken);
    response.status(200).send(linkServicesResponse);
  });

  return request.pipe(busboy);
});

// Link the Vonage backend push service with the Firebase application
async function linkServices(files, appId, firebaseProjectId, firebaseToken) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.nexmo.com",
      path: `/v1/applications/${appId}/push_tokens/android`,
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + getJwt(appId, files[0].fileBuffer)
      },
      body: JSON.stringify({
          projectId: firebaseProjectId,
          token: firebaseToken
      })
    };

    const postData = JSON.stringify({
      token: files[1].fileBuffer
        .toString("hex")
        .match(/../g)
        .join("")
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

const listener = app.listen(PORT, () => {
  console.log("App available at: http://localhost:" + listener.address().port + "/");
});

function getJwt(appId, privateKeyBuffer) {
  const vonage = new Vonage(
    {
      applicationId: appId,
      privateKey: privateKeyBuffer
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
