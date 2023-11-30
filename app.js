// Import required modules
const express = require("express");
const app = express();
const multiparty = require("multiparty");
const path = require("path");
const fs = require("fs");
const port = 3000;
const nunjucks = require('nunjucks');

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
app.get("/files", (req, res) => {
  // Read the list of files in the public directory and send as an HTML response
  fs.readdir(publicDirectory, (err, files) => {
    if (err) {
      // Handle errors when reading the directory
      return res.status(500).sendFile(__dirname + "/500.html"); // Return a 500 Internal Server Error if reading the directory fails
    }

    const fileLinks = files.map((filename) => {
      const fileLink = `/${filename}`;
      // Generate HTML links for each file in the directory with separate links for download and preview
      return `<div>
                    ${filename}
                    <a href="${fileLink}" download="${filename}">Download</a> 
                    <a href="${fileLink}" target="_blank">Preview</a>
                  </div>`;
    });

    const fileList = fileLinks.join("<br>"); // Join the file links with line breaks
    res.send(fileList); // Send the list of files as an HTML response
  });
});

// Define a route to handle file previews
app.get("/preview/:filename", (req, res) => {
  const filename = req.params.filename; // Get the filename from the URL parameter
  const filePath = path.join(publicDirectory, filename); // Create the full path to the requested file

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // Handle errors when reading the file
      res.status(404).sendFile(__dirname + "/404.html")// Return a 404 Not Found if the file is not found
    }
    res.send(data); // Send the file data for previewing
  });
});

// Define a route to display the file upload form
app.get("/upload/form", (req, res) => {
  // Send an HTML form for file uploads
  res.sendFile(path.join(__dirname, "/upload.html"));
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