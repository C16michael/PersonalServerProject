// Importing required modules
const express = require("express");
const expressWs = require("express-ws"); // For WebSocket support
const app = express();
const multiparty = require("multiparty"); // For handling multipart/form-data
const path = require("path");
const fs = require("fs"); // For file system operations
const nunjucks = require("nunjucks"); // Templating engine
const mongodb = require("mongodb"); // MongoDB driver
const mongoose = require("mongoose"); // Mongoose for MongoDB interaction

// Importing configuration and models
const { MONGODB } = require("./credentials"); // MongoDB credentials
const { UserModel } = require("./models/user_models"); // User model for authentication
const { cookieSecret } = require("./credentials"); // Secret for cookie session
const port = 3000; // Server port
const uri = `mongodb+srv://${MONGODB.user}:${MONGODB.login}@${MONGODB.cluster}/?retryWrites=true&w=majority`;

// Define the directory for serving files and keeping download count
const publicDirectory = path.join(__dirname, "public"); // Directory for serving files
app.use(express.static(publicDirectory));

// Enabling WebSocket support in the app
expressWs(app);

// Seeding the user collection in the database
const { seedUserCollection } = require("./models/user_models");
seedUserCollection(uri).then((result) => console.log("DB seeded"));

// Setting up user routes
const { user_routes, url_prefix } = require("./routes/user_routes");
app.use(url_prefix, user_routes);

// Set Nunjucks as the rendering engine for HTML files
app.set("view engine", "njk");

// Configure Nunjucks
nunjucks.configure("views", {
  autoescape: true,
  express: app,
});

// Middleware to parse JSON and form data in POST requests
app.use(express.json()); // Parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // Parse form data in URL-encoded request bodies

// Setting up session management
const session = require("express-session");
app.use(
  session({
    secret: cookieSecret,
    resave: false,
    saveUninitialized: true,
  })
);

// MongoDB client setup
const client = new mongodb.MongoClient(uri);

// Connecting to MongoDB
mongoose
  .connect(uri)
  .then(() => console.log("Connected to MongoDB Mongoose"))
  .catch((err) => console.error("Could not connect to MongoDB", err));

// Function to connect to MongoDB and return the collection
async function connectToMongoDB() {
  await client.connect();
  console.log("Connected to MongoDB");
  return client.db("Asgn3").collection("Test");
}

function restrict(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    res.redirect("/login");
  }
}

// WebSocket route for handling count updates
app.ws("/count", async (ws, req) => {
  // Connect to MongoDB and retrieve the database
  const db = await connectToMongoDB();
  console.log("WebSocket connection established with /count");

  // Event listener for incoming WebSocket messages
  ws.on("message", async (msg) => {
    console.log("WebSocket message received:", msg);

    try {
      // Parse the incoming message to identify the type of count to increment
      const { type } = JSON.parse(msg);
      console.log(`Incrementing ${type} count`);

      // Increment the appropriate count in the database based on the message type
      if (type === "preview") {
        // Increment the preview count
        const updateResult = await db.findOneAndUpdate(
          { varName: "PreviewCount" },
          { $inc: { value: 1 } },
          { new: true, upsert: true }
        );
        console.log("PreviewCount updated:", updateResult.value);
      } else if (type === "download") {
        // Increment the download count
        const updateResult = await db.findOneAndUpdate(
          { varName: "DownloadCount" },
          { $inc: { value: 1 } },
          { new: true, upsert: true }
        );
        console.log("DownloadCount updated:", updateResult.value);
      }

      // Send a confirmation message back to the client
      ws.send(JSON.stringify({ type, status: "updated" }));
    } catch (error) {
      // Handle any errors that occur during the WebSocket communication
      console.error("WebSocket error:", error);
    }
  });
});


// Use this middleware in routes that require authentication
app.get("/restricted", restrict, (req, res) => {
  res.redirect("/files");
});

