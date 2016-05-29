// == Modules ================================
var express            = require('express');
var validator          = require('validator');
var async              = require('async');

// == State ==================================
var metadata           = null;
var apiRouter          = null;
var apiBackend         = null;

// == Initialization  ========================

exports.getApiRouter = function(_metadata, app, dbConfig){
    // -- Initialization ----------------------------
    metadata = _metadata;
    
    // Choose backend
    if(dbConfig.dbBackend == 'mongodb'){
        apiBackend = require('./mongoDBBackend');

    } else if(dbConfig.dbBackend == 'mysql'){
        apiBackend = require('./mysqlBackend');
    }

    apiBackend.init(metadata, dbConfig);

    //
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

