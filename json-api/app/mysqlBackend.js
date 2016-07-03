/**
 * MySQL Backend module
 *
 * @module   app/mysqlBackend
 * @see      module:app/routes
 */

// == Modules ================================
var mysql             = require('mysql');
var async             = require('async');
var apiCalls          = {};

// == State ==================================
var mysqlConn         = null;
var metadata          = require('../../metadata');
var dbConfig          = null;

/**
 * Initialization function
 *
 * Connects to the MySQL database specified in dbConfig
 *
 * @param {object}    dbConfig   Database configuratio object from config/db.js.
 */
exports.init = function(_dbConfig){
    dbConfig = _dbConfig;
    mysqlConn = mysql.createConnection(dbConfig.mysql);
    mysqlConn.connect();
};

/**
 * Dump a variable using console.log()
 */
logVariable = function(message, variable){
    console.log('--- ' + message + ' ---- ' + typeof variable + ' -----------------------------');
    console.log(variable)
    console.log('--- /' + message + ' ------------------------------------------');
    console.log();
}

/**
 * Generate an SQL WHERE clause from the 'find' JSON object
 *
 * @param  {object} find - An object containing query parameters. 
 *                         The syntax is an abbreviated form of 
 *                         http://querybuilder.js.org/demo.html
 *
 * @return {string} An SQL query string starting with 'WHERE '
 *                  and containing one or more SQL comparison 
 *                  statements, or an empty string if no parameters
 *                  were passed.
 */
findObjectToWhereClause = function(find){
    logVariable('findObjectToWhereClause(): find', find);

    if(!find || !find['ru'] || !find['ru'].length){
        console.log('findObjectToWhereClause(): empty parameters')
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
                throw new Error('Unknown operator');
            }
        }
    }
    
    return 'WHERE ' + _getWhereClause('', find);
};

/**
 * Generate an SQL ORDER BY clause from the passed 'sort' object
 *
 * [ { c: 'merkkiSelvakielinen', d: 'ASC'}, { c: 'korityyppi', d: 'descending' }, ... ]
 *
 * @param {object}   sort  - An array of objects with property 'c' defining the column name, 
 *                           'd' the sort order <asc|ascending|desc|descending>, and the order of
 *                           objects the columns' precedence
 * @return {string}  Either '' or a string like 'ORDER BY [colname] [ASC|DESC], .... '
 */
sortObjectToOrderClause = function(sort){
    if(!sort || !(sort instanceof Array)){
        return '';
    }

    var result = 'ORDER BY ';
    var params = [];
    for(i in sort){
        result += '?? ' + (sort[i].d ? (sort[i].d.match(/^asc/i) ? 'ASC' : (sort[i].d.match(/^desc/i) ? 'DESC' : '')) : '') + ', ';
        params.push(sort[i].c);
    }
    result = result.replace(/, $/, '');

    // Escape MySQL identifier names
    return mysql.format(result, params);
};


/**
 * API Call: Get properties of single vehicle
 *
 * Example:
 * http://localhost:3000/api/v1.0/vehicles/5740d30bfa5bd80d9538a977/properties
 *
 * @param {object}  req                      - Request object passed by the Express Router
 * @param {object}  res                      - Result object passed by the Express Router
 * @param {string}  req.params.vehicleID     - ID of the vehicle
 */
apiCalls.vehicleProperties = function(req, res) {
    console.log('== GET /vehicles/:vehicleID/properties ==============================');
    // Variables
    var vehicleID = req.params.vehicleID;

    // Query
    var sqlQuery = mysql.format('SELECT * FROM ?? WHERE id = ?', ['vehicle', vehicleId]);
    mysqlConn.query(sqlQuery, function(mysqlError, mysqlResult, mysqlFields){
        console.log('QUERY COMPLETE: ' + sqlQuery);

        // 500
        if(mysqlError){
            console.log(mysqlError);
            res.status(500);
            res.json({ error: 'Database error' });
            return;
        }                    

        // 404
        if(mysqlResult.length == 0){
            res.status(404)
            res.json({ error: 'Vehicle not found' });
            return;
        }

        // 500 - Shouldn't happen
        if(mysqlResult.length != 1){
            res.status(500)
            res.json({ error: 'Database error (L=' + mysqlResult.length + ')'});
            return;
        }
        
        // 200 - Found it
        res.status(200);
        res.json({ vehicle: mysqlResult[0] });
    });    
}


