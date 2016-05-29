// == External Modules ==================
var express           = require('express');
var bodyParser        = require('body-parser');
var mysql             = null;

// == Config =============================
var dbConfig          = require('./config/db');
var metadata          = require('../metadata');
//var security        = require('../config/security');
var port              = 3000;

// == Local Modules ======================
var routes            = require("./app/routes"); 
//var logger          = require('../logger');


// == Initialization =====================
var app = express();

// parse application/json 
app.use(bodyParser.json({strict:false}));
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));
// parse application/vnd.api+json as json
//app.use(bodyParser.json({ type: 'application/vnd.api+json' }));
// override with the X-HTTP-Method-Override header in the request. simulate DELETE/PUT
//app.use(methodOverride('X-HTTP-Method-Override'));

// set the static files location /public/img will be /img for users
//app.use(express.static(__dirname + '/public'));

//app.use(errorhandler)

// The actual API calls are here
var apiRouter = routes.getApiRouter(metadata, app, dbConfig);
app.use('/api/v1.0', apiRouter);

// Default route
app.use(function(req, res, next){
   res.status(404);
   res.json({ error: 'Invalid URL' });
});

// == Start App ============================
app.listen(port);
console.log('server.js: listening on: ' + port);

// Expose app
exports = module.exports = app;
