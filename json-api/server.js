/**
 * The main application module. 
 *
 * @module  server
 * @see     module:app/mysqlBackend
 * @see     module:app/mongoDBBackend
 */

// External Modules
var express      = require('express');
var bodyParser   = require('body-parser');

//  Configuration
var port         = 3000;
var dbConfig     = require('./config/db');

/**
 * Load and return the selected backend module
 */
var loadBackend = function(){
    if(dbConfig.dbBackend == 'mongodb'){
        return require('./app/mongoDBBackend');
        
    } else if(dbConfig.dbBackend == 'mysql'){
        return require('./app/mysqlBackend');
    }

    throw ('API Backend unknown: "' + dbConfig.dbBackend + '"');
};

/**
 * Constructs an Express App object
 */
var getExpressApp = function(){
    var app = express();
    var pathWildcard = '/*';

    // parse application/json 
    app.use(bodyParser.json({strict:false}));

    // parse application/x-www-form-urlencoded
    app.use(bodyParser.urlencoded({ extended: true }));

    // Set default Content-Type for all HTTP methods
    app.get(pathWildcard, function(req, res, next) {
        res.contentType('application/json');
        next();
    });
    app.post(pathWildcard, function(req, res, next) {
        res.contentType('application/json');
        next();
    });
    app.put(pathWildcard, function(req, res, next) {
        res.contentType('application/json');
        next();
    });
    app.delete(pathWildcard, function(req, res, next) {
        res.contentType('application/json');
        next();
    });

    return app;
};

/**
 * Main function
 */
var main = function(){
    // Create Express App
    var app = getExpressApp();

    // Create Express Router
    var router = express.Router();
    
    // Set a dummy response for the / path
    router.get('/', function(req, res){
        res.json({ message: 'API 1.0 operational' });
    });

    // Load and initialize one of the backends
    var backend = loadBackend();
    backend.init(dbConfig);

    // Connect actual routes to the backend
    router = backend.setRoutes(router);

    // Map API routes to this path
    app.use('/api/v1.0', router);

    // Set default route to 404
    app.use(function(req, res, next){
        res.status(404);
        res.json({ error: 'Invalid URL' });
        next();
    });

    // Start Application
    app.listen(port);
    console.log('server.js: listening on: ' + port);

    //
    return app;
};

/*
 * Expose application
 */
exports = module.exports = main();
