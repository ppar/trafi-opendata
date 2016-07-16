/**
 * MongoDB Backend module
 *
 * @module   app/mongoDBBackend
 */

// Modules
var mongoose          = require('mongoose');
var mongoosePaginate  = require('mongoose-paginate');
var async             = require('async');
//var logger            = require('./logger');

// Configuration & state
var metadata          = require('../../metadata');
var dbConfig          = require('../config/db');

/**
 * Initialization function
 *
 * Connects to the MongoDB database specified in dbConfig
 */
exports.init = function(){
    mongoose.connect(dbConfig.mongoDbUrl);
    mongoose.set('debug', true);
};


/**
 * Map handler functions to the API router
 *
 * @param  {object} router   - Express Router object
 * @return {object} The passed router object, with route handlers attached
 */
exports.setRoutes = function(router){

    // ----------------------------------------------
    // Create schemas and models
    var typeMap = {
        'enum': 'String',
        'string': 'String',
        'number': 'Number',
        'bool': 'Boolean',
        'date': 'Date'
    };

    // Create schema and projection for Mongoose.
    // Hide <colName>_UPPER fields from query results.
    
    var vehicleSchema = {};
    var vehicleProjection = {};
    
    for(var colName in metadata.vehicles.columns){
        vehicleSchema[colName] = typeMap[metadata.vehicles.columns[colName].type];
        
        if(!colName.endsWith('_UPPER')){
            vehicleProjection[colName] = 1;
        }
    }
    
    vehicleSchema = new mongoose.Schema(vehicleSchema, { collection: 'vehicles' } );
    vehicleSchema.plugin(mongoosePaginate);

    var VehicleModel = mongoose.model('Vehicle', vehicleSchema);

        
    // ----------------------------------------------
    // List all vehicles, paged
    // 
    // GET parameters:
    //    page:               Number of page to return (default 1)
    //    limit:              Number of items per page (default 10)
    //    find:               Search parameters as a JSON-serialized MongoDB "find" object
    //                        (default {} -- return all records}
    //
    //    resultParamDocs:    Override the name of the 'docs'  property in the response JSON
    //    resultParamTotal:   Override the name of the 'total' property in the response JSON
    //    resultParamLimit:   Override the name of the 'limit' property in the response JSON
    //    resultParamPage:    Override the name of the 'page'  property in the response JSON
    //    resultParamPages:   Override the name of the 'pages' property in the response JSON
    //
    // Result format:
    //  {
    //     "docs": [
    //         {
    //             "_id": "5740d30bfa5bd80d9538a977",
    //             "vaihteisto": "",
    //             "kayttoonottopvm": "19670000",
    //             "versio": "",
    //                 ....
    //         },
    //         {
    //                 .....
    //         }
    //     ],
    //     total: 5017436,
    //     limit: 10,
    //     page: 1,
    //     pages: 501744
    //  }
    //
    router.get('/vehicles/list', function(req, res) {
        console.log('== GET /vehicles/list ===============================');
        console.log('HTTP query params:');
        console.log(req.query);

        // Result variables
        var resultStatus = null;
        var resultJSON = {};
        var errStr = null;
        
        // Query filter for MongoDB's .find() method
        var filterParams = {};
        if(req.query.find){
            filterParams = JSON.parse(req.query.find);
        }
        
        // Options for mongoose-paginate plugin
        // Includes projection parameter for .find()
        var paginateOptions = {
            page: req.query.page   || 1,
            limit: req.query.limit || 10,
            select: vehicleProjection
        };

        // Names of properties used in the JSON response. 
        var resultParams = {
            'docs':   req.query.resultParamDocs  || 'docs',
            'total':  req.query.resultParamTotal || 'total',
            'limit':  req.query.resultParamLimit || 'limit',
            'page':   req.query.resultParamPage  || 'page',
            'pages':  req.query.resultParamPages || 'pages'
        };

        // Define query logic
        var tasks = [
            function findVehicles(callback){
                console.log('Mongoose filterParams:');
                console.log(filterParams);
                console.log('Mongoose paginateOptions:');
                console.log(paginateOptions);

                VehicleModel.paginate(filterParams, paginateOptions, function(err, mongoResult){
                    if(err){
                        errStr = 'Error querying MongoDB';
                        resultStatus = 500;
                        resultJSON = { error: errStr };
                        console.log(errStr);
                        console.log(err);
                        callback(new Error(errStr));
                        return;
                    }

                    console.log('Mongoose result:');
                    console.log(mongoResult);

                    resultStatus = 200;
                    for(var pn in resultParams){
                        resultJSON[resultParams[pn]] = mongoResult[pn];
                    }
                    
                    callback(null);
                });
            }
        ];

        // Perform query and send response
        // FIXME: async.series() is really overkill here since there's only one function to run.
        async.series(tasks, function finalizer(/*err*/ /*, results*/){
            if(null == resultStatus){
                res.status(200);
            } else {
                res.status(resultStatus);
            }

            console.log('Result Status: ' + resultStatus);
            console.log('Result JSON:');
            console.log(resultJSON);

            res.json(resultJSON);
            console.log('------------------------------------------------------------------');
        });
        
        
    });

    // ----------------------------------------------
    // Get a list of distinct values for a given column.
    //
    router.get('/vehicles/propertyDistinct/:colName', function(req, res) {
        // Check that the column exists, otherwise MongoDB will just seek through all records.
        // Could probably ask this from the Mongoose model/schema too
        if(! metadata.vehicles.columns[req.params.colName]){
            res.status(404);
            res.json({ 'message': 'Error: column not found' });
            return;
        }

        // Do it
        VehicleModel.distinct(req.params.colName, function(err, docs){
            if(err){
                var errStr = 'Error querying MongoDB';
                resultStatus = 500;
                resultJSON = { error: errStr };
                console.log(errStr);
                console.log(err);
                return;
            }
            res.status(200);
            res.json(docs);
        });
    });



    // ----------------------------------------------
    // Statistics - TODO: set long cache time
    router.get('/vehicles/aggregate', function(req, res) {
        console.log('GET /vehicles/aggregate');
        //logger.debug('Router for /vehicles/aggregate');
        // 
    });

    // ----------------------------------------------
    // Properties of single vehicle
    // http://localhost:3000/api/v1.0/vehicles/5740d30bfa5bd80d9538a977/properties
    router.get('/vehicles/:vehicleID/properties', function(req, res) {
        console.log('GET /vehicle/:vehicleID/properties');
        // Variables
        var vehicleID = req.params.vehicleID;
        var vehicleIDSafe = vehicleID; // FIXME: escape nastiness
        var resultStatus = null;
        var resultJSON = null;
        var errStr = null;
        //var state = {};

        //
        var getVehiclePropsTasks = [
            // Query MongoDB
            function findVehicle(cb){
                VehicleModel.find().where({'_id': vehicleID}).lean().exec(function getVehicles(err, vehicles){
                    // 500
                    if(err){
                        errStr = 'Error looking for vehicle: ' + vehicleIDSafe;
                        resultStatus = 500;
                        resultJSON = { error: errStr };
                        console.log(errStr);
                        console.log(err);
                        cb(new Error(errStr));
                        return;
                    }

                    // 404
                    if(vehicles.length == 0){
                        errStr = 'Vehicle not found: ' + vehicleIDSafe;
                        resultStatus = 404;
                        resultJSON = { error: errStr };
                        console.log(errStr);
                        cb(new Error(errStr));
                        return;
                    }

                    // Shouldn't happen
                    if(vehicles.length != 1){
                        errStr = 'Error looking for vehicle: ' + vehicleIDSafe + ', length: ' + vehicles.length;
                        resultStatus = 500;
                        resultJSON = { error: errStr };
                        console.log(errStr);
                        cb(new Error(errStr));
                        return;
                    }

                    // Found it
                    //state.vehicle = vehicles[0];
                    resultJSON = { vehicle: vehicles[0] };
                    console.log('Found vehicle ' + vehicleID);
                    cb(null);
                });
            }

            // Post-processing
            //function formResponse(cb){
            //    cb(null);
            //}
        ];

        //
        // FIXME: async.series() is really overkill here since there's only one function to run.
        async.series(getVehiclePropsTasks, function finalizer(err, results){
            if(null == resultStatus){
                res.status(200);
            } else {
                res.status(resultStatus);
            }
            res.json(resultJSON);

        });
        
    });

    // ----------------------------------------------
    // Something
    //router.put('/feeds/subscribe', stormpath.apiAuthenticationRequired, function(req, res) {
    //    //logger.debug('Router for /feeds');
    //});

    // ----------------------------------------------

    //app.use('/api/v1.0', router);

    return router;
};
