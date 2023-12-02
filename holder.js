// Import required modules
const express = require("express");
const expressWs = require("express-ws");
const multiparty = require("multiparty");
const path = require("path");
const fs = require("fs");
const nunjucks = require("nunjucks");
const mongoose = require("mongoose");
const session = require("express-session");
const mongodb = require("mongodb");

// Import configurations and models
const { MONGODB, cookieSecret } = require("./credentials");
const { UserModel } = require("./models/user_models");
const { user_routes, url_prefix } = require("./routes/user_routes");
const { seedUserCollection } = require("./models/user_models");

// MongoDB URI and Express app initialization
const uri = `mongodb+srv://${MONGODB.user}:${MONGODB.login}@${MONGODB.cluster}/?retryWrites=true&w=majority`;
const app = express();
expressWs(app);
const port = 3000;

// Seed the database with initial user data
seedUserCollection(uri).then((result) => console.log("DB seeded"));

// Apply user routes
app.use(url_prefix, user_routes);

// Session configuration
app.use(express.urlencoded({ extended: false }));
app.use(session({
    secret: cookieSecret,
    resave: false,
    saveUninitialized: true,
}));

// MongoDB client for native operations
const client = new mongodb.MongoClient(uri);

// Connect to MongoDB using Mongoose
mongoose.connect(uri)
  .then(() => console.log("Connected to MongoDB Mongoose"))
  .catch((err) => console.error("Could not connect to MongoDB", err));

// Function to connect to MongoDB and return the collection
async function connectToMongoDB() {
  await client.connect();
  console.log("Connected to MongoDB");
  return client.db("Asgn3").collection("Test");
}

// Schema for tracking total counts
const totalCountSchema = new mongoose.Schema({
  totalPreviews: { type: Number, default: 0 },
  totalDownloads: { type: Number, default: 0 },
});

// Middleware to restrict access to authenticated users
function restrict(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    res.redirect("/login");
  }
}

// Apply restriction middleware to specific routes
app.get("/restricted", restrict, (req, res) => res.redirect("/files"));
app.get("/files", restrict, handleFilesRoute);
app.get("/upload/form", restrict, (req, res) => res.render("upload-form"));
app.get("/files/:filename", restrict, handleFileDownload);

// WebSocket setup for real-time updates
app.ws("/count", setupWebSocket);

// Nunjucks configuration for templating
nunjucks.configure("views", { autoescape: true, express: app });
app.set("view engine", "njk");

// Middleware for parsing request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files directory setup
const publicDirectory = path.join(__dirname, "public");
app.use(express.static(publicDirectory));

// Route for handling file uploads
app.post("/upload", handleFileUpload);

// Custom error handlers
app.use(handle404Error);
app.use(handle500Error);

// Start the Express server
app.listen(port, () => console.log(`Server listening at http://localhost:${port}/files`));

// Function definitions for route handlers and WebSocket
function handleFilesRoute(req, res) {
  // Logic for /files route
}

function handleFileDownload(req, res) {
  // Logic for file download
}

function setupWebSocket(ws, req) {
  // WebSocket setup logic
}

function handleFileUpload(req, res) {
  // Logic for handling file uploads
}

function handle404Error(req, res) {
  // Custom 404 error handler
}

function handle500Error(err, req, res, next) {
  // Custom 500 error handler
}
