/*
 * FIXME: Organize this using CommonJS, a civilized async system and/or some MVC
 *
 */

window.vehicleSearch = {};

/*
 * Map enum columns' keys to their values in given language
 */
window.vehicleSearch.translateEnum = function(columnName, key, language){
    // MongoDB _id column. Not found (nor does it belong) in metadata, don't translate
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

            // Load metadata.json
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
                    
                    // Load car makes
                    jQuery.ajax('/api/v1.0/vehicles/propertyDistinct/merkkiSelvakielinen_UPPER', {
                        dataType: 'json',
                        success: function(data){
                            vehicleSearch.distinctProperties = {};
                            vehicleSearch.distinctProperties['merkkiSelvakielinen_UPPER'] = data;

                            //
                            callback();
                        }
                    });
                }
            });
        }
    });
};


/*
 * Refresh method. Reads query parameters from the QueryBuilder widget
 * and tells GridView to update itself. 
 */
window.vehicleSearch.refresh = function() {

    // makeUpperCase = function(obj){
    //     for(var i in obj){
    //         if(typeof obj[i] == 'string' && i == '$regex'){
    //             obj[i] = obj[i].toUpperCase();
    //         }
    //         if(typeof obj[i] == 'object'){
    //             obj[i] = makeUpperCase(obj[i]);
    //         }
    //     }
    //     return obj;
    // };
    //
    // Get the query as a MongoDB query object
    //var qry = jQuery('#search_ui').queryBuilder('getMongo');
    //
    // Turn all text fields into uppercase.
    //window.vehicleSearch.mongoQuery = makeUpperCase(qry);


    // var qry = jQuery('#search_ui').queryBuilder('getRules');
    //
    //    {
    //        "condition": "AND",
    //        "rules": [
    //            {
    //                "id": "price",
    //                "field": "price",
    //                "type": "double",
    //                "input": "text",
    //                "operator": "less",
    //                "value": "10.25"
    //            },
    //            {
    //                "condition": "OR",
    //                "rules": [
    //                    {
    //                        "id": "category",
    //                        "field": "category",
    //                        "type": "integer",
    //                        "input": "select",
    //                        "operator": "equal",
    //                        "value": "2"
    //                    },
    //                    {
    //                        "id": "category",
    //                        "field": "category",
    //                        "type": "integer",
    //                        "input": "select",
    //                        "operator": "equal",
    //                        "value": "1"
    //                    }
    //                ]
    //            },
    //            {
    //                "id": "in_stock",
    //                "field": "in_stock",
    //                "type": "integer",
    //                "input": "radio",
    //                "operator": "equal",
    //                "value": "1"
    //            }
    //        ]
    //    }

    function scrubQuery(queryIn){

        if(queryIn['condition'] && queryIn['rules']){
            var queryOut = {
                co: queryIn['condition'],
                ru: []
            };

            for(i in queryIn['rules']){
                // Scrub rules reqursively
                queryOut['ru'][i] = scrubQuery(queryIn['rules'][i]);
            }

            return queryOut;

        } else {
            var queryOut = {
                c: queryIn['field'],
                o: queryIn['operator'],
                v: queryIn['value']
            }

            return queryOut;
        }
    }

    var q = jQuery('#search_ui').queryBuilder('getRules');
    console.log(q);

    window.vehicleSearch.query = scrubQuery(q)
    console.log(window.vehicleSearch.query);

    // Tell bs_grid to reload the data
    jQuery('#vehicle_table').bs_grid('displayGrid', true);
};


/*
 * Initialize the search UI
 */
