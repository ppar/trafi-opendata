// == Modules ================================
var mysql             = require('mysql');

// == State ==================================
var mysqlConn         = null;
var metadata          = null;

// == Initialization =========================
exports.init = function(_metadata, dbConfig){
    metadata = _metadata;

    mysqlConn = mysql.createConnection(dbConfig.mysql);
    mysqlConn.connect();
};

// == API handler ============================
exports.setApiRoutes = function(app, apiRouter){

    // Stub
    
    return apiRouter;
};
