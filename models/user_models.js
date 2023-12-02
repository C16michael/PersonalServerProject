const mongoose = require("mongoose");
const { admin_password } = require("../credentials");
const hash = require("pbkdf2-password")();

// Define the user schema for MongoDB
const userSchema = new mongoose.Schema({
    user: {
        type: String,
        required: true // Username is required
    },
    hash: {
        type: String,
        required: true // Hashed password is required
    },
    salt: {
        type: String,
        required: true // Salt for the hash is required
    }
}, {
    statics: {
        // Simple authentication method (not used in salted authentication)
        async authenticate(user, pw) {
            let doc = await this.findOne({ user: user });
            if (doc) {
                console.log("Found entry");
                if (pw === doc.password) {
                    return true; // Password matches
                } else {
                    console.log("password did not match");
                    return false; // Password does not match
                }
            } else {
                console.log("no user found");
                return false; // User not found
            }
        },
        // Salted authentication method
        async saltedAuthenticate(user, pw) {
            let doc = await this.findOne({ user: user });

            return new Promise((resolve, reject) => {
                if (doc) {
                    console.log("Found entry");
                    console.log("Salt found ", doc.salt);
                    // Hash the provided password with the user's salt
                    hash({ password: pw, salt: doc.salt }, (err, pass, salt, hash) => {
                        if (err) throw err;
                        if (hash === doc.hash) {
                            console.log("matched");
                            resolve(true); // Password matches
                        } else {
                            console.log("password did not match");
                            resolve(false); // Password does not match
                        }
                    });
                } else {
                    console.log("no user found");
                    resolve(false); // User not found
                }
            });
        }
    }
});

// Create the user model
const UserModel = mongoose.model("user", userSchema);

// Function to seed the user collection in the database
async function seedUserCollection(connectionString) {
    let hashedUser = new UserModel({
        user: "Admin",
        hash: "",
        salt: ""
    });

    // Hash the admin password
    hash({ password: "testingPassword" }, (err, pass, salt, hashed) => {
        if (err) throw err;
        hashedUser.hash = hashed;
        hashedUser.salt = salt;
    });

    // Connect to the database
    await mongoose.connect(connectionString).catch(console.log);
    // Drop the existing users collection if it exists
    await mongoose.connection.db.dropCollection("users");
    console.log("Collection dropped");

    // Save the new admin user
    let result = await hashedUser.save();
    return result;
}

// Export the seed function and the UserModel
module.exports = {
    seedUserCollection: seedUserCollection,
    UserModel: UserModel
};
