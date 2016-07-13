/**
 * Dump a variable using console.log()
 */
exports.logVariable = function(message, variable){
    console.log('--- ' + message + ' ---- ' + typeof variable + ' -----------------------------');
    console.log(variable)
    console.log('--- /' + message + ' ------------------------------------------');
    console.log();
};
