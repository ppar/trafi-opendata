## Introduction

JSON API and a web interface for accessing open vehicle registration
data released by [http://www.trafi.fi/](Trafi), the Finnish Transport
Safety Agencey.


## Motivation

This is my first project using Node.js ~~and
[https://www.mongodb.com/](MongoDB)~~. I wrote this mostly
to teach myself these technologies, having more or less lived in PHP/MySQL
land previously. As such, the implementation choices and code should
be taken with a grain of salt.

## Implementation

The JSON API runs on Node.js andn [http://expressjs.com/](Express.js)
and has (rudimentary) support for MongoDB and MySQL/MariaDB backends.
MongoDB proved to have horrible performance during
development, even when with trivial queries over indexed fields, so
MySQL/MariaDB is the meaningful choice for the moment. 

The MongoDB backend uses [http://mongoosejs.com/](Mongoose) and
[https://github.com/edwardhotchkiss/mongoose-paginate](mongoose-paginate). 
The MySQL backend uses https://github.com/felixge/node-mysql .

Python scripts are used for importing and normalizing the data
provided by Trafi.

The WWW interface is built on Bootstrap, jQuery, the excellent
[http://querybuilder.js.org/demo.html](jQuery QueryBuilder),
[http://www.pontikis.net/labs/bs_grid/](bs_grid) datagrid and
a plethora of dependent JavaScript modules.


## Implementation issues
### Data
Importing the ~ 800 MB CSV file consumes ~ 8 GB in MongoDB, without
indexes. With single-column indexes, the database takes 12-14 GB.

Even with indexes in place, queries like

```
  { $and: [ { prop0: 'FOO' }, { prop0: 'BAR' } ] }
```

use seeking instead of indexes and take forever to execute. To add
insult to injury, MongoDB 2.6 can't explain() queries without
executing them first. MongoDB 3.x would seem to have a better explain()
feature without this problem. 

For comparison, when imported into a MariaDB/MySQL InnoDB table,
with all columns indexed and with shadow "foo_UPPER" columns added
(a workaround for of MongoDB's lack of case insensitive indexes),
the binary data takes only a "modest" 6 GB on disk.

### UI
Currently, the web UI is a mess of JavaScript. Some refactoring is
needed to make the code maintainable and neat.


## Data Set
Trafi publishes anonymized open data on registered land vehicles,
boats and ships. This project initially focuses on vehicle data.
For background, see

- http://www.trafi.fi/tietopalvelut/avoin_data
- http://www.trafi.fi/en/services/open_data

The provided data set presents some difficulties, such as:

Lack of "decommissioned" vehicles

- Only vehicles with "commissioned for road use" status are incuded
  in Trafi's quarterly data dump.
- It's common for e.g. owners of hobbyist vehicles to temporarily
  decommission their cars when they're not being used in order to
  save on insurance and taxes, so each released data set contains
  only a semi-random snapshot of the vehicles that in fact see regular
  use.
- Continuously merging all released data sets from Trafi would allow
  us to slightly improve coverage, but this is far from
  perfect. Because the data is anonymized, a method of identifying
  individual vehicles across datasets and avoiding duplicates would
  need to be developed.
- Ideally, Trafi should release more complete data sets: one with all
  known vehicles, and another one with all vehicles that have been
  road-commissioned e.g. within the last five years.

Data on vehicles makes and models is wildly inconsistent

- As a result of individual officials typing (and mistyping) entries
  into various registers over the course of several decades, there is no
  consistent way to identify vehicle brands and models in the data.
- Heuristics based on the model field and anonymized VIN numbers might
  help in normalizing the model fields.

Varying dates

- Earlier entries only contain the registration year, some entries
  contain no date fields, others a full date

## Ideas

- If identifying vehicles across data sets is doable, it would be
  interesting to bookmark your own vehicle and follow it's mileage,
  location and other data over time. This might be at odds with
  Trafi's goal of providing only anonymized data, although
  anonymization is meant to cover owners of vehicles, instead of the
  the vehicles themselves.
  
## Usage / installation instructions

### JSON API

Install platform packages

```
# apt-get install mariadb-{server,client} python3-pymysql
```

~~~apt-get install mongodb python3-pymongo~~~

```
# apt-get install nodejs npm
```

Download data (~ 250 MB zipped)

```
$ ./tools/download-trafi-data.sh
$ unzip rawdata/4.5/160407_Ajoneuvot_4.5.zip
```


#### MongoDB import

Import vehicle data (note: the this will consume 14+ GB under /var/lib/mongodb !)

```
$ ./tools/csv2mongodb  'AvoinData 4.5.csv' trafi_opendata vehicles
$ ./tools/createmongoindexes.py metadata.json trafi_opendata vehicles
```


#### MySQL Import

...

#### Node,s server
Pull in NPM packages, start the API

```
$ cd json-api
$ npm install
$ nodejs server.js
```

### WWW Interface

Install platform packages

```
# apt-get install nginx
# npm install bower
```

Pull in external dependencies

```
$ cd www
$ bower install
$ ./download-ext-deps.sh
```

Use www/conf/nginx_virtualhost.conf to set up a virtual host for the WWW interface and API

### Metadata

The API import scripts and the web UI use the files metadata.json and www/public/js/columns.json 
for schema information. Unless the schema changes, it's not necessary to regenerate these files.

These files are generated from tab-delimited text files under schema/vehicles/ , which in turn 
are created from individual sheets in sheets ./schema/17629-avoin_data_ajoneuvojen_luokitukset.numbers
(by copying the relevant cells in Numbers and pasting them to cat > foo.txt).

17629-avoin_data_ajoneuvojen_luokitukset.numbers is based on 17629-avoin_data_ajoneuvojen_luokitukset.xls
from Trafi, with additional data on data types, amended translations etc. 

To generate the JSON files, use the commands:

```
$ ./tools/genmeta.py schema/vehicles/_columns.txt schema/vehicles/ajoneuvoluokka.txt schema/vehicles/ajoneuvoryhma.txt schema/vehicles/ajoneuvonkaytto.txt schema/vehicles/vari.txt schema/vehicles/korityyppi.txt schema/vehicles/ohjaamotyyppi.txt schema/vehicles/kayttovoima.txt schema/vehicles/kunta.txt > metadata.json
$ ./tools/genuijson.py schema/vehicles/_columns.txt > www/public/js/columns.json
```


## Acknowledgements

The following tutorials and blog posts were vital in getting this
thing afloat.

- https://www.mongodb.com/blog/post/building-your-first-application-mongodb-creating-rest-api-using-mean-stack-part-1
- https://github.com/ctindel/reader/tree/master/api.old/v1.0

- http://singlepageappbook.com/
- https://blog.risingstack.com/node-hero-tutorial-getting-started-with-node-js/
- https://docs.mongodb.com/getting-started

## License

### Code
TBD. It's Open Source. I'm a coder, Jim, not a lawyer.

### Metadata

The files ./metadata.json, ./www/public/js/columns.json and all files under ./schema are derived 
from the "Description of data content" (17629-avoin_data_ajoneuvojen_luokitukset.xls) part of "Open 
data for vehicles 4.5", released by Trafi.fi on 8 th of April 2016 at 
http://www.trafi.fi/en/services/open_data  . The data is licensed under "Creative Commons Attribution 
4.0 International (CC BY 4.0)" license: http://creativecommons.org/licenses/by/4.0/deed.en