window.vehicleSearch.initSearch = function(callback){
    var qbOptions = {
        optgroups: {},
        filters: [],
        allow_groups: true,
        allow_empty: true
    };

    for(i in window.vehicleSearch.columns){
        var colName = window.vehicleSearch.columns[i].columnName;
        var col = window.vehicleSearch.metadata.vehicles.columns[colName];

        var f = {
            id: colName,
            // multilingual object
            label: col.name
        };

        if(col.unit){ 
            for(var lang in f.label){
                f.label[lang] += ' (' + col.unit + ')';
            }
        }

        // The "vehicle make" field gets a typeahead helper
        if(colName == 'merkkiSelvakielinen'){
            /****
            f.type = 'string';
            f.field = 'merkkiSelvakielinen_UPPER';
            f.operators = [ 'equal' ];
            f.input = function(rule, inputName){
                return '<div><input class="form-control typeahead vehiclemake-typeahead" type="text" name="' + inputName + '"></div>';
            };
            ******/
            f = {
                id: 'merkkiSelvakielinen',
                field: 'merkkiSelvakielinen_UPPER',
                label: col.name,
                type: 'string',
                plugin: 'selectize',
                plugin_config: {
                    valueField: 'id',
                    labelField: 'name',
                    searchField: 'name',
                    sortField: 'name',
                    create: true,
                    maxItems: 1,
                    plugins: ['remove_button'],
                    options: []
                },
                valueSetter: function(rule, value) {
                    rule.$el.find('.rule-value-container input')[0].selectize.setValue(value);
                }
            }

            for(i in window.vehicleSearch.distinctProperties['merkkiSelvakielinen_UPPER']){
                f.plugin_config.options.push({
                    id: window.vehicleSearch.distinctProperties['merkkiSelvakielinen_UPPER'][i],
                    name: window.vehicleSearch.distinctProperties['merkkiSelvakielinen_UPPER'][i]
                });
            }

            qbOptions.filters.push(f);
            continue;
        }
            
        // Generic fields according to data type
        switch(col.type){
            case 'bool':
                // CHECK
                f.type = 'boolean';
                f.input = 'radio';
                f.operators = [ 'equal', 'is_null', 'is_not_null' ];
                f.values = [true, false];
            break;

            case 'number':
                f.type = 'double';
                f.operators = [ 'equal', 'not_equal', 
                              'less', 'less_or_equal',
                              'greater', 'greater_or_equal',
                              'between', 'not_between',
                              'is_null', 'is_not_null' ];
            break;

            case 'string':
                // String fields have a shadow "colName_UPPER" property
                // to facilitate using indexes with case-insensitive 
                // searches. In this UI, all string searches are simply
                // case insensitive.
                f.type = 'string';
                f.field = colName + '_UPPER';
            break;

            case 'date':
                // FIXME
                f.type = 'date';
            break;

            case 'enum':
                f.type = 'string';
                f.input = 'checkbox';
                f.multiple = 'true';
                f.operators = [ 'in', 'not_in', 'is_null', 'is_not_null' ];

                // List of possible values for this ENUM field
                f.values = [];
                for(j in col['enum']){
                    var key = col['enum'][j].key;
                    var label = col['enum'][j].name['en'];
                    // Prefer longer labels
                    if(col['enum'][j].desc){
                        label = col['enum'][j].desc['en'];
                    }

                    var o = {};
                    o[key] = label;
                    f.values.push(o);
                }
            break;
              
        }

        qbOptions.filters.push(f);
    }

    // Create the query builder
    jQuery('#search_ui').queryBuilder(qbOptions);


    // Fix for Selectize
    jQuery('#search_ui').on('afterCreateRuleInput.queryBuilder', function(e, rule) {
        if (rule.filter.plugin == 'selectize') {
            rule.$el.find('.rule-value-container').css('min-width', '200px')
                .find('.selectize-control').removeClass('form-control');
        }
    });

/**

    // Add typeahead helper to "vehicle make" inputs
    //jQuery('#search_ui').on('afterCreateRuleInput.queryBuilder', function(e, rule, error, value){
        jQuery('.vehiclemake-typeahead').typeahead(
            { 
                minLength: 1, 
                highlight: true
            }, 
            { 
                name: 'merkkiSelvakielinen_UPPER',
                limit: 20,
                // There's overly complicated and then there's this.
                source: function(query, callback) {
                    var matches = [];
                    var re = new RegExp('^' + query, 'i');
                    for(i in window.vehicleSearch.distinctProperties['merkkiSelvakielinen_UPPER']){
                        if (re.test(window.vehicleSearch.distinctProperties['merkkiSelvakielinen_UPPER'][i])) {
                            matches.push(window.vehicleSearch.distinctProperties['merkkiSelvakielinen_UPPER'][i]);
                        }
                    }
                    callback(matches);
                }
            });
    //});
***/

    callback();
};


/*
 * Initialize the bs_grid datagrid view
 */
window.vehicleSearch.initGrid = function(callback){

    var bsGridOptions = {
        ajaxFetchDataURL: "/api/v1.0/vehicles/list",
        ajaxMethod: "GET",

        ajaxRequestHandler: function(rq) {
            // Show progress bar
            jQuery('#query_progress .progress-bar').show().css('width', '50%').attr('aria-valuenow', 50);

            // Base Query
            var newRequest = {
                page: rq.page_num,
                limit: rq.rows_per_page,
                respDocs: 'page_data',
                respTotal: 'total_rows'
            };

            // Filter params
            if(window.vehicleSearch.query){
                newRequest.find = JSON.stringify(window.vehicleSearch.query);
            }

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

            // 
            jQuery('#query_progress .progress-bar').css('width', '100%').attr('aria-valuenow', 100).hide();
            return response;
        },

        ajaxErrorHandler: function(jqXHR, textStatus, errorThrown) {
            alert('API call failed: ' + textStatus + ': ' + errorThrown);
            
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
 * FIXME: don't build pyramids.
 */
jQuery(document).ready(function(){
    window.vehicleSearch.initMetadata(function(){
        window.vehicleSearch.initSearch(function(){
            window.vehicleSearch.initGrid(function() {
                jQuery('#execute_search').on('click', function(){
                    window.vehicleSearch.refresh();
                });
            });
        });
    });
});
