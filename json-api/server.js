console.log('server.js: starting');

// == External Modules ==================
var express = require('express');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var mongoosePaginate = require('mongoose-paginate');

//var morgan = require('morgan');

// == Local Modules ======================
var routes = require("./app/routes"); // ./apps/routes.js

// == Config =============================
var db	 = require('./config/db');  // ./config/db.js
var port = 3000;

// == Initialization =====================
// Connect to MongoDB
console.log('Connecting Mongoose to ' + db.url);
mongoose.connect(db.url);
console.log('Connection established');

mongoose.set('debug', true);
console.log('Debug enabled');

console.log('Creating app');
var app = express();

//??console.log('app.use(morgan)');
//??app.use(morgan);

//app.use(morgan('combined'))
//app.use(stormpath.init(app, { ... }));

// get all data/stuff of the body (POST) parameters
// parse application/json 
console.log('app.use(bodyParser) (1)');
app.use(bodyParser.json({strict:false}));

// parse application/x-www-form-urlencoded
console.log('app.use(bodyParser) (2)');
app.use(bodyParser.urlencoded({ extended: true }));

// parse application/vnd.api+json as json
//app.use(bodyParser.json({ type: 'application/vnd.api+json' }));

// override with the X-HTTP-Method-Override header in the request. simulate DELETE/PUT
//app.use(methodOverride('X-HTTP-Method-Override'));

// set the static files location /public/img will be /img for users
//app.use(express.static(__dirname + '/public'));

// !!! Only use in development/debug mode
//app.use(errorhandler)

// Set content-type to application/json
console.log('addAPIRouter()');
routes.addAPIRouter(app, mongoose, mongoosePaginate);

// Default route
console.log('Defining default route');
app.use(function(req, res, next){
   res.status(404);
   res.json({ error: 'Invalid URL' });
});

// == Start App ============================
console.log('Opening port ' + port);
app.listen(port);
console.log('server.js: opened :' + port);

// Expose app
exports = module.exports = app;

//
console.log('server.js: done');
