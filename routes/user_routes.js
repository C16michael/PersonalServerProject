const express = require("express");
const router = express.Router();
const { UserModel } = require("../models/user_models");

// Prefix for all routes defined in this router
const url_prefix = "/user";

// Middleware to restrict access to authenticated users
function restrict(req, res, next) {
    // Check if the user is logged in
    if (req.session.user) {
        console.log("Access granted");
        next(); // Proceed to the next middleware/route handler
    } else {
        console.log("Access denied");
        res.redirect(url_prefix + "/login"); // Redirect to login if not authenticated
    }
}

// Route for the login page
router.route("/login")
    .get((req, res) => {
        // Render the login template when a GET request is made
        res.render("login.njk", {});
    })
    .post(async (req, res) => {
        // Handle the login POST request
        // Authenticate the user using the UserModel
        let authenticated = await UserModel.saltedAuthenticate(req.body.user, req.body.password);
        
        if (authenticated) {
            // If authentication is successful
            console.log("Authenticated", req.body.user);
            req.session.regenerate(() => {
                // Regenerate the session for security purposes
                req.session.user = req.body.user; // Store the user's information in the session
                res.redirect(url_prefix + "/restricted"); // Redirect to the restricted area
            });
        } else {
            // If authentication fails
            res.redirect(url_prefix + "/login"); // Redirect back to the login page
        }
    });

// Route for restricted content
router.route("/restricted")
    .get(restrict, (req, res) => {
        // Use the 'restrict' middleware to protect this route
        // Send a response indicating access to restricted content
        res.send("You reached the restricted parts....");
    });

// Route for logging out
router.get("/logout", (req, res) => {
    // Handle the logout process
    req.session.destroy(() => {
        // Destroy the session to log the user out
        res.redirect(url_prefix + "/login"); // Redirect to the login page after logout
    });
});

// Export the router and the URL prefix used by it
module.exports = {
    user_routes: router,
    url_prefix: url_prefix
};
