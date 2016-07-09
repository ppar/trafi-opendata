/*
 * FIXME: Organize this using CommonJS, a civilized async system and/or some MVC
 *
 */

window.vehicleSearch = {};

window.vehicleSearch.heightAdjustement = 20;

/**
 * Map enum columns' values to their human-readable translations in given language
 *
 * Returns 'value' as-is if columnName isn't an ENUM column or the mapping fails otherwise.
 *
 * @param  {string}  columnName - Column name in metadata.json
 * @param  {string}  value      - Value of the ENUM column
 * @param  {string}  language   - Language code found in metadata.json (fi/sv/en)
 * @return {string}  Translated ENUM value
 */
window.vehicleSearch.translateEnum = function(columnName, value, language){
    // id and _id columns are not present in metadata
    if(! window.vehicleSearch.metadata.vehicles.columns[columnName]){
        return value;
    }

    // Pass through non-enum variables
    if(window.vehicleSearch.metadata.vehicles.columns[columnName].type != 'enum'){
        return value;
    }

    // Pass through empty values
    if(value === null || value === ''){
        return value;
    }

    if(window.vehicleSearch.metadata.vehicles.columns[columnName]['enumByKey'][value]){
        return window.vehicleSearch.metadata.vehicles.columns[columnName]['enumByKey'][value].name[language];
    }

    //return columnName + ':' + value;
    return value;
};


/**
 * Translate a 'vehicle' object's ENUM fields to given language
 *
 * @param  {object}  vehicle    - An object from the API, representing one vehicle entry
 * @param  {string}  language   - Language code found in metadata.json (fi/sv/en)
 * @return {object}  The 'vehicle' object with applicable fields' values translated
 */
window.vehicleSearch.translateVehicle = function(vehicle, language){
    var result = {};
    for(prop in vehicle){
        result[prop] = window.vehicleSearch.translateEnum(prop, vehicle[prop], language);
    }
    return result;
}

/**
 * Map column names to their human-readable labels in given language
 *
 * @param  {string}  columnName - Column name in metadata.json
 * @param  {string}  language   - Language code found in metadata.json (fi/sv/en)
 * @return {string}  Translated column name
 */
window.vehicleSearch.translateColumnName = function(columnName, language){
    // id and _id columns are not present in metadata
    if(! window.vehicleSearch.metadata.vehicles.columns[columnName]){
        return columnName;
    }

    return window.vehicleSearch.metadata.vehicles.columns[columnName].name[language];
};


/**
 * Compress a QueryBuilder query object into JSON API syntax
 *
 * Takes a query object returned by the QueryBuilder widget and returns an
 * equivalent object in the syntax expected by the trafi-opendata JSON API.
 *
 * Namely, identifiers (condition, rules, field, operator, value) are 
 * abbreviated to (co, ru, c, o, v).
 *
 * Query objects can be nested; this function walks through the whole object 
 * recursively.
 *
 * The input parameter's syntax is as follows:
 *
 *    {
 *        "condition": "AND",
 *        "rules": [
 *            {
 *                "id": "price",
 *                "field": "price",
 *                "type": "double",
 *                "input": "text",
 *                "operator": "less",
 *                "value": "10.25"
 *            },
 *            {
 *                "condition": "OR",
 *                "rules": [
 *                    {
 *                        "id": "category",
 *                        "field": "category",
 *                        "type": "integer",
 *                        "input": "select",
 *                        "operator": "equal",
 *                        "value": "2"
 *                    },
 *                    {
 *                        "id": "category",
 *                        "field": "category",
 *                        "type": "integer",
 *                        "input": "select",
 *                        "operator": "equal",
 *                        "value": "1"
 *                    }
 *                ]
 *            },
 *            {
 *                "id": "in_stock",
 *                "field": "in_stock",
 *                "type": "integer",
 *                "input": "radio",
 *                "operator": "equal",
 *                "value": "1"
 *            }
 *        ]
 *    }
 *
 * @param  {object} queryIn - A query object (or a its sub-object) from QueryBuilder
 * @return {object} Equivalent object with abbreviated identifiers.
 */
