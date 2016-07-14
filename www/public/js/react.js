/**
 * trafi-opendata/www/public/js/react.js
 *
 * User interface for trafi-opendata application. 
 * 
 * NOTE: This was originally implemented in jQuery, so 
 *       some jQueryisms are still present.
 */

/**
 * Bootloader component. 
 *
 * Responsible for displaying the initial progress bar, loading metadata
 * from the server and instantiating the main application component.
 */
var BootLoader = React.createClass({
    // Initial state
    getInitialState: function(){
        return { state: 'loading' };
    },

    // Render it
    render: function(){
        if(this.state.state === 'loading'){
            // Initial loading bar
            return(<div id="bootloader_progress" className="progress">
                       <div className="progress-bar progress-bar-striped active" 
                             role="progressbar" >
                           <span className="sr-only"></span>
                       </div>
                   </div>);

        } else if(this.state.state === 'error'){
            // The API is probably down. Show a nice error message.
            return(<div id="bootloader_error" className="container"><div> 
                       There was an error loading the application. Please try again later.<br/>
                       <span>{this.state.errorMessage}</span>
                   </div></div>);

        } else {
            // Loading complete

            // FIXME: this is static data; arrange so that all components
            // can access it in a sensible way w/o passing it around in properties
            window.metadata        = this.state.metadata;
            window.columns         = this.state.columns;
            window.visibleColumns  = this.state.visibleColumns;
            // Finnish column names come from the source data
            window.distinctProperties = {
                merkkiSelvakielinen: this.state.makes
            };

            // Render the application
            return (<VehicleDataApp 
                        metadata={this.state.metadata}
                        makes={this.state.makes}
                        columns={this.state.columns}
                        visibleColumns={this.state.visibleColumns} />);
        }
    },

    // Load data & render again
    componentDidMount: function(){
        // Load metadata from the server and process it.

        // FIXME: use a sane async library instead of callback pyramids

        // Load columns
        var that = this;
        var path = '/js/columns.json';
        jQuery.ajax(path, {
            dataType: 'json',
            success: function(columnsResponse){
                var columns = columnsResponse.sort(function(a, b){
                    if(a.presentationOrder > b.presentationOrder){ return 1; }
                    if(a.presentationOrder < b.presentationOrder){ return -1; }
                    return 0;
                });

                // Load metadata
                path = '/js/metadata.json';
                jQuery.ajax(path, {
                    dataType: 'json',
                    success: function(metadata){
                        
                        // Index enum values for faster & easier lookups
                        for(var col in metadata.vehicles.columns){
                            if(metadata.vehicles.columns[col].type == 'enum'){
                                var list = metadata.vehicles.columns[col]['enum'];
                                var dict = {};
                                for(i in list){
                                    dict[list[i].key] = list[i];
                                }
                                metadata.vehicles.columns[col]['enumByKey'] = dict;
                            }
                        }
                        
                        // Convenience array containing visible columns
                        var visibleColumns = [];
                        for(var i in columns){
                            if(columns[i].defaultVisibility){
                                visibleColumns.push({
                                    'name': columns[i].columnName, 
                                    'label': (metadata.vehicles.columns[columns[i].columnName]
                                              ? metadata.vehicles.columns[columns[i].columnName].name['en']
                                              : columns[i].columnName)
                                });
                            }
                        }

                        // Load car makes
                        path = '/api/v1.0/vehicles/propertyDistinct/merkkiSelvakielinen';
                        jQuery.ajax(path, {
                            dataType: 'json',
                            success: function(makes){
                                // All done, start the application
                                that.setState({
                                    state: 'done',
                                    metadata: metadata,
                                    columns: columns,
                                    visibleColumns: visibleColumns,
                                    makes: makes
                                });
                            },
                            error: function(jqXHR, textStatus, errorThrown){
                                that.setState({
                                    state: 'error',
                                    errorMessage: path + ': ' + jqXHR.status + ' ' + errorThrown
                                });
                            }
                        });
                    },
                    error: function(jqXHR, textStatus, errorThrown){
                        that.setState({
                            state: 'error',
                            errorMessage: path + ': ' + jqXHR.status + ' ' + errorThrown
                        });
                    }
                });
            },
            error: function(jqXHR, textStatus, errorThrown){
                that.setState({
                    state: 'error',
                    errorMessage: path + ': ' + jqXHR.status + ' ' + errorThrown
                });
            }
        });
    }
});

