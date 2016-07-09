# MySQL import

```sql
> CREATE DATABASE trafi_opendata;
> GRANT ALL ON trafi_opendata.* to 'trafi_opendata'@'localhost' IDENTIFIED BY 'trafi_opendata';
> FLUSH PRIVILEGES:
```
 
## Database size

InnoDB table without indexes (except for primary key):

```
841M    /var/lib/mysql/trafi_opendata/vehicle.ibd
```

InnoDB table with indexes:

```
3.4G    /var/lib/mysql/trafi_opendata/vehicle.ibd
```

## Option 1: Precompiled SQL files

```bash
curl -O http://ppar-trafi-opendata.s3-website-eu-west-1.amazonaws.com/vehicles/4.5/mysql/sql/vehicle-001-drop-table.sql
curl -O http://ppar-trafi-opendata.s3-website-eu-west-1.amazonaws.com/vehicles/4.5/mysql/sql/vehicle-002-create-table.sql
curl -O http://ppar-trafi-opendata.s3-website-eu-west-1.amazonaws.com/vehicles/4.5/mysql/sql/vehicle-003-insert-data.sql.gz
curl -O http://ppar-trafi-opendata.s3-website-eu-west-1.amazonaws.com/vehicles/4.5/mysql/sql/vehicle-004-add-indexes.sql
```

vehicle-003-insert-data.sql.gz is 547 MB (3.4 GB uncompressed)

```bash
$ cat  vehicle-001-drop-table.sql     | mysql [...] 
$ cat  vehicle-002-create-table.sql   | mysql [...]
$ zcat vehicle-003-insert-data.sql.gz | mysql [...]
$ cat  vehicle-004-add-indexes.sql    | mysql [...]
```

## Option 2: Native dataset from TraFi

Requirements

```bash
apt-get install python3-pymysql
```

Download data (~ 250 MB zipped)

```bash
$ ./tools/download-trafi-data.sh
$ unzip rawdata/4.5/160407_Ajoneuvot_4.5.zip
```

Create SQL dumps

```bash
./tools/csv2sql.py dropTable=true   > vehicle-001-drop-table.sql
./tools/csv2sql.py createTable=true > vehicle-002-create-table.sql
./tools/csv2sql.py insertData=true  | gzip -c -1 > vehicle-003-insert-data.sql.gz
./tools/csv2sql.py addIndexes=true  > vehicle-004-add-indexes.sql
```

Import SQL dumps as above

## Option 3: Binary InnoDB tables

If you're so inclined

http://ppar-trafi-opendata.s3-website-eu-west-1.amazonaws.com/vehicles/4.5/mysql/innodb/var_lib_mysql.tar.gz


# MongoDB import

Note: MongoDB support is incomplete; MongoDB performance is unacceptable

Requirements
```bash
# apt-get install python3-pymongo
```

Download data (~ 250 MB zipped)

```
$ ./tools/download-trafi-data.sh
$ unzip rawdata/4.5/160407_Ajoneuvot_4.5.zip
```

Import it. Note: the this will consume 14+ GB under /var/lib/mongodb !

```
$ ./tools/csv2mongodb  'AvoinData 4.5.csv' trafi_opendata vehicles
$ ./tools/createmongoindexes.py metadata.json trafi_opendata vehicles
```

