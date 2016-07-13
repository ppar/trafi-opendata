/**
 * MySQL Backend module
 *
 * @module   app/mysqlBackend
 */

// Modules
var mysql             = require('mysql');
var async             = require('async');
var logger            = require('./logger');

// Configuration & state
var metadata          = require('../../metadata');
var dbConfig          = require('../config/db');
var mysqlConn         = null;
var apiCalls          = {};

/**
 * Initialization function
 *
 * Connects to the MySQL database specified in dbConfig
 */
exports.init = function(){
    mysqlConn = mysql.createConnection(dbConfig.mysql);
    mysqlConn.connect();
};

/**
 * Map handler functions to the API router
 *
 * @param  {object} router   - Express Router object
 * @return {object} The passed router object, with route handlers attached
 */
exports.setRoutes = function(router){
    router.get('/vehicles/:vehicleID/properties', apiCalls.vehicleProperties);
    router.get('/vehicles/list', apiCalls.list);
    router.get('/vehicles/propertyDistinct/:colName', apiCalls.propertyDistinct);
    router.get('/vehicles/aggregate', apiCalls.aggregate);

    return router;
};


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
    //logger.logVariable('findObjectToWhereClause(): find', find);

    if(!find || !find['ru'] || !find['ru'].length){
        //console.log('findObjectToWhereClause(): empty parameters')
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

                // FAIL
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
 * Example:http://localhost:3000/api/v1.0/vehicles/12345/properties
 *
 * The method's 'req' and 'res' parameters are the Request and Response objects
 * passed by the Express Router.
 *
 * @param {string}  params.vehicleID     - ID of the vehicle, passed in the HTTP GET 
 *                                         request's last path component
 */
apiCalls.vehicleProperties = function(req, res) {
    // Variables
    var vehicleID = req.params.vehicleID;
    console.log('vehicleProperties(' + vehicleId + ')');

    // Query
    var sqlQuery = mysql.format('SELECT * FROM ?? WHERE id = ?', ['vehicle', vehicleId]);
    mysqlConn.query(sqlQuery, function(mysqlError, mysqlResult, mysqlFields){

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
 * in format selected by 'format'; split into pages of 'limit' records each and 
 * limited to records on page number 'page' (starting from 1).
 *
 * If the number of records matched by 'find' is lower than the page selection,
 * page 1 is returned instead. The JSON response contains the actual returned page
 * number.
 *
 * Parameters described below refer to HTTP GET variables under req.request[]
 *
 * The method's 'req' and 'res' parameters are the Request and Response objects
 * passed by the Express Router.
 * 
 * @param  {object}  find      - Search parameters as a JSON-serialized object. 
 *                               Default: {} -- return all records 
 *                               Format: @see findObjectToWhereClause 
 * @param  {object}  sort      - Sort order; [ { c: 'merkkiSelvakielinen', d: 'ASC'}, { c: 'korityyppi', d: 'DESC' }, ... ]
 * @param  {int}     page      - Number of page to return (default 1)
 * @param  {int}     limit     - Number of items per page (default 10)
 * @param  {object}  columns   - List of columns to return the result. Default: all
 * @param  {string}  format    - Format of the response
 *
 * @param  {string}  respDocs  - Override the name of the 'docs'  property in the response JSON
 * @param  {string}  respTotal - Override the name of the 'total' property in the response JSON
 * @param  {string}  respLimit - Override the name of the 'limit' property in the response JSON
 * @param  {string}  respPage  - Override the name of the 'page'  property in the response JSON
 * @param  {string}  respPages - Override the name of the 'pages' property in the response JSON
 * @param  {string}  respFull  - Override the name of the 'full'  property in the response JSON
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
 * - 'pages' the number of pages matching this query,
 * - 'page' the number of the returned page in 'docs', and 
 * - 'full' the total number of vehicles in the database.
 */

apiCalls.list = function(req, res) {
    console.log('list()');
    logger.logVariable('list()', req.query);

    // Pagination options
    var page  = parseInt(req.query.page)  || 1;
    var limit = parseInt(req.query.limit) || 10;
    
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

    // WHERE clause
    var sqlWhere = (req.query.find
                    ? findObjectToWhereClause(typeof req.query.find == 'string'
                                              ? JSON.parse(req.query.find)
                                              : req.query.find) + ' '
                    : '');

    // Results
    var resultJSON = {};
    var resultStatus = null;
    // Cheap optimization, since our table is R/O
    resultJSON[resultParams['full']] = dbConfig.totalVehicles;

    // Define sync tasks
    var tasks = [];

    // Query the total number of rows matched by the 'find' parameter
    tasks.push(function countQuery(callback){
        var sqlCountQuery = 'SELECT COUNT(*) AS c FROM vehicle ' + sqlWhere;
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
            resultJSON[resultParams['pages']] =  Math.ceil(count / limit);
            callback(null);
        });
    });

    // Retrieve the requested rows
    tasks.push(function rowQuery(callback){
        // The user may have asked for a page number higher than is found 
        // in the result set. Reset to page 1 in that case.
        var offset = limit * (page - 1);
        if(offset > resultJSON[resultParams['total']]){
            page = 1;
            offset = 0;
        }

        var sqlRowQuery = 
            mysql.format('SELECT ?? FROM vehicle ', [vehicleProjection])
            + sqlWhere
            + (req.query.sort 
               ? sortObjectToOrderClause(typeof req.query.sort == 'string'
                                         ? JSON.parse(req.query.sort) 
                                         : req.query.sort) + ' '
               : '')
            + mysql.format('LIMIT ? OFFSET ?', [limit, offset]);

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
            resultJSON[resultParams['limit']] =  limit;
            resultJSON[resultParams['page']]  =  page;
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
    });
};


/**
 * API Call: Get a list of distinct values for a given column.
 *
 * Returns a list of distinct values in a given column, optionally restricting the
 * query to rows matched by the 'find' parameter.
 *
 *
 * @param  {object}  req.query.find      - Parameter "find" in the HTTP GET request. Search parameters 
 *                                         as a JSON-serialized object. Only values from rows matching 
 *                                         this parameter are returned. Default: {} -- all records.
 *                                         Format: @see findObjectToWhereClause
 *
 * @param  {string}  req.params.colName  - Name of the column, passed as the last path component in the  
 *                                         HTTP GET request (/vehicles/propertyDistinct/:colName)
 *
 * @return {object}  List of distinct values in column colName
 */
apiCalls.propertyDistinct = function(req, res) {
    console.log('propertyDistinct(' + req.params.colName + ')');

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
    
    mysqlConn.query(sqlQuery, function(mysqlError, mysqlResult, mysqlFields){
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
 * Statistics - TODO
 */
apiCalls.aggregate = function(req, res) {
    console.log('GET /vehicles/aggregate');
};


