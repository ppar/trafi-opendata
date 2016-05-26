
/*
 * FIXME: Organize this using CommonJS, a civilized async system and/or some MVC
 *
 */

window.vehicleSearch = {};

/*
 * Map enum columns' keys to their values in given language
 */
window.vehicleSearch.translateEnum = function(columnName, key, language){
    // Not found (nor does it belong in) metadata, don't translate
    if(columnName == '_id'){
        return key;
    }

    // Pass through empty values and non-enum variables
    if(window.vehicleSearch.metadata.vehicles.columns[columnName].type != 'enum'){
        return key;
    }
    if(key === null || key == ''){
        return key;
    }

    if(window.vehicleSearch.metadata.vehicles.columns[columnName]['enumByKey'][key]){
        return window.vehicleSearch.metadata.vehicles.columns[columnName]['enumByKey'][key].name[language];
    }

    // Unknown
    //return columnName + ':' + key;
    return key;
};


/*
 * Return the vehicle with all enum values mapped
 */
window.vehicleSearch.translateVehicle = function(vehicle, language){
    var result = {};
    for(prop in vehicle){
        result[prop] = window.vehicleSearch.translateEnum(prop, vehicle[prop], language);
    }
    return result;
}

/*
 * Map column names to their human-readable labels in given language
 */
window.vehicleSearch.translateColumnName = function(columnName, language){
    if(columnName == '_id'){
        return '_id';
    }
    return window.vehicleSearch.metadata.vehicles.columns[columnName].name[language];
};


/*
 * Load metadata from the server and process it.
 */
window.vehicleSearch.initMetadata = function(callback){
    // Load columns.json
    jQuery.ajax('/js/columns.json', {
        dataType: 'json',
        success: function(data){

            window.vehicleSearch.columns = data.sort(function(a, b){
                if(a.presentationOrder > b.presentationOrder){ return 1; }
                if(a.presentationOrder < b.presentationOrder){ return -1; }
                return 0;
            });

            // Load metadata
            jQuery.ajax('/js/metadata.json', {
                dataType: 'json',
                success: function(data){
                    window.vehicleSearch.metadata = data;
                    
                    // Index the enum values for faster & easier lookups
                    for(col in window.vehicleSearch.metadata.vehicles.columns){
                        if(window.vehicleSearch.metadata.vehicles.columns[col].type == 'enum'){
                            var list = window.vehicleSearch.metadata.vehicles.columns[col]['enum'];
                            var dict = {};
                            for(i in list){
                                dict[list[i].key] = list[i];
                            }
                            window.vehicleSearch.metadata.vehicles.columns[col]['enumByKey'] = dict;
                        }
                    }

                    //
                    callback();
                }
            });
        }
    });
};


/*
 * Initialize the search UI
 */
window.vehicleSearch.initSearch = function(callback){
/**
    jQuery('#search_ui').queryBuilder({
        filters: {

        }
    });
**/

    callback();
};


/*
 * Initialize the bs_grid datagrid view
 */
window.vehicleSearch.initGrid = function(callback){

    var bsGridOptions = {
        ajaxFetchDataURL: "/api/v1.0/vehicles/listPaged",
        ajaxMethod: "GET",

        ajaxRequestHandler: function(rq) {
            var newRequest = {
                page: rq.page_num,
                limit: rq.rows_per_page,
                resultParamDocs: 'page_data',
                resultParamTotal: 'total_rows'
            };
            return newRequest;
        },

        ajaxResponseHandler: function(response) {
            response.error = null;
            response.debug_message = [];
            response.filter_error = [];

            for(row in response.page_data){
                response.page_data[row] =
                    window.vehicleSearch.translateVehicle(response.page_data[row], 'en');
            }

            return response;
        },

        row_primary_key: "_id",

        useFilters: false,
        rowSelectionMode: false,
        showSortingIndicator: true,
        showSortingMenuButton: false,
        useSortableLists: false,
        
        columns: []

        /***
        sorting: [
            {sortingName: "Code", field: "customer_id", order: "none"},
            {sortingName: "Lastname", field: "lastname", order: "ascending"},
            {sortingName: "Firstname", field: "firstname", order: "ascending"},
            {sortingName: "Date updated", field: "date_updated", order: "none"}
        ],
        ****/

    };
 
    // Define the list of columns
    // FIXME: list of visible columns should be a model and generate events
    for(c in window.vehicleSearch.columns){
        var col = window.vehicleSearch.columns[c];

        bsGridOptions.columns.push({
            field: col.columnName,
            header: window.vehicleSearch.translateColumnName(col.columnName, 'en'),
            // It only takes 'yes' for an answer...
            visible: (col.defaultVisibility ? 'yes' : false)
        });
    }

    //
    jQuery("#vehicle_table").bs_grid(bsGridOptions);

    callback();
};

/*
 *
 */
jQuery(document).ready(function(){
    window.vehicleSearch.initMetadata(function(){
        window.vehicleSearch.initSearch(function(){
            window.vehicleSearch.initGrid(function() {} );
        });
    });
});
