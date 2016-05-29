// == Modules ================================
var mysql             = require('mysql');
var async             = require('async');

// == State ==================================
var mysqlConn         = null;
var metadata          = null;

// == Initialization =========================
exports.init = function(_metadata, dbConfig){
    metadata = _metadata;

    mysqlConn = mysql.createConnection(dbConfig.mysql);
    mysqlConn.connect();
};

// == Subroutines ============================

// Turn the 'find' JSON object from the API call into an SQL WHERE clause
filterParamsToWhereClause = function(filterParams){

    if(!filterParams || !filterParams['ru'] || !filterParams['ru'].length){
        return '';
    }

    // Recursive function 
    function _getWhereClause(sql, query){
        if(query['co'] && query['ru']){
            // Branch: 
            // Iterate an array of rules that are joined in a single "AND" or "OR" clause
            var comparison = query['co'];   // "AND" or "OR"
            var rules      = query['ru'];   // [] of rule objects

            // Get parenthesized sub-clause
            var subSql = '';
            for(i in rules){
                if(i > 0){
                    subSql += ' ' + comparison + ' ';
                }
                subSql += _getWhereClause(sql, rules[i]);
            }
            return sql + ' (' + subSql + ') ';

        } else {
            // Leaf: 
            // Return a single comparison operation
            var column   = query['c'];
            var operator = query['o'];
            var value    = query['v'];

            // Map API operators to SQL operators
            var operMap = {
                'equal':              '=',
                'not_equal':          '<>',

                'less':               '<',
                'less_or_equal':      '<=',

                'greater':            '>',
                'greater_or_equal':   '>='

            };

            if(operMap[operator]){
                // Return something like:  `model` = 'Testarossa', 
                return mysql.format('?? ' + operMap[operator] + ' ? ', [column, value]);

            } else {
                switch(operator){
                    case 'in':
                        return mysql.format('?? IN (?) ', [column, value]);

                    case 'not_in':
                        return mysql.format('?? NOT IN (?) ', [column, value]);
                    
                    case 'between':
                        return mysql.format('(?? >= ? AND ?? <= ?) ', [column, value[0], column, value[1]]);

                    case 'not_between':
                        return mysql.format('NOT (?? >= ? AND ?? <= ?) ', [column, value[0], column, value[1]]);

                    case 'begins_with':
                        // return  mysql.escapeId(column) + ' LIKE \'' + mysql.escape(value).replace(/^\'/, '').replace(/\'$/, '') + '%\' ';
                        // return  mysql.escapeId(column) + ' LIKE \'' + mysql.escape(value + '%').replace(/^\'/, '').replace(/\'$/, '') + '\' ';
                        return mysql.format('?? LIKE ?', [column, value + '%']);

                    case 'not_begins_with':
                        return mysql.format('?? NOT LIKE ?', [column, value + '%']);

                    case 'contains':
                        return mysql.format('?? LIKE ?', [column, '%' + value + '%']);

                    case 'not_contains':
                        return mysql.format('?? NOT LIKE ?', [column, '%' + value + '%']);

                    case 'ends_with':
                        return mysql.format('?? LIKE ?', [column, '%' + value]);

                    case 'not_ends_with':
                        return mysql.format('?? NOT LIKE ?', [column, '%' + value]);

                    // Are these applicable to number fields? Dates? 
                    case 'is_empty':
                        return mysql.format('?? = \'\' ', [column]);
                        break;

                    case 'is_not_empty':
                        return mysql.format('?? <> \'\' ', [column]);
                        break;

                    case 'is_null':
                        return mysql.format('?? IS NULL ', [column]);
                        break;
                    
                    case 'is_not_null': 
                        return mysql.format('?? IS NOT NULL ', [column]);
                        break;
                }

                // FAIL!
                throw new Error('Unknown opertor');
            }
        }
    }
    
    return 'WHERE ' + _getWhereClause('', filterParams);
};