/**
 * Main Application Component
 *
 * Responsible for holding most (all) application state, coordinating state 
 * changes between various UI components and issuing Ajax queries to the server.
 * 
 * This class is kind of too big and spread out, but it's partly because the UI 
 * views and DOM hierarchy don't map 1:1. Also this structure lets us isolate the
 * filter query UI (or UIs, eventually) from the various views (table/map/...)
 * 
 * FWIW, metadata could live in its own class anyway.
 */
var VehicleDataApp = React.createClass({
    /**
     *
     */
    getInitialState: function(){
        return {
            loading: false,
            progressBarValue: 0,
            view: 'TABLE',

            findParam: null,
            sortParam: null,
            limitParam: 10,
            pageParam: 1,

            result: {
                docs: [],
                total: 0,
                limit: 10,
                page: 1,
                pages: 1
            }
        };
    },

    /**
     * Top-level render function
     */
    render: function(){
        var tableVisible = this.state.view === 'TABLE' ? true : false;
        var mapVisible   = this.state.view === 'MAP'   ? true : false;
        return(
            <div>
                <ProgressBar 
                    id="query_progress" 
                    visible={this.state.loading} 
                    value={this.state.progressBarValue} 
                />
                <div id="maincontainer" className="container-fluid">
                    <MainHeader/>
                    <AdvancedSearch
                        onQueryUpdate={this.handleFindParamUpdate}
                        resize={this.resize}
                    />
                    <TabMenuBar
                        result={this.state.result}
                        loading={this.state.loading}
                        tableFitment={this.getResultTableFitment()}
                        onTabChange={this.handleTabChange}
                        onShowSearch={this.handleShowSearch}
                        onPageChange={this.handlePageParamUpdate}
                        onLimitChange={this.handleLimitParamUpdate}
                    />
                    <TableView 
                        result={this.state.result}
                        visible={tableVisible}
                    />
                    <MapView
                        query={this.state.query} visible={mapVisible}/>
                    <MainFooter/>
                </div>
            </div>
        );
    },

    /**
     * Initialization
     */
    componentDidMount: function(){
        // Install resize handler
        jQuery(window).resize(this.resize);

        // Run query with default params
        this.loadResults({
            find:  this.state.findParam,
            sort:  this.state.sortParam,
            limit: /*this.state.limitParam*/ this.getResultTableFitment(),
            page:  this.state.pageParam
        });
    },
    
    /**
     * Readjusts element sizes after we've rendered something
     */
    componentDidUpdate: function(prevProps, prevState){
        this.resize();
    },

    /**
     * Receives updated 'find' parameter from the AdvancedSearch 
     * component when the user clicks the Search button
     */
    handleFindParamUpdate: function(find){
        // Retain the user's selected page number
        this.loadResults({ find:  find });
    },

    /** 
     * Receives new sort params from the TableView component 
     */
    handleSortParamUpdate: function(sort){
        /***
            if(false){
            ajaxData.sort = [];
            for(i in ... ){
            ajaxData.sort.push({'c': rq.sorting[i].field, 'd': rq.sorting[i].order });
            }
            }
        ***/
        this.loadResults({ sort: sort });
    },

    /** 
     * Receives page number selection from the TabMenuBar component 
     */
    handlePageParamUpdate: function(page){
        this.loadResults({ page: page });
    },
    
    /** 
     * Receives limit (page size) selection from the TabMenuBar component 
     */
    handleLimitParamUpdate: function(limit){
        this.loadResults({ limit: limit });
    },
        
    /**
     * Loads new results from the server.
     *
     * Runs a query on the server based on newParams. 
     * Saves updated query parameters and results in application state if query was successful.
     * Shows/hides progress bars as needed.
     *
     * @param  {object}  newParams    - New query params
     */
    loadResults: function(newParams){
        var params = {
            find:  this.state.findParam,
            sort:  this.state.sortParam,
            limit: this.state.limitParam,
            page:  this.state.pageParam
        };
        for(var key in newParams){
            params[key] = newParams[key];
        }
        // JSON.stringify(newParams.find)

        // Show progress bar
        this.setState({ loading: true, progressBarValue: 66 });

        // Start Ajax request
        jQuery.ajax({
            type: 'GET',
            url: '/api/v1.0/vehicles/list',
            dataType: "json",
            data: params,
        
            //
            success: function(result){
                // result
                //   .docs
                //   .total
                //   .limit
                //   .page
                //   .pages

                // Hide progress bar
                // Save current query parameters in application state
                // Save results in application state
                // Have React render the UI
                
                // The new result may have less pages than the user's 
                // previously selected page, so set this.state.pageParam
                // to the page number the server actually returned.

                this.setState({
                    loading:          false,
                    progressBarValue: 100,

                    result:      result,

                    findParam:   params.find,
                    sortParam:   params.sort,
                    limitParam:  params.limit,
                    pageParam:   result.page
                });
            }.bind(this),

            //
            error: function(jqXHR, textStatus, errorThrown){
                alert(textStatus);
                this.setState({ loading: false });
            }.bind(this)
        });
    },

    /**
     * Receives new tab selection from the TabMenuBar component
     *
     * TODO: update query parameters as needed by table vs. map views, then loadResults()
     *
     * @param {string}  newTab  - 'TABLE' or 'MAP'
     */
    handleTabChange: function(newTab){

        // do nothing until map view is implemented

        // 'TABLE' or 'MAP'
        //this.setState({view: newTab});
    },
    
    /**
     * Unhides the search UI
     */
    handleShowSearch: function(){
        // FIXME: remove jQuery, use component state instead
        jQuery('#search_ui_row').show();
        jQuery('#search_ui_show_btn').hide();
        jQuery('#search_ui_hide_btn').show();
        this.resize();
    },
    
    /**
     * Returns the number of vertical pixels available for the result view
     * 
     * @return {int} Available result area height in pixels
     */
    getResultAreaHeight: function(){
        var heightAdjustement = 20;
        var winH = jQuery(window).height();

        //var offset = jQuery('#vehicle_table_container').offset()['top'];
        var vtc = jQuery('#vehicle_table_container');
        var offset = vtc.length ? vtc.offset()['top'] : 0;
        
        var areaH = winH - offset - heightAdjustement;
        return areaH;
    },
    
    /**
     * Returns the number of non-word-wrapped table rows that fit in this.getResultAreaHeight()
     *
     * @return {int}  Number of rows
     */
    getResultTableFitment: function(){
	// One row without word-wrapping should be 31px tall
        return Math.floor(this.getResultAreaHeight() / 30) - 3;
    },

    /**
     * Handles window resize events
     * 
     * FIXME: remove jQueryisms, use component state correctly
     */
    resize: function(){
        //console.log('VDA:resize()');

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
        jQuery('#vehicle_table_container').height('' + this.getResultAreaHeight() + 'px');
	
        // Reinitialize fixed table headers. 
        // Needed when either the window width or widget height changes
        jQuery('#vehicle_table').stickyTableHeaders({ 
            scrollableArea: jQuery("#vehicle_table_container")[0], 
            fixedOffset: 2 
        });
    },


    /*
     * Static methods
     */
    statics: {
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
        translateEnum: function(columnName, value, language){
            // id and _id columns are not present in metadata
            if(! window.metadata.vehicles.columns[columnName]){
                return value;
            }

            // Pass through non-enum variables
            if(window.metadata.vehicles.columns[columnName].type != 'enum'){
                return value;
            }

            // Pass through empty values
            if(value === null || value === ''){
                return value;
            }

            if(window.metadata.vehicles.columns[columnName]['enumByKey'][value]){
                return window.metadata.vehicles.columns[columnName]['enumByKey'][value].name[language];
            }

            //return columnName + ':' + value;
            return value;
        },


        /**
         * Translate a 'vehicle' object's ENUM fields to given language
         *
         * @param  {object}  vehicle    - An object from the API, representing one vehicle entry
         * @param  {string}  language   - Language code found in metadata.json (fi/sv/en)
         * @return {object}  The 'vehicle' object with applicable fields' values translated
         */
        translateVehicle: function(vehicle, language){
            var result = {};
            for(var prop in vehicle){
                result[prop] = VehicleDataApp.translateEnum(prop, vehicle[prop], language);
            }
            return result;
        }
    }
});

