const express = require('express');
const cookieParser = require('cookie-parser');

const session = require("express-session");

const mongodb = require("mongodb");
const mongoose = require('mongoose');

const {MONGODB, SESSION} = require('./credentials');

const uri = `mongodb+srv://${MONGODB.user}:${MONGODB.login}@${MONGODB.cluster}/?retryWrites=true&w=majority`



const app = express();
const port = 3000;

//Cookie Middleware
// app.use(cookieParser("mySecretCookie"));

//Client Side Session
// app.use(session( {
//     name: "session",
//     keys: ["key1dada", "Key2lol"]
// }));

//Client Side Session
// app.get("/", (req,res) =>{
//     req.session.views = (req.session.views || 0) + 1;
//     req.session.somethingElse = "SOME LONG STRING";
//     res.send("Loaded " + req.session.views + " times")
// })

//Server Side Session
app.use(session({
    secret: "AsecretorSomethin"
}));

app.use( (req, res, next) =>{
    if(!req.session.views){
        req.session.views = {}
    }
    let pathname = req.url;
    req.session.views[pathname] = (req.session.views[pathname] || 0) + 1;
    console.log(req.session.views);
    next();
})

app.get("/", (req,res) =>{
    res.send("Loaded " + req.session.views["/"] + " times")
})

app.get("/othersite", (req,res) =>{
    res.send("Loaded " + req.session.views["/othersite"] + " times")
})

//Creates Cookies Very Basic
// app.get('/', (req, res) =>{
//     res.setHeader("set-Cookie", ["C1=Hello; Max-Age=5", "C2=World!"]);
//     res.send("Cookies set")
// })

//Displays Cookies basic
// app.get("/displayCookies", (req, res) =>{
//     res.send(req.headers.cookie);
// })


//Uses Cookie middleware
app.get('/', (req, res) =>{
    res.cookie("mySignedCookie", "VanillaWithChocolateChip" , {signed: true});
    res.cookie("C1", "Hello");
    res.send("Cookies set")
})

//Displays Cookies with middleware
app.get("/displayCookies", (req, res) =>{
    // res.send(req.cookies); //
    res.send(req.signedCookies); //Shows the signed cookies
})

//Deletes cookies and redirects to the /displayCookies site
app.get("/deleteCookies", (req, res) =>{
    res.clearCookie("C1");
    res.clearCookie("mySignedCookie");
    res.redirect("/displayCookie");
})



app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
  });