// == API handler ============================
exports.setApiRoutes = function(app, apiRouter){

    // ----------------------------------------------

    // Hide <colName>_UPPER fields from query results.
    var vehicleProjection = []
    
    for(var colName in metadata.vehicles.columns){        
        if(!colName.endsWith('_UPPER')){
            vehicleProjection.push(colName);
        }
    }
    
        
    // ----------------------------------------------
    // List all vehicles, paged
    // 
    // GET parameters:
    //    page:               Number of page to return (default 1)
    //    limit:              Number of items per page (default 10)
    //    find:               Search parameters as a JSON-serialized object
    //                        (default {} -- return all records}
    //
    //    resultParamDocs:    Override the name of the 'docs'  property in the response JSON
    //    resultParamTotal:   Override the name of the 'total' property in the response JSON
    //    resultParamLimit:   Override the name of the 'limit' property in the response JSON
    //    resultParamPage:    Override the name of the 'page'  property in the response JSON
    //    resultParamPages:   Override the name of the 'pages' property in the response JSON
    //
    // Format of 'find' parameterer:  http://querybuilder.js.org/demo.html
    // 
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
    apiRouter.get('/vehicles/listPaged', function(req, res) {
        console.log('== GET /vehicles/listPaged ===============================');
        console.log('HTTP query params:');
        console.log(req.query);
        
        // Parameters from API call
        var filterParams = null;
        if(req.query.find){
            filterParams = JSON.parse(req.query.find);
        }

        var paginateOptions = {
            page: parseInt(req.query.page)   || 1,
            limit: parseInt(req.query.limit) || 10
        };
        paginateOptions.offset = paginateOptions.limit * (paginateOptions.page - 1);
        
        // Names of properties used in the JSON response. 
        var resultParams = {
            'docs':   req.query.resultParamDocs  || 'docs',
            'total':  req.query.resultParamTotal || 'total',
            'limit':  req.query.resultParamLimit || 'limit',
            'page':   req.query.resultParamPage  || 'page',
            'pages':  req.query.resultParamPages || 'pages'
        };

        // Debug
        console.log('filterParams:');
        console.log(filterParams);
        console.log('paginateOptions:');
        console.log(paginateOptions);

        // Build SQL queries
        var sqlWhere = filterParamsToWhereClause(filterParams);

        var sqlCountQuery = 'SELECT COUNT(*) AS c FROM vehicle ' + sqlWhere;

        var sqlRowQuery   = mysql.format('SELECT ?? FROM vehicle ', [vehicleProjection]) 
            + sqlWhere 
            + mysql.format('ORDER BY ? ASC LIMIT ? OFFSET ?', ['id', paginateOptions.limit, paginateOptions.offset]);
        
        // Results
        var resultJSON = {};
        var resultStatus = null;

        // Define sync tasks
        var tasks = [
            function countQuery(callback){
                //
                // FIXME: catch and handle errors from the API instead of crashing
                //
                // /Users/pfp/Code/trafi-opendata/json-api/node_modules/mysql/lib/protocol/Parser.js:77
                //         throw err; // Rethrow non-MySQL errors
                //         ^
                //
                // Error: Can't set headers after they are sent.
                //     at ServerResponse.OutgoingMessage.setHeader (_http_outgoing.js:335:11)
                //     at ServerResponse.header (/Users/pfp/Code/trafi-opendata/json-api/node_modules/express/lib/response.js:718:10)
                //     at ServerResponse.send (/Users/pfp/Code/trafi-opendata/json-api/node_modules/express/lib/response.js:163:12)
                //     at ServerResponse.json (/Users/pfp/Code/trafi-opendata/json-api/node_modules/express/lib/response.js:249:15)
                //     at finalizer (/Users/pfp/Code/trafi-opendata/json-api/app/mysqlBackend.js:214:17)
                //     at /Users/pfp/Code/trafi-opendata/json-api/node_modules/async/dist/async.js:5221:13
                //     at /Users/pfp/Code/trafi-opendata/json-api/node_modules/async/dist/async.js:399:20
                //     at /Users/pfp/Code/trafi-opendata/json-api/node_modules/async/dist/async.js:876:29
                //     at /Users/pfp/Code/trafi-opendata/json-api/node_modules/async/dist/async.js:842:20
                //     at /Users/pfp/Code/trafi-opendata/json-api/node_modules/async/dist/async.js:5218:17
                //
                console.log('SENDING QUERY: ' + sqlCountQuery);
                mysqlConn.query(sqlCountQuery, function(mysqlError, mysqlResult, mysqlFields){
                    console.log('QUERY COMPLETE');
                    if(mysqlError){
                        var errStr = 'Error querying MySQL row count';
                        console.log(errStr);
                        console.log(mysqlError);
                        resultStatus = 500;
                        res.json({ error: errStr });
                        callback(new Error(errStr));
                        return;
                    }
                    var count = parseInt(mysqlResult[0]['c']);
                    resultJSON[resultParams['total']] =  count;
                    resultJSON[resultParams['pages']] =  Math.ceil(count / paginateOptions.page);
                    callback(null);
                });
            },

            function rowQuery(callback){
                //
                // FIXME: catch and handle errors from the API instead of crashing
                //
                console.log('SENDING QUERY: ' + sqlRowQuery);
                mysqlConn.query(sqlRowQuery, function(mysqlError, mysqlResult, mysqlFields){
                    console.log('QUERY COMPLETE');
                    if(mysqlError){
                        var errStr = 'Error querying MySQ data';
                        console.log(errStr);
                        console.log(mysqlError);
                        resultStatus = 500;
                        res.json({ error: errStr });
                        callback(new Error(errStr));
                        return;
                    }                    
                    resultJSON[resultParams['docs']]  =  mysqlResult;
                    resultJSON[resultParams['limit']] =  paginateOptions.limit;
                    resultJSON[resultParams['page']]  =  paginateOptions.page;
                    callback(null);
                });
            }
        ];
        
        // Run tasks
        async.series(tasks, function finalizer(err, results){
            if(null == resultStatus){
                res.status(200);
            } else {
                res.status(resultStatus);
            }
            res.json(resultJSON);
            console.log('------------------------------------------------------------------');
        });
    });


    // ----------------------------------------------
    // Get a list of distinct values for a given column.
    //
    apiRouter.get('/vehicles/propertyDistinct/:colName', function(req, res) {        
        // Check that the column exists, otherwise MongoDB will just seek through all records.
        // Could probably ask this from the Mongoose model/schema too
        if(! metadata.vehicles.columns[req.params.colName]){
            res.status(404);
            res.json({ 'message': 'Error: column not found' });
            return;
        }

        // Do it
        /**
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
            });***/

        res.status(200);
        res.json({});
    });


    /*************

    // ----------------------------------------------
    // Statistics - TODO: set long cache time
    apiRouter.get('/vehicles/aggregate', function(req, res) {
        console.log('GET /vehicles/aggregate');
        //logger.debug('Router for /vehicles/aggregate');
        // 
    });

    // ----------------------------------------------
    // Properties of single vehicle
    // http://localhost:3000/api/v1.0/vehicles/5740d30bfa5bd80d9538a977/properties
    apiRouter.get('/vehicles/:vehicleID/properties', function(req, res) {
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
    ******************/
    
    // ----------------------------------------------
    // Something
    //apiRouter.put('/feeds/subscribe', stormpath.apiAuthenticationRequired, function(req, res) {
    //    //logger.debug('Router for /feeds');
    //});

    // ----------------------------------------------

    //app.use('/api/v1.0', router);

    return apiRouter;
};