/**
 * Progress bar, fixed position at the top edge 
 *
 * @param  {string} props.id            - DOM ID
 * @param  {bool}   props.visible       - Whether the bar is visible or not
 * @param  {int}    props.value         - Value shown by the bar, 0 to 100
 */
var ProgressBar = React.createClass({
    render: function(){
        return(
            <div id={this.props.id} className="progress">
                <div className="progress-bar progress-bar-striped active" 
                     role="progressbar" 
                     style={{width: ('' + this.props.value + '%')}}
                     aria-valuenow={this.props.value} 
                     aria-valuemin="0" 
                     aria-valuemax="100">
                    <span className="sr-only"></span>
                </div>
            </div>
        );
    },

    componentDidUpdate: function(prevProps, prevState){
        // We need a slight delay before hiding to let the user's brain perceive the 
        // final change, so visibility is handled here instead of render().
        if(this.props.visible && ! prevProps.visible){
            jQuery('#' + this.props.id + ' .progress-bar').show();

        } else if(! this.props.visible && prevProps.visible){
            window.setTimeout(function(){ jQuery('#query_progress .progress-bar').hide(); }, 600);
        }
    }
});

/**
 * Main Header
 */ 
var MainHeader = React.createClass({
    render: function(){
        return(
            <div id="navbar_row" className="row">
                <div className="col-lg-11 col-md-11 col-sm-11 col-xs-10">
                    <nav className="well well-sm" style={{borderRadius: '0px', paddingLeft: '20px'}}>
                        vehicledata.fi
                    </nav>
                </div>
                <div className="col-lg-1 col-md-1 col-sm-1 col-xs-2">
                    <nav className="well well-sm" 
                         style={{borderRadius: '0px', textAlign: 'center'}}>
                        <a href="http://ppar.github.io/trafi-opendata/" 
                           style={{color: '#000000', fontSize: 'smaller'}}>About</a>
                     </nav>
                </div>
            </div>
        );
    }
});

