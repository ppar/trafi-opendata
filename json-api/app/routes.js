console.log('routes.js: starting');

// == Modules ==================
var express = require('express');
var validator = require('validator');
var async = require('async');
//var mongoosePaginate = require('mongoose-paginate');

//var logger = require('../logger');
//var security = require('../config/security');

// == Schema  ==================
// TODO: correct data types
function _getVehicleSchema(){
    var fields = ['ajoneuvoluokka',
                  'ensirekisterointipvm',
                  'ajoneuvoryhma',
                  'ajoneuvonkaytto',
                  'variantti',
                  'versio',
                  'kayttoonottopvm',
                  'vari',
                  'ovienLukumaara',
                  'korityyppi',
                  'ohjaamotyyppi',
                  'istumapaikkojenLkm',
                  'omamassa',
                  'teknSuurSallKokmassa',
                  'tieliikSuurSallKokmassa',
                  'ajonKokPituus',
                  'ajonLeveys',
                  'ajonKorkeus',
                  'kayttovoima',
                  'iskutilavuus',
                  'suurinNettoteho',
                  'sylintereidenLkm',
                  'ahdin',
                  'sahkohybridi',
                  'merkkiSelvakielinen',
                  'mallimerkinta',
                  'vaihteisto',
                  'vaihteidenLkm',
                  'kaupallinenNimi',
                  'voimanvalJaTehostamistapa',
                  'tyyppihyvaksyntanro',
                  'yksittaisKayttovoima',
                  'kunta',
                  'Co2',
                  'matkamittarilukema',
                  'alue',
                  'valmistenumero2',
                  'jarnro'];

    var schema = {};
    for (f in fields){
        schema[fields[f]] = { type: String, trim: true };
    }

    console.log('_getSchema():');
    console.log(schema);

    return schema;
};


/*****
  { 
         active: Boolean,
         email: { type: String, trim: true, lowercase: true },
         firstName: { type: String, trim: true },
         created: { type: Date, default: Date.now },
         subs: { type: [mongoose.Schema.Types.ObjectId], default: [] },
  }

  {
         description: { type: String, trim:true },
         title: { type: String, trim:true },
         summary: { type: String, trim:true },
         state: { type: String, trim:true, lowercase:true, default: 'new' },

         created: { type: Date, default: Date.now },
         feedID: { type: mongoose.Schema.Types.ObjectId },
  }
******/


// == Initialize ===========================

exports.addAPIRouter = function(app, mongoose, mongoosePaginate) {
    //
    var router = express.Router();

    // ----------------------------------------------
    // Create schemas and models
    console.log('creating vehicleSchema');
    var vehicleSchema = new mongoose.Schema(_getVehicleSchema(), { collection: 'vehicles' } );
    vehicleSchema.plugin(mongoosePaginate);
    
    //vehicleSchema.index({email : 1}, {unique:true});
    //vehicleSchema.index({sp_api_key_id : 1}, {unique:true});
    //userFeedEntrySchema.index({userID : 1, feedID : 1, feedEntryID : 1, read : 1});
 
    console.log('creating vehicleModel');
    var VehicleModel = mongoose.model('Vehicle', vehicleSchema);

    // ----------------------------------------------
    // Defaults for all routes

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

    // ----------------------------------------------
    // Root path
    router.get('/', function(req, res){
        res.json({ message: 'API 1.0 operational' });
    });
    
    // ----------------------------------------------
    // List all vehicles, paged
    // 
    // GET parameters:
    //    page:               Number of page to return (default 1)
    //    limit:              Number of items per page (default 10)
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
    router.get('/vehicles/listPaged', function(req, res) {
        var paginateOptions = {
            page: req.query.page   || 1,
            limit: req.query.limit || 10
        };

        var resultParams = {
            'docs':   req.query.resultParamDocs  || 'docs',
            'total':  req.query.resultParamTotal || 'total',
            'limit':  req.query.resultParamLimit || 'limit',
            'page':   req.query.resultParamPage  || 'page',
            'pages':  req.query.resultParamPages || 'pages'
        };

        delete req.query.pageNumber;
        delete req.query.pageSize;

        delete req.query.resultParamDocs;
        delete req.query.resultParamTotal;
        delete req.query.resultParamLimit;
        delete req.query.resultParamPage;
        delete req.query.resultParamPages;

        //var filterParams = req.query;
        var filterParams = {};
        
        console.log('filterParams:');
        console.log(filterParams);
        
        var resultStatus = null;
        var resultJSON = {};
        var errStr = null;
        //var state = {};

        var tasks = [
            function findVehicles(cb){
                console.log('Querying MongoDB');
                VehicleModel.paginate(filterParams, paginateOptions, function(err, mongoResult){
                    console.log('Got response');
                    // 500
                    if(err){
                        errStr = 'Error querying MongoDB';
                        resultStatus = 500;
                        resultJSON = { error: errStr };
                        console.log(errStr);
                        console.log(err);
                        cb(new Error(errStr));
                        return;
                    }

                    console.log('Success, result size: ' + mongoResult.length);

                    resultStatus = 200;
                    
                    for(pn in resultParams){
                        resultJSON[resultParams[pn]] = mongoResult[pn];
                    }

                    cb(null);
                });
            }
        ];

        async.series(tasks, function finalizer(err, results){
            console.log('Finalizing request');
            if(null == resultStatus){
                res.status(200);
            } else {
                res.status(resultStatus);
            }
            res.json(resultJSON);
            console.log('resultJSON set');
        });
        
        
    });

    // ----------------------------------------------
    // Search
    router.get('/vehicles/search', function(req, res) {
        console.log('GET /vehicles/search');

        var resultStatus = null;
        var resultJSON = null;
        var errStr = null;
        //var state = {};

        var tasks = [
            function findVehicles(cb){
                // FIXME: Passing req.query directly to .find() might not be safe,
                // also, should do substring matches & other operators
                VehicleModel.find(req.query, function(err, docs){
                    assert.equal(null, err);
                    //assert.equal(10, docs.length);
                    resultJSON.vehicles = docs;
                });
                cb(null);
            }
        ];

        async.series(tasks, function finalizer(err, results){
            if(null == resultStatus){
                res.status(200);
            } else {
                res.status(resultStatus);
            }
            res.json(resultJSON);
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
    app.use('/api/v1.0', router);

};
