
/**
 * Main Application Class
 *
 */
var VehicleDataApp = React.createClass({
    render: function(){
        return(
            <div>
                <ProgressBar/>
                <div id="maincontainer" className="container-fluid">
                    <MainHeader/>
                    <AdvancedSearch/>
                    <TabMenuBar/>
                    <TableResult/>
                    <MapResult/>
                    <MainFooter/>
                </div>
            </div>
        );
    }
});

/**
 * Progress bar, fixed position at the top edge 
 */
var ProgressBar = React.createClass({
    render: function(){
        return(
            <div id="query_progress" className="progress">
                <div className="progress-bar progress-bar-striped active" role="progressbar" 
                     aria-valuenow="5" aria-valuemin="0" aria-valuemax="100" style={{width: '45%'}} >
                    <span className="sr-only"></span>
                </div>
            </div>
        );
    }
});

/**
 * Main Header
 */ 
var MainHeader = React.createClass({
    render: function(){
        return(
            <div id="navbar_row" className="row">
                <div className="col-md-12">
                    <nav className="well well-sm">vehicledata.fi</nav>
                </div>
            </div>
        );
    }
});

/**
 * Advanced Search UI
 */ 
var AdvancedSearch = React.createClass({
    render: function(){
        return(
            <div id="search_ui_row" className="row search_ui">
                <div className="col-md-11 col-sm-11 col-xs-10">
                    <div id="search_ui_scroll_container">
                        <QueryBuilder/>
                    </div>
                </div>

                <div id="search_button_col" className="col-md-1 col-sm-1 col-xs-2">
                    <div id="search_button_container_rel" style={{'position': 'relative', 'height': '50px'}}>
                        <div style={{'position': 'absolute', 'top': '0px', 'right': '0px'}} >
                            <button type="button"  id="search_ui_hide_btn" 
                                    className="btn btn-default btn-xs" aria-expanded="false">
                                <span className="glyphicon glyphicon-minus" aria-hidden="true"></span>
                                Hide search
                            </button>
                        </div>

                        <div id="search_button_container_abs" 
                             style={{'position': 'absolute', 'bottom': '0px', 'right': '0px'}} >
                            <button id="execute_search" type="button" 
                                     className="btn btn-default btn-sm btn-block" aria-expanded="false"
                            >Search</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
});

/**
 * QueryBuilder widget in the Advanced Search
 */
var QueryBuilder = React.createClass({
    render: function(){
        return(
            <div id="search_ui"></div>
        );
    }
});


/**
 * Tab Bar between Search UI and Results
 */ 
var TabMenuBar = React.createClass({
    render: function(){
        return(
            <div id="result_tab_row" className="row">
              <div className="col-md-2">
                <ul className="nav nav-tabs">
                  <li role="presentation" className="active tab_table"><a className="tab_button tab_table" href="">Table</a></li>
                  <li role="presentation" className="disabled //tab_map"><a className="tab_button //tab_map" href="">Map</a></li>
                </ul>
              </div>

              <div className="col-md-2" id="result_stats"></div>
              <div className="col-md-7">

                <div id="result_controls_table">
                  <nav>
                    <ul id="table_pagination" className="pagination">
                    </ul>
                  </nav>
                </div>
      

                <div id="result_controls_map" style={{'display': 'none'}}>
                  ...
                </div>
              </div>
              <div className="col-md-1" id="">
                <div style={{'position': 'absolute', 'top': '0px', 'right': '0px'}} >
                  <button type="button" id="search_ui_show_btn" style={{'display': 'none'}}
                          className="btn btn-default btn-xs" aria-expanded="false">
                    <span className="glyphicon glyphicon-chevron-down" aria-hidden="true"></span>
                    Show search
                  </button>
                </div>
              </div>
            </div>
        );
    }
});

/**
 * Tabld result view
 */ 
var TableResult = React.createClass({
    render: function(){
        return(
      <div id="vehicle_table_row" className="row">
        <div className="col-md-12">
          <div id="vehicle_table_container"></div>
        </div>
      </div>
        );

    }
});


/**
 * Map result view
 */ 
var MapResult = React.createClass({
    render: function(){
        return(
      <div id="vehicle_map_row" className="row" style={{'display': 'none'}} >
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
 * Render the application
 */
ReactDOM.render(
    <VehicleDataApp/>,
    document.getElementById('react_vehicledata_app')
);