/**
 * API Call: Return a listing of vehicles matching search criteria
 * 
 * Returns a listing of vehicles from the database; matching criteria in 'find';
 * in format selected by 'format'; optionally limited to page number 'page' when
 * split into pages of 'limit' records.
 * 
 *
 * 
 * @param  {object}  req                 - Request object passed by the Express Router
 * @param  {object}  res                 - Result object passed by the Express Router
 *
 * @param  {object}  req.query.find      - Search parameters as a JSON-serialized object. 
 *                                         Default: {} -- return all records 
 *                                         Format: @see findObjectToWhereClause 
 * @param  {object}  req.query.sort      - Sort order; [ { c: 'merkkiSelvakielinen', d: 'ASC'}, { c: 'korityyppi', d: 'DESC' }, ... ]
 * @param  {int}     req.query.page      - Number of page to return (default 1)
 * @param  {int}     req.query.limit     - Number of items per page (default 10)
 * @param  {object}  req.query.columns   - List of columns to return the result. Default: all
 * @param  {string}  req.query.format    - Format of the response
 *
 * @param  {string}  req.query.respDocs  - Override the name of the 'docs'  property in the response JSON
 * @param  {string}  req.query.respTotal - Override the name of the 'total' property in the response JSON
 * @param  {string}  req.query.respLimit - Override the name of the 'limit' property in the response JSON
 * @param  {string}  req.query.respPage  - Override the name of the 'page'  property in the response JSON
 * @param  {string}  req.query.respPages - Override the name of the 'pages' property in the response JSON
 * @param  {string}  req.query.respFull  - Override the name of the 'full'  property in the response JSON
 *    
 * @return {object|string} 
 * 
 * Result format:
 *
 *  {
 *     "docs": [
 *         {
 *             "_id": "5740d30bfa5bd80d9538a977",
 *             "vaihteisto": "",
 *             "kayttoonottopvm": "19670000",
 *             "versio": "",
 *                 ....
 *         },
 *         {
 *                 .....
 *         }
 *     ],
 *     total: 5017436,
 *     full: 5017436,
 *     limit: 10,
 *     page: 1,
 *     pages: 501744
 *  }
 * 
 * Where 
 * - 'docs' is an array of vehicles objects, 
 * - 'total' the number of vehicles matching the 'find' parameter,
 * - 'limit' the number of records requested per page,
 * - 'pages' the number of pages matchind this query,
 * - 'page' the number of the returned page in 'docs', and 
 * - 'full' the total number of vehicles in the database.
 */

apiCalls.list = function(req, res) {
    console.log('== GET /vehicles/list ===============================');
    logVariable('list(): req.query', req.query);

    // Parameters from API call
    var paginateOptions = {
        page: parseInt(req.query.page)   || 1,
        limit: parseInt(req.query.limit) || 10
    };
    paginateOptions.offset = paginateOptions.limit * (paginateOptions.page - 1);
    
    // Names of properties used in the JSON response. 
    var resultParams = {
        'docs':   req.query.respDocs  || 'docs',
        'total':  req.query.respTotal || 'total',
        'full':   req.query.respFull  || 'full',
        'limit':  req.query.respLimit || 'limit',
        'page':   req.query.respPage  || 'page',
        'pages':  req.query.respPages || 'pages'
    };
    
    // Build SQL queries
    var vehicleProjection = ['id']
    if(req.query.columns){
        // Sanity check
        var columns = JSON.parse(req.query.columns);
        for(i in columns){
            if(metadata.vehicles.columns[columns[i]]){
                vehicleProjection.push(columns[i]);
            } else {
                // 400 Bad Request
                res.status(400);
                res.json({ error: 'Invalid column(s)' });
                return;
            }
        }
    } else {
        // Hide <colName>_UPPER fields from query results by default
        for(var colName in metadata.vehicles.columns){
            if(!colName.endsWith('_UPPER')){
                vehicleProjection.push(colName);
            }
        }
    }

    var sqlWhere      = (req.query.find ? findObjectToWhereClause(typeof req.query.find == 'string' ? JSON.parse(req.query.find) : req.query.find) : '');
    var sqlOrder      = (req.query.sort ? sortObjectToOrderClause(typeof req.query.sort == 'string' ? JSON.parse(req.query.sort) : req.query.sort) : '');
    var sqlLimit      = mysql.format('LIMIT ? OFFSET ?', [paginateOptions.limit, paginateOptions.offset]);

    var sqlCountQuery = 'SELECT COUNT(*) AS c FROM vehicle ' + sqlWhere;
    var sqlRowQuery   = mysql.format('SELECT ?? FROM vehicle ', [vehicleProjection]) + ' ' + sqlWhere + ' ' + sqlOrder + ' ' + sqlLimit;

    logVariable('sqlRowQuery', sqlRowQuery);

    // Results
    var resultJSON = {};
    var resultStatus = null;

    resultJSON[resultParams['full']] = dbConfig.totalVehicles;

    // Define sync tasks
    var tasks = [];
    tasks.push(function countQuery(callback){
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
        mysqlConn.query(sqlCountQuery, function(mysqlError, mysqlResult, mysqlFields){
            if(mysqlError){
                console.log(sqlCountQuery);
                console.log(mysqlError);
                resultStatus = 500;
                res.json({ error: 'Database Error' });
                callback(new Error('Database Error'));
                return;
            }
            var count = parseInt(mysqlResult[0]['c']);
            resultJSON[resultParams['total']] =  count;
            resultJSON[resultParams['pages']] =  Math.ceil(count / paginateOptions.page);
            callback(null);
        });
    });

    tasks.push(function rowQuery(callback){
        //
        // FIXME: catch and handle errors from the API instead of crashing
        //
        mysqlConn.query(sqlRowQuery, function(mysqlError, mysqlResult, mysqlFields){
            if(mysqlError){
                console.log(sqlRowQuery);
                console.log(mysqlError);
                resultStatus = 500;
                res.json({ error: 'Database Error' });
                callback(new Error('Database Error'));
                return;
            }                    
            resultJSON[resultParams['docs']]  =  mysqlResult;
            resultJSON[resultParams['limit']] =  paginateOptions.limit;
            resultJSON[resultParams['page']]  =  paginateOptions.page;
            callback(null);
        });
    });
    
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
};