/**
 * Advanced Search UI 
 * 
 * Responsible for the jQueryQueryBuilder search UI and its adjacent buttons
 *
 * TBD: Implement a simple search UI too
 * 
 * @param {function}   props.onQueryUpdate  - Callback to run when the search button is clicked
 * @param {function}   props.resize         - Callback for requesting a window resize
 */ 
var AdvancedSearch = React.createClass({
    render: function(){
        return(
            <div id="search_ui_row" className="row search_ui">
                <div className="col-md-11 col-sm-11 col-xs-10">
                    <div id="search_ui_scroll_container">
                      <QueryBuilder id="search_ui" resize={this.props.resize} />
                    </div>
                </div>

                <div id="search_button_col" className="col-md-1 col-sm-1 col-xs-2">
                    <div id="search_button_container_rel">
                        <div id="search_hide_button_container_abs">
                            <button id="search_ui_hide_btn"
                                    type="button"  
                                    className="btn btn-default btn-xs"
                                    onClick={this.handleHideClick}
                                    aria-expanded="false">
                                <span className="glyphicon glyphicon-minus" aria-hidden="true"></span>
                                <span className="hidden-sm hidden-xs">Hide search</span>
                            </button>
                         </div>
                        <div id="search_button_container_abs">
                            <button id="execute_search"
                                    type="button" 
                                    className="btn btn-default btn-sm btn-block"
                                    onClick={this.handleSearchClick}
                                    aria-expanded="false">
                                <span className="hidden-lg hidden-md" style={{fontSize: 'smaller'}}>-&gt;</span>
                                <span className="hidden-sm hidden-xs">Search</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    },

    /**
     * Hides the search UI
     */
    handleHideClick: function(e){
        // FIXME: remove jQuery, propagate state change to parent class instead
        jQuery('#search_ui_row').hide();
        jQuery('#search_ui_hide_btn').hide();
        jQuery('#search_ui_show_btn').show();
        //jQuery(window).resize();
        this.props.resize();
    },
    
    /**
     * Passes the "find" parameter to VehicleDataApp when user requests to execute a new query
     */
    handleSearchClick: function(e){
        var qbRules = jQuery('#search_ui').queryBuilder('getRules');
        var scRules = QueryBuilder.compressQuery(qbRules);
        this.props.onQueryUpdate(scRules);
    }

});

/**
 * QueryBuilder widget in the Advanced Search -- app-specific parts
 *
 * @param  {string}    props.id        - DOM ID
 * @param  {function}  props.resize    - Callback for requesting a window resize
 */
var QueryBuilder = React.createClass({
    /**
     *
     */
    render: function(){
        // Get config based on metadata.json
        var qbConfig = QueryBuilder.getConfiguration();

        return(
            <JQQueryBuilder id={this.props.id} config={qbConfig} onAll={this.props.resize} />
        );
    },

    /**
     *
     */
    componentDidMount: function(){
        // Fix for Selectize
        jQuery('#' + this.props.id).on('afterCreateRuleInput.queryBuilder', function(e, rule) {
            if (rule.filter.plugin == 'selectize') {
                rule.$el.find('.rule-value-container').css('min-width', '200px')
                    .find('.selectize-control').removeClass('form-control');
            }
        });
    },


    /*
     * Static methods
     */
    statics: {
        /**
         * Create QueryBuilder configuration for VehicleData app
         *
         * Walks through the metadata and builds a QueryBuilder configuration
         * with all columns as search fields, taking field types, ENUMs etc into account.
         *
         * @return {object}  - A configuration object as expected by the QueryBuilder plugin.
         */
        getConfiguration: function(){
            var qbOptions = {
                optgroups: {},
                filters: [],
                rules: [],
                allow_groups: true,
                allow_empty: true
            };

            // Walk through columns
            for(var i in window.columns){
                var colName = window.columns[i].columnName;
                var col     = window.metadata.vehicles.columns[colName];

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

                    for(var i in window.distinctProperties['merkkiSelvakielinen']){  // _UPPER
                        f.plugin_config.options.push({
                            id: window.distinctProperties['merkkiSelvakielinen'][i], // _UPPER
                            name: window.distinctProperties['merkkiSelvakielinen'][i] // _UPPER
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
                    for(var j in col['enum']){
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
        },

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
        compressQuery: function(queryIn){
            if(queryIn['condition'] && queryIn['rules']){
                var queryOut = {
                    co: queryIn['condition'],
                    ru: []
                };

                for(var i in queryIn['rules']){
                    // Recurse
                    queryOut['ru'][i] = this.compressQuery(queryIn['rules'][i]);
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
    } /* /statics */
}); /* /QueryBuilder /*


/**
 * React wrapper for the jQuery QueryBuilder plugin -- generic
 *
 * @param  {string}   props.id       - DOM ID for the wrapper DIV
 * @param  {object}   props.config   - jQueryQueryBuilder configuration object
 * @param  {function} props.onAll    - Callback function to fire on all JQQB events
 */
var JQQueryBuilder = React.createClass({
    /**
     * Render a stub DIV
     */
    render: function(){
        return(
            <div id={this.props.id}></div>
        );
    },

    /**
     * Call the jQuery plugin to initialize itself
     */
    componentDidMount: function(){
        // Create the QueryBuilder UI
        jQuery(ReactDOM.findDOMNode(this)).queryBuilder(this.props.config);

        // Implement our own 'onAll' event hook
        //
        // This is an eyesore, but we want to offer a catch-all event handler
        // and jQuery().on() doesn't offer any wildcard matches either.
        if(this.props.onAll){
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
            jQuery('#' + this.props.id).on(allEvents, this.props.onAll);
        }
    }
});


/**
 * TabMenuBar Component
 * 
 * Responsible for the Tab Bar between Search UI and Results and the view-specific controls inside it.
 *
 * Communicates tab, page no. and page limit selection back to VehicleDataApp
 *
 * @param {object}    props.result        - Result object returned by the server
 * @param {object}    props.loading       - There's an Ajax request running
 * @param {object}    props.tableFitment  - 
 * @param {function}  props.onShowSearch  - Callback to run when the "show search" button is clicked
 * @param {function}  props.onTabChange   - Callback to run when tab is changed
 * @param {function}  props.onPageChange  - Callback to run when a new page is selected (for table view)
 * @param {function}  props.onLimitChange - Callback to run when a new limit is selected (for table view)
 */ 
var TabMenuBar = React.createClass({
    render: function(){
        var matchPct = (100 * parseInt(this.props.result.total) / parseInt(this.props.result.full)).toFixed(2);

        /***
        var stats = (this.props.result.total && this.props.result.full
                     ? ( <span>{this.props.result.total} / {this.props.result.full} <br/>
                             <span style={{'whiteSpace': 'nowrap'}}>vehicles matched ({matchPct}%)</span>
                         </span>)
                     : '');
        ***/
        var stats = (this.props.result.total && this.props.result.full
                     ? ( <span>{this.props.result.total} rows ({matchPct}%)<br/>{this.props.result.pages} pages</span>)
                     : '');

        return(
            <div id="result_tab_row" className="row">
              <div className="col-lg-2 col-md-2 col-sm-3 col-xs-3">
                <ul className="nav nav-tabs">
                  <li role="presentation" className="active tab_table">
                      <a className="tab_button tab_table" href="" onClick={this.handleTableTabClick}>Table</a>
                  </li>
                  <li role="presentation" className="disabled //tab_map">
                      <a className="tab_button //tab_map" href="" onClick={this.handleMapTabClick}>Map</a>
                  </li>
                </ul>
              </div>

              <div className="col-lg-3 col-md-3 col-sm-4 col-xs-2">
                  <nav>
                      <TableViewPagination 
                          page={this.props.result.page}
                          maxPage={this.props.result.pages}
                          onSelection={this.props.onPageChange} 
                      />
                  </nav>
              </div>
              <div className="col-lg-2 col-md-2 col-sm-2 col-xs-2">
                  <TableViewPageInput 
                          id="page_no_input"
                          page={this.props.result.page}
                          maxPage={this.props.result.pages}
                          loading={this.props.loading}
                          onSelection={this.props.onPageChange}
                  />
              </div>

              <div className="col-lg-2 col-md-2 col-sm-1 col-xs-2">
                  <TableViewPageLimitSelector 
                      id="page_limit_selector"
                      limit={this.props.result.limit}
                      fitment={this.props.tableFitment}
                      onSelection={this.props.onLimitChange}
                  />
              </div>

              <div className="col-lg-2 col-md-2 hidden-sm hidden-xs" id="result_stats">{stats}</div>
              <div className="hidden-lg hidden-md col-sm-1 col-sm-1"></div>

              <div className="col-lg-1 col-md-1 col-sm-1 col-xs-1" id="">
                <div id="search_ui_show_btn_container">
                    <ShowSearchButton id="search_ui_show_btn" onClickEvent={this.props.onShowSearch} />
                </div>
              </div>
            </div>
        );
    },

    //
    handleTableTabClick: function(e){
        e.preventDefault();
        this.props.onTabChange('TABLE');
    },

    //
    handleMapTabClick: function(e){
        e.preventDefault();
        this.props.onTabChange('MAP');
    }
});


/**
 * Pagination widget for the table view
 *
 * FIXME: centering looks weird
 *
 * @param {int}      props.page         - Current page number
 * @param {int}      props.maxPage      - Max page number (min. is assumed 1)
 * @param {function} props.onSelection  - Callback to run when a new page is selected (for table view)
 */
var TableViewPagination = React.createClass({
    render: function(){
        // "Previous" button
        var prevButton = this.props.page > 2 
            ? (<li id="table_pagination_prev" 
                    data-pageno={(this.props.page - 1)} 
                    onClick={this.handleClick}>
                   <a href="#" aria-label="Previous"><span aria-hidden="true">&laquo;</span></a>
               </li>)
            : (<li id="table_pagination_prev" className="disabled" onClick={this.ignoreClick}>
                   <a href="#" aria-label="Previous"><span aria-hidden="true">&laquo;</span></a>
               </li>);


        // Number buttons
        var numberButtons = [];

        // Number of buttons to display (odd)
        // Reduce number of buttons with large page numbers (FIXME: crude)
        var pageButtons = this.props.page <= 1000 ? 5 : this.props.page <= 10000 ? 5 : this.props.page < 100000 ? 3 : 3;
        var start = (this.props.page - (pageButtons-1)/2);
        var end   = (this.props.page + (pageButtons-1)/2);

        for(var i = start; i <= end; i++){
            var key = 'page_' + i;

            // Reduce the number of buttons on small displays
            var hiddenClasses = 'hidden-xs ';
            if(i - start < 1 || end - i < 1){
                //hiddenClasses += 'hidden-sm hidden-md';
                hiddenClasses += 'hidden-sm';
            }

            if(i >= 1 && i <= this.props.maxPage && this.props.maxPage > 0){
                // Number button
                var className='table_pagination_page ' + hiddenClasses + ' ' + (i === this.props.page ? 'active' : '');
                numberButtons.push(
                    <li key={key} 
                        className={className} 
                        data-pageNo={i} 
                        onClick={this.handleClick}>
                        <a href="#">{i}</a>
                    </li>
                );
                
            } else {
                // Dummy button
                className = 'table_pagination_page disabled ' + hiddenClasses;
                numberButtons.push(
                    <li key={key} className={className} onClick={this.ignoreClick}>
                        <a href="#">.</a>
                    </li>
                );
            }
        }

        // "Next" button
        var nextButton = this.props.page < this.props.maxPage
            ? (<li id="table_pagination_next"
                   data-pageno={(this.props.page + 1)} 
                   onClick={this.handleClick}>
                   <a href="#" aria-label="Next"><span aria-hidden="true">&raquo;</span></a>
               </li>)
            : (<li id="table_pagination_next" className="disabled" onClick={this.ignoreClick}>
                   <a href="#" aria-label="Next"><span aria-hidden="true">&raquo;</span></a>
               </li>);

        //
        return (
            <ul id="table_pagination" className="pagination">
                {prevButton}{numberButtons}{nextButton}
            </ul>
        );
    },

    // Prevent click events on <a ... > elements
    ignoreClick: function(e){
        e.preventDefault();
    },

    // Click handler
    handleClick: function(e){
        e.preventDefault();
        var newPage = parseInt(e.currentTarget.getAttribute('data-pageno'));
        if(!newPage || newPage < 1 || newPage > this.props.maxPage){
            return;
        }
        this.props.onSelection(newPage);
    }
});

/**
 * Page input widget for the table view
 *
 * @param {int}      props.page         - Current page number
 * @param {int}      props.maxPage      - Max page number (min. is assumed 1)
 * @param {bool}     props.loading      - There is an Ajax request running
 * @param {function} props.onSelection  - Callback to run when a new page is selected (for table view)
 */
var TableViewPageInput = React.createClass({
    /** 
     * Initial component state from props.page
     */
    getInitialState: function(){
        return { 
            page: this.props.page
        };
    },

    /**
     * Render it
     */
    render: function(){
        var errorClass = 'input-group' + (this.validate() ? '' : ' has-error');

        return (
            <div id={this.props.id} className={errorClass}>
                <input type="text" className="form-control" placeholder="Page Nr" value={this.state.page} onChange={this.handleChange} />
                <span className="input-group-btn">
                    <button className="btn btn-default" type="button" onClick={this.handleClick}>Go</button>
                </span>
            </div>
        );
    },

    /**
     *
     */
    getInt: function(){
        // TODO: strip spaces, etc
        return intVal(this.state.page);
    },

    /**
     * Validate that the input is 1) a number 2) not greater than maxPage
     */
    validate: function(){
        // FIXME: '50asdasd' parses as (int) 50
        if(isNaN(parseInt(this.state.page))){
            return false;
        }

        if(parseInt(this.state.page) > parseInt(this.props.maxPage)){
            return false;
        }

        return true;
    },

    /**
     * React will set new property values in this Component
     */
    componentWillReceiveProps: function(newProps){
        if(!newProps.loading){
            // React will reuse this component instance when new Ajax pages are loaded and will only 
            // update the page number in the property. Keep the state in sync when properties change.
            this.setState({ page: newProps.page });

        } else {
            // When starting an Ajax request, showing the loading bar will trigger a state change that
            // would cause this Component to re-render with the previous value, temporarily reverting 
            // the user's input, which looks ugly. Ignore property updates when there's an active XHR on.
            return;
        }
    },

    /**
     * User has typed something in the input
     * Mandatory React callback 
     */
    handleChange: function(e){
        this.setState({ page: e.target.value });
    },

    /**
     * User has pressed enter
     */
    handleEnter: function(e){
        //e.preventDefault();
        var newPage = e.currentTarget.getAttribute('value');
        this.props.onSelection(newPage);
    },

    /**
     * User has clicked the submit button
     */
    handleClick: function(e){
        //var newPage = parseInt(window.getElementById(this.props.id).getAttribute('value'));
        var newPage = jQuery('#' + this.props.id + ' input').attr('value');
        this.props.onSelection(newPage);
    },
});


/**
 * 
 *
 * @param {string}    props.id           - DOM ID
 * @param {int}       props.limit        - Current number of rows per page
 * @param {int}       props.fitnemt      - Current optimal number of rows per page
 * @param {function}  props.onSelection  - Callback to run when the value is changed
 */
var TableViewPageLimitSelector = React.createClass({
    /**
     *
     */
    getInitialState: function(){
        return { limit: this.props.limit };
    },

    /**
     *
     */
    render: function(){
        console.log('render: props.limit=' + this.props.limit + ', state.limit=' + this.state.limit);

        var choices = [];
        [10, 20, 50, 100, 250, 500].forEach(function(limit, i, arr){                
            if(limit === this.state.limit){
                choices.push(<li><a href="#"><b>{limit}</b></a></li>);

            } else {
                choices.push(<li><a href="#" onClick={this.handleClick} data-limit={limit}>{limit}</a></li>);
            }

            if(this.props.fitment > limit && (i == arr.length - 1 || this.props.fitment < arr[i+1])){
                choices.push(<li><a href="#" onClick={this.handleClick} data-limit={this.props.fitment}>{this.props.fitment} (fit to page)</a></li>);
            }
        }.bind(this));

        return(
            <div id={this.props.id} className="dropdown">
                <button className="btn btn-default dropdown-toggle" type="button" id="dropdownMenu1" data-toggle="dropdown" aria-haspopup="true" aria-expanded="true">{this.state.limit} rows/pg<span className="caret"></span></button>
                <ul className="dropdown-menu" aria-labelledby="dropdownMenu1">{choices}</ul>
            </div>
        );
    },

    /**
     *
     */
    componentDidMount: function(){

    },

    /**
     *
     */
    componentWillReceiveProps: function(newProps){
        console.log('CWRP: newProps.limit=' + newProps.limit + ', props.limit=' + this.props.limit + ', state.limit=' + this.state.limit);
        this.setState({ limit: newProps.limit });
    },

    /**
     *
     */
    handleClick: function(e){
        var newLimit = parseInt(e.currentTarget.getAttribute('data-limit'));
        console.log('handleClick: newLimit=' + newLimit + ', props.limit=' + this.props.limit + ', state.limit=' + this.state.limit);

        this.setState({ limit: newLimit });
        this.props.onSelection(newLimit);
    }
});



/**
 * "Show search" button in the TabMenuBar component
 */
var ShowSearchButton = React.createClass({
    render: function(){
        return(
            <button 
                id={this.props.id}
                type="button"
                className="btn btn-default btn-xs" 
                onClick={this.props.onClickEvent}
                aria-expanded="false">
                <span className="glyphicon glyphicon-chevron-down" aria-hidden="true"></span>
                <span className="hidden-sm hidden-xs">Show search</span>
            </button>
        );
    }
});


/**
 * TableView Component
 * 
 * Responsible for drawing the table results view
 *
 * @param  {object}   props.result   - Result object returned by the server
 * @param  {bool}     props.visible  - Are we visible?
 */ 
var TableView = React.createClass({
    //
    render: function(){
        // Don't render anything when hidden
        if(! this.props.visible){
            return false;
        }

        // Build header
        var tableHeadCells = [];
        for(var i in window.visibleColumns){
            var name = window.visibleColumns[i].name;
            var label = window.visibleColumns[i].label;
            tableHeadCells.push(
                <th key={name} data-columnName={name}>
                    {label}
                </th>
            );
        }
        
        // Build body
        var tableBodyRows = [];
        for(var i in this.props.result.docs){
            var vehicle = VehicleDataApp.translateVehicle(this.props.result.docs[i], 'en');

            var tableBodyCells = [];
            for(var j in window.visibleColumns){
                var colName = window.visibleColumns[j].name;
                var key = vehicle + '.' + colName;
                
                tableBodyCells.push(
                    <td key={key} 
                        data-vehicleId={vehicle.id} 
                        data-columnName={colName}>
                        {vehicle[colName]}
                    </td>
                );
            }

            tableBodyRows.push(<tr key={vehicle.id} data-vehicleId={vehicle.id}>{tableBodyCells}</tr>);
        }

        // Put it all together
        return(
            <div id="vehicle_table_row" className="row">
                <div className="col-md-12">
                    <div id="vehicle_table_container">
                        <table id="vehicle_table" className="table table-striped table-condensed">
                            <thead><tr>{tableHeadCells}</tr></thead>
                             <tbody>{tableBodyRows}</tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    },

    //
    componentDidMount: function(){
    },

    //
    componentDidUpdate: function(prevProps, prevState){
        // Fix the headers in place
        jQuery('#vehicle_table').stickyTableHeaders({ 
            scrollableArea: jQuery("#vehicle_table_container")[0], 
            fixedOffset: 2 
        });
    }
});



/**
 * Map result view - TBD 
 */ 
var MapView = React.createClass({
    render: function(){
        return(
      <div id="vehicle_map_row" className="row">
        <div className="">
          <div id="vehicle_map_container"> .... </div>
        </div>
      </div>
        );
    }
});


/**
 * Main Footer
 */ 
var MainFooter = React.createClass({
    render: function(){
        return(
            <div id="footer_row" className="row">
                <div className="col-md-2"><a href="http://www.vehicledata.fi/">vehicledata.fi</a></div>
                <div className="col-md-3">Info: <a href="http://ppar.github.io/trafi-opendata/">http://ppar.github.io/trafi-opendata/</a></div>
                <div className="col-md-2"></div>
                <div className="col-md-5">
                    <div >This service contains <a target="_blank" href="http://www.trafi.fi/en/services/open_data">Trafi Open Data for Vehicles 4.5</a>, licensed under <a target="_blank" href="https://creativecommons.org/licenses/by/4.0/">CC 4.0</a>.
                    </div>
                </div>
            </div>
        );
    }
});

/**
 * Start the application
 */
jQuery(document).ready(function(){
    ReactDOM.render(<BootLoader/>, document.getElementById('react_vehicledata_app'));
});

