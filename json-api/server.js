// == External Modules ==================
var express           = require('express');
var bodyParser        = require('body-parser');
var mongoose          = require('mongoose');
var mongoosePaginate  = require('mongoose-paginate');

// == Config =============================
var db	              = require('./config/db');
var metadata          = require('../metadata');
//var security        = require('../config/security');
var port              = 3000;

// == Local Modules ======================
var routes            = require("./app/routes"); 
//var logger          = require('../logger');

// == Initialization =====================
// Connect to MongoDB
mongoose.connect(db.url);
mongoose.set('debug', true);

routes.initialize(metadata);

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

// Here are the actual API calls
routes.addAPIRouter(app, mongoose, mongoosePaginate);

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