// Define a route to list directory content
app.get("/files", restrict, async (req, res) => {
  try {
    // Connect to MongoDB and retrieve the database
    const db = await connectToMongoDB();

    // Fetch the current preview and download counts from the database
    const previewCountDoc = await db.findOne({ varName: "PreviewCount" });
    const downloadCountDoc = await db.findOne({ varName: "DownloadCount" });

    // Read all files from the public directory
    const files = await fs.promises.readdir(publicDirectory);

    // Map each filename to an HTML string for displaying as links
    const fileLinks = files.map((filename) => {
      // Create a link for each file for downloading and previewing
      const fileLink = `/${filename}`;
      return `<div>${filename}<br>
                <a href="${fileLink}" download="${filename}" class="download-link" onclick="sendCountUpdate('download')">- Download</a>
                <a href="${fileLink}" target="_blank" class="preview-link" onclick="sendCountUpdate('preview')">- Preview</a>
              </div>`;
    }).join("<br>");

    // Render the file list template with the list of files and counts
    res.render("file-list", {
      fileList: fileLinks,
      totalPreviews: previewCountDoc ? previewCountDoc.value : 0,
      totalDownloads: downloadCountDoc ? downloadCountDoc.value : 0,
    });
  } catch (error) {
    // Handle any errors during the process
    console.error("Error in /files route:", error);
    res.status(500).render("500", {
      title: "500 Internal Server Error",
      message: "Error processing request.",
    });
  }
});


// Define a route to display the file upload form
app.get("/upload/form", restrict, (req, res) => {
  res.render("upload-form");
});

//Downloading of Files
app.get("/files/:filename", restrict, async (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(publicDirectory, filename);

  try {
    // Increment the DownloadCount in the database
    const result = await connectToMongoDB().findOneAndUpdate(
      { varName: "DownloadCount" },
      { $inc: { value: 1 } },
      { new: true, upsert: true }
    );

    console.log("DownloadCount incremented:", result.value);

    // Send the file for download
    res.download(filePath, filename);
  } catch (error) {
    console.error("Error processing file download:", error);
    res.status(500).render("500", {
      title: "500 Internal Server Error",
      message: "Error processing file download.",
    });
  }
});

  //Handle Loging out
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

//Logging In
app
  .route("/login")
  .get((req, res) => {
    res.render("login.njk");
  })
  .post(async (req, res) => {
    try {
      let authenticated = await UserModel.saltedAuthenticate(
        req.body.user,
        req.body.password
      );

      if (authenticated) {
        req.session.regenerate(() => {
          req.session.user = req.body.user;
          res.redirect("/restricted");
        });
      } else {
        res.redirect("/login");
      }
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).send("Internal Server Error");
    }
  });

// Define a route to handle file uploads via POST requests
app.post("/upload", (req, res) => {
  const form = new multiparty.Form();

  form.parse(req, (err, fields, files) => {
    if (err) {
      // Handle errors when parsing the form
      return res.status(500).render("500", {
        title: "500 Internal Server Error",
        message: "Error processing your request.",
      });
    }

    if (!files || !files.file || !files.file[0]) {
      // Handle cases where no file is uploaded
      return res.status(404).render("404", {
        title: "404 Not Found",
        message: "No file uploaded.",
      });
    }

    const uploadedFile = files.file[0]; //extracts file from file object
    const originalFilename = uploadedFile.originalFilename; //Takes the name element of the uploaded item
    const destinationPath = path.join(publicDirectory, originalFilename); // Generates the path for the new item

    fs.rename(uploadedFile.path, destinationPath, (err) => {
      //rename moves the file from current path to destinationPath
      if (err) {
        // Handle errors when moving the uploaded file
        return res.status(500).sendFile(__dirname + "/500.html");
      }
      res.send("File Uploaded Without Refreshing!"); // Send a success response
    });
  });
});


// Custom 404
app.use((req, res) => {
  res.status(404).render("404", {
    title: "404 Not Found",
    message:
      "The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.",
  });
});

// Custom 500
app.use((err, req, res, next) => {
  res.status(500).render("500", {
    title: "500 Internal Server Error",
    message: "Oops! Something went wrong on our end.",
  });
});

// Start the Express server
app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}/files`);
});
