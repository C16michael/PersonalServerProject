// Import required modules
const express = require("express");
const expressWs = require('express-ws');
const app = express();
const multiparty = require("multiparty");
const path = require("path");
const fs = require("fs");
const port = 3000;
const nunjucks = require('nunjucks');
const mongodb = require('mongodb');
const mongoose = require('mongoose');
const { MONGODB } = require("./credentials");
const hash = require('pbkdf2-password');

const { UserModel } = require('./models/user_models');
const { cookieSecret } = require('./credentials');

const uri = `mongodb+srv://${MONGODB.user}:${MONGODB.login}@${MONGODB.cluster}/?retryWrites=true&w=majority`
expressWs(app);
const {seedUserCollection} = require("./models/user_models")
seedUserCollection(uri).then(result => console.log("DB seeded"))

const {user_routes, url_prefix} = require("./routes/user_routes")
app.use(url_prefix, user_routes)

const session = require("express-session");
app.use(express.urlencoded({extended: false}));
app.use(session({
    secret: cookieSecret,
    resave: false,
    saveUninitialized: true
}));

const client = new mongodb.MongoClient(uri);

// Connect to MongoDB
mongoose.connect(uri)
  .then(() => console.log('Connected to MongoDB Mongoose'))
  .catch(err => console.error('Could not connect to MongoDB', err));

  // Function to connect to MongoDB and return the collection
async function connectToMongoDB() {
  await client.connect();
  console.log("Connected to MongoDB");
  return client.db("Asgn3").collection("Test");
}

const totalCountSchema = new mongoose.Schema({
  totalPreviews: { type: Number, default: 0 },
  totalDownloads: { type: Number, default: 0 }
});

function restrict(req, res, next) {
  if (req.session.user) {
      next();
  } else {
      res.redirect('/login');
  }
}

// Use this middleware in routes that require authentication
app.get('/restricted', restrict, (req, res) => {
  res.redirect('/files');
});


const TotalCount = mongoose.model('TotalCount', totalCountSchema);

app.ws('/count', async (ws, req) => {
  const db = await connectToMongoDB();
  console.log("WebSocket connection established with /count");

  ws.on('message', async (msg) => {
    console.log("WebSocket message received:", msg);

    try {
      const { type } = JSON.parse(msg);
      console.log(`Incrementing ${type} count`);

      if (type === 'preview') {
        const updateResult = await db.findOneAndUpdate(
          { varName: 'PreviewCount' },
          { $inc: { value: 1 } },
          { new: true, upsert: true }
        );
        console.log('PreviewCount updated:', updateResult.value);
      } else if (type === 'download') {
        const updateResult = await db.findOneAndUpdate(
          { varName: 'DownloadCount' },
          { $inc: { value: 1 } },
          { new: true, upsert: true }
        );
        console.log('DownloadCount updated:', updateResult.value);
      }

      ws.send(JSON.stringify({ type, status: 'updated' }));
    } catch (error) {
      console.error('WebSocket error:', error);
    }
  });
});


// Define the directory for serving files and keeping download count
const publicDirectory = path.join(__dirname, "public"); // Directory for serving files
app.use(express.static(publicDirectory));

// Configure Nunjucks
nunjucks.configure('views', { // 'views' is the directory where your templates are located
  autoescape: true,
  express: app
});


// Set Nunjucks as the rendering engine for HTML files
app.set('view engine', 'njk');

// Middleware to parse JSON and form data in POST requests
app.use(express.json()); // Parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // Parse form data in URL-encoded request bodies

// Define a route to list directory content
app.get("/files", restrict, async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const previewCountDoc = await db.findOne({ varName: 'PreviewCount' });
    const downloadCountDoc = await db.findOne({ varName: 'DownloadCount' });

    const files = await fs.promises.readdir(publicDirectory);
    const fileLinks = files.map(filename => {
      const fileLink = `/${filename}`;
      return `<div>${filename}<br><a href="${fileLink}" download="${filename}" class="download-link" onclick="sendCountUpdate('download')">- Download</a>
      <a href="${fileLink}" target="_blank" class="preview-link" onclick="sendCountUpdate('preview')">- Preview</a>
      `;
    }).join("<br>");
    

    res.render('file-list', {
      fileList: fileLinks,
      totalPreviews: previewCountDoc ? previewCountDoc.value : 0,
      totalDownloads: downloadCountDoc ? downloadCountDoc.value : 0
    });
  } catch (error) {
    console.error('Error in /files route:', error);
    res.status(500).render('500', {
      title: '500 Internal Server Error',
      message: 'Error processing request.'
    });
  }
});

// Define a route to display the file upload form
app.get("/upload/form", restrict, (req, res) => {
  res.render('upload-form');
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
      res.redirect('/login');
  });
});

app.get('/files/:filename', restrict, async (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(publicDirectory, filename);

  try {
    // Increment the DownloadCount in the database
    const result = await connectToMongoDB().findOneAndUpdate(
      { varName: 'DownloadCount' },
      { $inc: { value: 1 } },
      { new: true, upsert: true }
    );

    console.log('DownloadCount incremented:', result.value);

    // Send the file for download
    res.download(filePath, filename);
  } catch (error) {
    console.error('Error processing file download:', error);
    res.status(500).render('500', {
      title: '500 Internal Server Error',
      message: 'Error processing file download.'
    });
  }
});

app.route('/login')
    .get((req, res) => {
        res.render("login.njk");
    })
    .post(async (req, res) => {
        try {
            let authenticated = await UserModel.saltedAuthenticate(req.body.user, req.body.password);
            
            if (authenticated) {
                req.session.regenerate(() => {
                    req.session.user = req.body.user;
                    res.redirect("/restricted");
                });
            } else {
                res.redirect('/login');
            }
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).send('Internal Server Error');
        }
    });





// Define a route to handle file uploads via POST requests
app.post('/upload', (req, res) => {
    const form = new multiparty.Form();
  
    form.parse(req, (err, fields, files) => {
      if (err) {
        // Handle errors when parsing the form
        return res.status(500).render('500', {
          title: '500 Internal Server Error',
          message: 'Error processing your request.'
      });
      }
  
      if (!files || !files.file || !files.file[0]) {
        // Handle cases where no file is uploaded
        return res.status(404).render('404', {
          title: '404 Not Found',
          message: 'No file uploaded.'
      });
      }
  
      const uploadedFile = files.file[0]; //extracts file from file object
      const originalFilename = uploadedFile.originalFilename; //Takes the name element of the uploaded item
      const destinationPath = path.join(publicDirectory, originalFilename); // Generates the path for the new item 
  
      fs.rename(uploadedFile.path, destinationPath, (err) => { //rename moves the file from current path to destinationPath
        if (err) {
          // Handle errors when moving the uploaded file
          return res.status(500).sendFile(__dirname + "/500.html");
        }
        res.send('File Uploaded Without Refreshing!'); // Send a success response
      });
    });
  });

 

  
// Custom 404
app.use((req, res) => {
  res.status(404).render('404', { 
      title: '404 Not Found',
      message: 'The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.'
  });
});

// Custom 500 
app.use((err, req, res, next) => {
  res.status(500).render('500', { 
      title: '500 Internal Server Error',
      message: 'Oops! Something went wrong on our end.'
  });
});

// Start the Express server
app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}/files`);
});