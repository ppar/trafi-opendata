/**
 * Routes module.
 * 
 * Loads an API Router for either the MySQL or MongoDB backend and
 * returns it to the application.
 *
 * @module app/routes
 * @see    module:server
 */
// == Modules ================================
var express            = require('express');
var validator          = require('validator');
var async              = require('async');

// == State ==================================
var apiRouter          = null;
var apiBackend         = null;

// == Initialization  ========================

/**
 * Create and initialize API Router
 *
 * Creates an Express Router, connects the selected 
 * backend to it and returns it.
 * 
 * @param  {object} app         - An Express object
 * @param  {object} dbConfig    - A DB configuration object from config/db.js
 *
 * @return {object} An Express Router object
 */
exports.getApiRouter = function(app, dbConfig){
    // Load backend
    if(dbConfig.dbBackend == 'mongodb'){
        apiBackend = require('./mongoDBBackend');

    } else if(dbConfig.dbBackend == 'mysql'){
        apiBackend = require('./mysqlBackend');

    } else {
        console.log('API Backend unknown: "' + dbConfig.dbBackend + '"');
        return false;
    }

    // Initialize it
    apiBackend.init(dbConfig);

    // Create Express router
    apiRouter = express.Router();

    // -- Defaults for all routes --------------------
    var pathWildcard = '/*';
    //var pathWildcard = '/api/v1.0/*';
    
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

    // -- Root path ---------------------------------
    apiRouter.get('/', function(req, res){
        res.json({ message: 'API 1.0 operational' });
    });

    // -- Backend -----------------------------------
    apiBackend.setApiRoutes(app, apiRouter);

    return apiRouter;
};