/**
 * API Call: Get a list of distinct values for a given column.
 *
 * Returns a list of distinct values in a given column, optionally restricting the
 * query to rows matched by the 'find' parameter.
 *
 * @param  {object}  req                 - Request object passed by the Express Router
 * @param  {object}  res                 - Result object passed by the Express Router
 * @param  {object}  req.query.find      - Search parameters as a JSON-serialized object. 
 *                                         Only values from rows matching this parameter are
 *                                         returned. Default: {} -- all records 
 *                                         Format: @see findObjectToWhereClause
 * @param  {string}  req.params.colName  - Name of the column
 *
 * @return {object}  List of distinct values in column colName
 */
apiCalls.propertyDistinct = function(req, res) {
    console.log('== GET /vehicles/propertyDistinct/:colName ==============================');

    // Check that the column exists
    if(! metadata.vehicles.columns[req.params.colName]){
        res.status(404);
        res.json({ 'error': 'Column not found' });
        return;
    }

    // TODO: could optimize by returning ENUM columns' values from the schema, 
    // though this would return inexistent values too

    // Query
    var sqlQuery = mysql.format('SELECT DISTINCT ?? AS col FROM ?? ', [req.params.colName, 'vehicle']) 
        + findObjectToWhereClause(req.query.find)
        + ' ORDER BY col ASC';
    
    console.log('propertyDistinct: SQL: ' + sqlQuery);

    mysqlConn.query(sqlQuery, function(mysqlError, mysqlResult, mysqlFields){
        console.log('QUERY COMPLETE: ' + sqlQuery);

        // 500
        if(mysqlError){
            res.status(500);
            res.json({ error: 'Database error' });
            return;
        }
        
        // 200 - Found it
        var result = [];
        for(i in mysqlResult){
            result.push(mysqlResult[i]['col']);
        }
        res.status(200);
        res.json(result);
    });    
}


/**
 * Statistics - TODO: set long cache time
 */
apiCalls.aggregate = function(req, res) {
    console.log('== GET /vehicles/aggregate ==============================');
};


/**
 * Map handler functions to the API router 
 * 
 * @param  {object} app        - Express App object
 * @param  {object} apiRouter  - Express Router object
 *
 * @return {object} The passed apiRouter object, with route handlers attached
 */
exports.setApiRoutes = function(app, apiRouter){
    apiRouter.get('/vehicles/:vehicleID/properties', apiCalls.vehicleProperties);

    apiRouter.get('/vehicles/list', apiCalls.list);
    apiRouter.get('/vehicles/propertyDistinct/:colName', apiCalls.propertyDistinct);
    apiRouter.get('/vehicles/aggregate', apiCalls.aggregate);

    return apiRouter;
};