window.vehicleSearch.scrubQuery = function(queryIn){
    if(queryIn['condition'] && queryIn['rules']){
        var queryOut = {
            co: queryIn['condition'],
            ru: []
        };

        for(i in queryIn['rules']){
            // Recurse
            queryOut['ru'][i] = window.vehicleSearch.scrubQuery(queryIn['rules'][i]);
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
};

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


/**
 * Load metadata from the server and process it.
 * 
 * Loads columns.json, metadata.json and distinct values of vehicle
 * makes (merkkiSelvakielinen) from the server. 
 *
 * Populates variables 'window.vehicleSearch.columns' and 
 * 'window.vehicleSearch.metadata'.
 *
 * Indexes ENUM values by their keys under 
 * window.vehicleSearch.columns[columnName]['enumByKey'][enumKey]
 *
 * @param {function}  callback  - Callback to call when loading completes.
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
                    
                    // Convenience array containing visible columns
                    window.vehicleSearch.visibleColumns = [];
                    for(i in window.vehicleSearch.columns){
                        if(window.vehicleSearch.columns[i].defaultVisibility){
                            window.vehicleSearch.visibleColumns.push({
                                'name': window.vehicleSearch.columns[i].columnName, 
                                'label': window.vehicleSearch.translateColumnName(
                                    window.vehicleSearch.columns[i].columnName, 'en')
                            });
                        }
                    }

                    // Load car makes
                    jQuery.ajax('/api/v1.0/vehicles/propertyDistinct/merkkiSelvakielinen', {
                        dataType: 'json',
                        success: function(data){
                            vehicleSearch.distinctProperties = {};
                            vehicleSearch.distinctProperties['merkkiSelvakielinen'] = data;

                            //
                            callback();
                        }
                    });
                }
            });
        }
    });
};

/**
 * Create QueryBuilder configuration
 *
 * Walks through the metadata and builds a QueryBuilder configuration
 * with all columns as search fields, taking field types, ENUMs etc into account.
 *
 * @return {object}  - A configuration object as expected by the QueryBuilder plugin.
 */
window.vehicleSearch.getQueryBuilderConfig = function(){
    var qbOptions = {
        optgroups: {},
        filters: [],
        rules: [],
        allow_groups: true,
        allow_empty: true
    };

    // Walk through columns
    for(i in window.vehicleSearch.columns){
        var colName = window.vehicleSearch.columns[i].columnName;
        var col     = window.vehicleSearch.metadata.vehicles.columns[colName];

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

        // In the MongoDB backend, string fields have experimental shadow 
        // fields named "<colName>_UPPER" to facilitate using indexes with 
        // case-insensitive searches. Currently the whole backend is not used.

        // The "vehicle make" field uses the 'selectize' typeahead plugin
        if(colName == 'merkkiSelvakielinen'){
            f = {
                id: 'merkkiSelvakielinen',
                field: 'merkkiSelvakielinen', // _UPPER
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
                    dropdownParent: 'body',
                    options: []
                },
                valueSetter: function(rule, value) {
                    rule.$el.find('.rule-value-container input')[0].selectize.setValue(value);
                }
            }

            for(i in window.vehicleSearch.distinctProperties['merkkiSelvakielinen']){  // _UPPER
                f.plugin_config.options.push({
                    id: window.vehicleSearch.distinctProperties['merkkiSelvakielinen'][i], // _UPPER
                    name: window.vehicleSearch.distinctProperties['merkkiSelvakielinen'][i] // _UPPER
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
                f.type = 'string';
                f.field = colName /* + '_UPPER' */;
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

    return qbOptions;
};

/**
 * Initialize the QueryBuilder UI
 *
 * Creates the jQuery QueryBuilder widget using configuration based on the metadata.
 */
window.vehicleSearch.initQueryBuilder = function(){
    // Create the query builder
    jQuery('#search_ui').queryBuilder(window.vehicleSearch.getQueryBuilderConfig());

    // Fix for Selectize
    jQuery('#search_ui').on('afterCreateRuleInput.queryBuilder', function(e, rule) {
        if (rule.filter.plugin == 'selectize') {
            rule.$el.find('.rule-value-container').css('min-width', '200px')
                .find('.selectize-control').removeClass('form-control');
        }
    });

    // This is an eyesore, but we need to make sure the rest of the UI reacts properly
    // to the query UI changing its size. There's no general event available and 
    // jQuery().on() doesn't offer any wildcard matches either.
    var allEvents = ''
        + 'afterAddGroup.queryBuilder '
        + 'afterAddRule.queryBuilder '
        + 'afterApplyRuleFlags.queryBuilder '
        + 'afterClear.queryBuilder '
        + 'afterCreateRuleFilters.queryBuilder '
        + 'afterCreateRuleInput.queryBuilder '
        + 'afterCreateRuleOperators.queryBuilder '
        + 'afterDeleteGroup.queryBuilder '
        + 'afterDeleteRule.queryBuilder '
        + 'afterInit.queryBuilder '
        + 'afterInvert.queryBuilder '
        + 'afterMove.queryBuilder '
        + 'afterReset.queryBuilder '
        + 'afterSetFilters.queryBuilder '
        + 'afterUpdateGroupCondition.queryBuilder '
        + 'afterUpdateRuleFilter.queryBuilder '
        + 'afterUpdateRuleOperator.queryBuilder '
        + 'afterUpdateRuleValue.queryBuilder '
        + 'beforeAddGroup.queryBuilder '
        + 'beforeAddRule.queryBuilder '
        + 'beforeDeleteGroup.queryBuilder '
        + 'beforeDeleteRule.queryBuilder '
        + 'beforeDestroy.queryBuilder '
        + 'validationError.queryBuilder '
    ;
    jQuery('#search_ui').on(allEvents, function(){
        jQuery(window).resize();
    });
};


/**
 * Execute a search
 *
 * Reads query parameters from the QueryBuilder widget, queries the JSON API,
 * stores updated application state and calls drawTable().
 */
window.vehicleSearch.search = function() {
    // Show progress bar
    window.vehicleSearch.showProgressBar();

    window.vehicleSearch.currentQuery = jQuery('#search_ui').queryBuilder('getRules');
    window.vehicleSearch.currentQueryScrubbed = 
        window.vehicleSearch.scrubQuery(window.vehicleSearch.currentQuery);
    window.vehicleSearch.currentResult = false;

    // Base JSON request
    var ajaxData = {
        page: window.vehicleSearch.currentPage,
        limit: 50
    };

    // Filter parameters
    // FIXME: Have QueryBuilder validate the query, abort if invalid
    if(window.vehicleSearch.currentQuery){
        ajaxData.find = JSON.stringify(window.vehicleSearch.currentQueryScrubbed);
    }

    // Sort parameters
    /***
    if(false){
        ajaxData.sort = [];
        for(i in ... ){
            ajaxData.sort.push({'c': rq.sorting[i].field, 'd': rq.sorting[i].order });
        }
    }
    ***/

    jQuery.ajax({
        type: 'GET',
        url: '/api/v1.0/vehicles/list',
        data: ajaxData,
        dataType: "json",
        success: function(data) {
            // Properties: docs, total, limit, page, pages
            window.vehicleSearch.currentResult = data;

            // FIXME: enable this when interpreting it is implemented
            // location.hash = JSON.stringify({'q': window.vehicleSearch.currentQueryScrubbed });

            jQuery('#result_stats')
                .html('' + data.total + ' / ' + data.full + '<br/>'
                      + '<span style="white-space: nowrap;">vehicles matched ('
                      + (100 * data.total/data.full).toFixed(2) + '%)</span>');

            window.vehicleSearch.drawTablePagination();
            window.vehicleSearch.drawTable();

            // Hide progress bar
            window.vehicleSearch.hideProgressBar();
        },

        error: function(jqXHR, textStatus, errorThrown){
            // TODO: civilized error handling
            alert(textStatus);

            // Hide progress bar
            window.vehicleSearch.hideProgressBar();
        }
    });
};

/**
 * Show the progress bar
 *
 * @param {int} value  - Percentage value to set the progressbar to. Default: 50
 */
window.vehicleSearch.showProgressBar = function(value){
    value = (typeof value === 'undefined' ? 50 : parseInt(value));

    jQuery('#query_progress .progress-bar')
        .show()
        .css('width', '' + value + '%')
        .attr('aria-valuenow', value);
};


/**
 * Hide the progress bar
 */
window.vehicleSearch.hideProgressBar = function(){
    jQuery('#query_progress .progress-bar')
        .css('width', '100%')
        .attr('aria-valuenow', 100);
    
    window.setTimeout(function(){ jQuery('#query_progress .progress-bar').hide(); }, 600);
};

/**
 * Draw pagination widget for the vehicle table
 *
 * Generates the pagination widgets and its click handler
 */
window.vehicleSearch.drawTablePagination = function(){
    // Number of buttons to display (odd)
    var pageButtons = 9;

    // 
    var data = window.vehicleSearch.currentResult;
    var html = '';

    // Prev button
    html += '<li id="table_pagination_prev" ';
    if(data.page > 2){
        html += 'data-pageno="' + (data.page - 1) + '"';
    } else {
        html += 'class="disabled"'
    }
    html += '><a href="#" aria-label="Previous"><span aria-hidden="true">&laquo;</span></a></li>';
    
    // Number buttons
    // FIXME: this centering looks ugly
    for(i = (data.page - (pageButtons-1)/2); i <= (data.page + (pageButtons-1)/2); i++){
        if(i < 1 || i > data.pages){
            html += '<li class="table_pagination_page disabled"><a href="#">.</a></li>';
        } else {
            html += '<li class="table_pagination_page ' + (i === data.page ? 'active' : '') + '" '
                + 'data-pageNo="' + i + '"><a href="#">' + i + '</a></li>';
        }
    }

    // Next button
    html += '<li id="table_pagination_next" ';
    if(data.page < data.pages){
        html += 'data-pageno="' + (data.page + 1) + '"';
    } else {
        html += 'class="disabled"'
    }
    html += '><a href="#" aria-label="Next"><span aria-hidden="true">&raquo;</span></a></li>';

    // Inject it
    jQuery('#table_pagination').html(html);

    // Click handler
    jQuery('#table_pagination li').on('click', function(event){
        event.preventDefault();

        if(jQuery(this).hasClass('disabled')){
            return;
        }

        var newPage = parseInt(jQuery(this).data('pageno'));

        if(!newPage || newPage < 1 || newPage > data.pages){
            return;
        }

        // Switch page
        window.vehicleSearch.currentPage = newPage;
        window.vehicleSearch.search();
    });
};



/**
 * Draw the vehicle table
 *
 * Reads application state and re-draws the vehicle table.
 */
window.vehicleSearch.drawTable = function(){    
    // Destroy previous table
    jQuery('#vehicle_table_container').html('');

    // Build HTML for new table
    // FIXME: escape data-xyz attributes
    var html = '<table id="vehicle_table" class="table table-striped table-condensed"><thead><tr>';
    for(i in window.vehicleSearch.visibleColumns){
        html += '<th data-columnName="' + window.vehicleSearch.visibleColumns[i].name + '">' 
            + window.vehicleSearch.visibleColumns[i].label + '</th>';
    }
    html += '</thead><tbody>';
    for(i in window.vehicleSearch.currentResult.docs){
        var vehicle = window.vehicleSearch.translateVehicle(window.vehicleSearch.currentResult.docs[i], 'en');
        html += '<tr data-vehicleId="' + vehicle.id + '">';
        for(i in window.vehicleSearch.visibleColumns){
            html += '<td data-vehicleId="' + vehicle.id + '" data-columnName="' 
                + window.vehicleSearch.visibleColumns[i].name + '">'
                + vehicle[window.vehicleSearch.visibleColumns[i].name]
                + '</td>';
        }
        html += '</tr>';
    }
    html += '</tbody></table>';

    // Repopulate the table
    jQuery('#vehicle_table_container').html(html);

    // Fix the headers in place
    jQuery('#vehicle_table').stickyTableHeaders({ 
        scrollableArea: jQuery("#vehicle_table_container")[0], 
        fixedOffset: 2 
    });
};


/**
 * Resize event handler
 */
window.vehicleSearch.resize = function(){
    // Tweak the Search UI
    if(jQuery('#search_ui :visible').length){
        // Search UI is visible

        // Reduce jitter in the UI by pre-expanding the query builder's container
        if(jQuery('#search_ui').height() < 250){
            jQuery('#search_ui_scroll_container').height('');
        } else {
            jQuery('#search_ui_scroll_container').height(275);
        }

        // Align the search button with the bottom of the QueryBuilder UI
        jQuery('#search_button_container_rel').height(jQuery('#search_ui_scroll_container').height());

    } else {
        // Search UI is hidden, reset height adjustement
        jQuery('#search_button_container_rel').height('');
    }

    // Adjust the vehicle table to full unused height
    var winH = jQuery(window).height();
    var offset = jQuery('#vehicle_table_container').offset()['top'];
    var areaH = '' + (winH - offset - window.vehicleSearch.heightAdjustement) + 'px';
    jQuery('#vehicle_table_container').height(areaH);

    // Reinitialize fixed table headers. 
    // Needed when either the window width or widget height changes
    jQuery('#vehicle_table').stickyTableHeaders({ 
        scrollableArea: jQuery("#vehicle_table_container")[0], 
        fixedOffset: 2 
    });
};

/**
 * Document Ready function; start the app.
 */
jQuery(document).ready(function(){
    // Install resize event handler
    jQuery(window).resize(window.vehicleSearch.resize);

    // Load metadata
    window.vehicleSearch.initMetadata(function(){
        // Initialize query builder UI
        window.vehicleSearch.initQueryBuilder();
        
        // Search button
        jQuery('#execute_search').on('click', function(){
            window.vehicleSearch.currentPage = 1;
            window.vehicleSearch.search();
        });

        // "Hide / show search" buttons
        jQuery('#search_ui_hide_btn').on('click', function(){
            jQuery('#search_ui_row').hide();
            //jQuery('#execute_search').toggle();
            jQuery('#search_ui_hide_btn').hide();
            jQuery('#search_ui_show_btn').show();
            jQuery(window).resize();
        });
        jQuery('#search_ui_show_btn').on('click', function(){
            jQuery('#search_ui_row').show();
            //jQuery('#execute_search').toggle();
            jQuery('#search_ui_show_btn').hide();
            jQuery('#search_ui_hide_btn').show();
            jQuery(window).resize();
        });

        // Clicks on Table / Map tabs
        jQuery('.tab_button').on('click', function(event){
            event.preventDefault();

            if(jQuery(this).hasClass('tab_table')){
                jQuery('li.tab_map').removeClass('active');
                jQuery('#result_controls_map').hide();
                jQuery('#vehicle_map_row').hide();

                jQuery('li.tab_table').addClass('active');
                jQuery('#result_controls_table').show();
                jQuery('#vehicle_table_row').show();

            } else if(jQuery(this).hasClass('tab_map')){
                jQuery('li.tab_table').removeClass('active');
                jQuery('#result_controls_table').hide();
                jQuery('#vehicle_table_row').hide();

                jQuery('li.tab_map').addClass('active');
                jQuery('#result_controls_map').show();
                jQuery('#vehicle_map_row').show();
            }
        });

        // Set initial sizes
        jQuery(window).resize();

        // Perform initial search to show all records
        window.vehicleSearch.currentPage = 1;
        window.vehicleSearch.search();        
    });

});
