jQuery(document).ready(function(){

    fields =  ['ajoneuvoluokka' ,
                  'ensirekisterointipvm',
                  'ajoneuvoryhma',
                  'ajoneuvonkaytto',
                  'variantti',
                  'versio',
                  'kayttoonottopvm',
                  'vari',
                  'ovienLukumaara',
                  'korityyppi',
                  'ohjaamotyyppi',
                  'istumapaikkojenLkm',
                  'omamassa',
                  'teknSuurSallKokmassa',
                  'tieliikSuurSallKokmassa',
                  'ajonKokPituus',
                  'ajonLeveys',
                  'ajonKorkeus',
                  'kayttovoima',
                  'iskutilavuus',
                  'suurinNettoteho',
                  'sylintereidenLkm',
                  'ahdin',
                  'sahkohybridi',
                  'merkkiSelvakielinen',
                  'mallimerkinta',
                  'vaihteisto',
                  'vaihteidenLkm',
                  'kaupallinenNimi',
                  'voimanvalJaTehostamistapa',
                  'tyyppihyvaksyntanro',
                  'yksittaisKayttovoima',
                  'kunta',
                  'Co2',
                  'matkamittarilukema',
                  'alue',
                  'valmistenumero2',
                  'jarnro' 
                ];

    //
    for(i in fields){
        jQuery('#vehicle_table thead tr').append('<th data-column-id="' + fields[i] + '">' + fields[i] + '</th>');

    }

    //
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
            return response; 
        },

        row_primary_key: "_id",

        useFilters: false,
        rowSelectionMode: false,
        showSortingIndicator: true,
        showSortingMenuButton: false,
        useSortableLists: false

        /***
        sorting: [
            {sortingName: "Code", field: "customer_id", order: "none"},
            {sortingName: "Lastname", field: "lastname", order: "ascending"},
            {sortingName: "Firstname", field: "firstname", order: "ascending"},
            {sortingName: "Date updated", field: "date_updated", order: "none"}
        ],
        ****/

    };
 
    bsGridOptions.columns = [];
    for(i in fields){
        var visible = false;
        switch(fields[i]){
            case 'merkkiSelvakielinen':
            case 'ajoneuvoryhma':
            case 'kunta':
            case 'ensirekisterointipvm':
            case 'mallimerkinta':
            visible = 'yes';
            ;;
        }
        bsGridOptions.columns.push({
            field: fields[i],
            header: fields[i],
            visible: visible
        });
    }

    jQuery("#vehicle_table").bs_grid(bsGridOptions);
});




/******************
    jQuery("#vehicle_table").bootgrid({

        // selection: false,
        // rowSelect: false,
        search: false,

        ajax: true,
        ajaxSettings: {
            method: 'GET'
        },

        url: '/api/v1.0/vehicles/listPaged',

        requestHandler: function(origReq){
            console.log('requestHandler: request:');
            console.log(origReq);
            
            var newReq = {
                page: origReq.current,
                limit: origReq.rowCount,

                // sort[col]
                // searchPhrase
                
                resultParamPage: 'current',
                resultParamLimit: 'rowCount',
                resultParamDocs: 'rows',
                resultParamTotal: 'total'
            };

            return newReq;
        },

        responseHandler: function(response){
            console.log('responseHandler: response:');
            console.log(response);
            delete response.pages;

            return response;
        },

        formatters: {
            "link": function(column, row)
            {
            return "<a href=\"#\">" + column.id + ": " + row.id + "</a>";
            }
        }
    });
    

******************/


/*****************


    /*});
      jQuery(document).ready(function(){
    */
    
    // Map Dynatable's JSON parameter names to the JSON format returned
    // by our API, i.e. the format returned by 'mongoose-paginate'
    /**
    jQuery.dynatableSetup({
        features: {
            search: false
        },
        
        table: {
        },

        params: {
            // No idea
            //dynatable: 'dynatable',

            // Name (prefix) of HTTP GET parameter issued by Dynatable when
            // retrieving a page of data from the server.
            // queries[search]=fuu+bar
            //queries: 'queries',

            // Name (prefix) of HTTP GET parameter issued by Dynatable when
            // retrieving a page of data from the server. Specifies the names 
            // of columns by which the data should be sorted. Format is an 
            // array like:
            //    sorts = { mysortcol: '1', anothersortcol: '1' }
            // serialized into a set of GET parameters:
            //    sorts[mysortcol] = '1'
            //    sorts[anothersortcol] = '1'
            // sorts: 'sorts'

            ////////////////////////

            // Name of HTTP GET parameter issued by Dynatable when retrieving a
            // page of data from the server. Specifies the page number the
            // server should return. Pages are numbered from 1.
            // It seems impossible to prevent dynatable from sending this parameter.
            page: 'options.page',
            
            // Name of HTTP GET parameter issued by Dynatable when retrieving a
            // page of data from the server. Specifies the number of results
            // the server should return per page.
            perPage: 'options.limit',

            // Name of HTTP GET parameter issued by Dynatable when retrieving a
            // page of data from the server. Specifies the offset ( = number of
            // result rows to skip). Equals ( [page_number - 1] * [page_size]).
            // It seems impossible to prevent dynatable from sending this parameter.
            offset: 'options.offset',

            ////////////////////////
            
            // Name of property in the JSON response returned by the server. This
            // property contains the result rows as an array of JSON objects.
            records: 'docs',
            
            // Name of property in the JSON response returned by the server. This
            // property contains the total number of result rows in the database for
            // this query (after filtering, if any).
            queryRecordCount: 'total',

            // Name of property in the JSON response returned by the server. This
            // property contains the total number of rows in the database (without
            // any filtering applied). Set to null if the server doesn't return this.
            totalRecordCount: null
            
        }
        

    });

    // Call dynatable
    jQuery('#vehicle_table').dynatable({
        dataset: {
            ajax: true,
            ajaxUrl: '/api/v1.0/vehicles/list',
            ajaxOnLoad: true,
            records: []
        }
    });

    **********************/
    

