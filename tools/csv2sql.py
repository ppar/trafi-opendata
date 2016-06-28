#!/usr/bin/python3 -Werror

# 
# SQL schema creation and data import script.
#
# Reads metadata.json and the Trafi CSV dump and generates SQL 
# CREATE TABLE and INSERT statements. Either prints SQL to stdout
# or executes them directly on a MySQL server.
#
# Performs sanity checks on CSV data by checking ENUM values against
# expected values and determining which number columns contain int
# vs. float values.
# 

# USAGE: ./tools/csv2sql.py [optname=optval] [optname=optval] ...
#
# Where options and their defaults are:
#
#     metadataFileName=metadata.json
#     csvFileName=AvoinData 4.5.csv
#     outputTarget=stdout
#     debug=False
#
#     dbEngine=aria
#     dbServer=localhost
#     dbName=trafi_opendata
#     dbUser=trafi_opendata
#     dbPass=trafi_opendata
#
#     dropTable=True
#     createTable=True
#     createIndexes=True
#     insertData=False
#
# outputTarget can be either 'db' or 'stdout'
 
### Modules #######################################################
from __future__ import print_function
import sys
import csv
import json
import datetime
import time
import re
#import MySQLdb
import pymysql.cursors
import pymysql


### Constants #####################################################
LF = "\n"
TAB = "\t"

### Globals #######################################################

# Used to keep track of differences between data definition from 
# Trafi and their actual data
INTCOLS = {}
FLOATCOLS = {}
MARTIAN_ENUMS = {}

# ./metadata.json
metadata = None

# DB params
dbConn = None
dbCursor = None
startTime = None

# Command line parameters and their defaults
options = {
    'outputTarget': 'stdout',
    
    'dropTable': True,
    'createTable': True,
    'createIndexes': True,
    #'dbEngine': 'aria',
    'dbEngine': 'InnoDB',
    
    'insertData': False, 

    'csvFileName': 'AvoinData 4.5.csv',
    'metadataFileName': 'metadata.json',

    'dbServer': 'localhost',
    'dbUser': 'trafi_opendata',
    'dbPass': 'trafi_opendata',
    'dbName': 'trafi_opendata',

    'debug': False
}

### Functions #####################################################

#
# Returns str with trailing ', ' removed
#
def stripComma(str):
    return re.sub(', $', '', str);

#
# Keeps track of which "number" columns are int
# 
def incrementIntCols(key):
    if key in INTCOLS:
        INTCOLS[key] += 1
    else:
        INTCOLS[key] = 1
#
# Keeps track of which "number" columns are float 
#
def incrementFloatCols(key):
    if key in FLOATCOLS:
        FLOATCOLS[key] += 1
    else:
        FLOATCOLS[key] = 1

#
# Keeps track of ENUM columns and their values
#
# Records unexpected ENUM values in MARTIAN_ENUMS, so they can be added
# to the metadata definition
#
def checkEnum(metadata, key, val):
    for e in metadata['vehicles']['columns'][key]['enum']:               
        if e['key'] == val:
            return True
        
    if not key in MARTIAN_ENUMS:
        MARTIAN_ENUMS[key] = set()

    print("Martian ENUM: %s in %s" % (val, key), file=sys.stderr)
    MARTIAN_ENUMS[key].add(val)
    return False

#
# Reads metadata and retuns SQL schema as a CREATE TABLE statement
#
def getCreateTableVehicle():
    global metadata, dbConn, dbCursor, startTime, options 
    
    sql = 'CREATE TABLE vehicle ('  + LF
    sql += TAB + 'id' + " " + 'INT(10) unsigned NOT NULL AUTO_INCREMENT, '  + LF

    # Column definitions
    for colName, colDesc in metadata['vehicles']['columns'].items():
        if colName.endswith('_UPPER'):
            continue
        
        sql += TAB + colName + " "
        
        if colDesc['type'] == 'date':
            sql +=  ' DATE DEFAULT NULL, ' + LF
                    
        elif colDesc['type'] == 'number':
            # FIXME define integer fields properly
            if colName == 'kayttoonottovuosi':
                sql +=  ' INT(4) unsigned DEFAULT NULL, ' + LF
            elif colName == 'suurinNettoteho':
                sql +=  ' double unsigned DEFAULT NULL, ' + LF
            else:
                sql +=  ' INT(11) unsigned DEFAULT NULL, ' + LF
                                     
        elif colDesc['type'] == 'bool':
            sql +=  ' BOOLEAN DEFAULT NULL, ' + LF
            
        elif colDesc['type'] == 'string':
            sql +=  ' CHAR(255) CHARACTER SET utf8 COLLATE utf8_general_ci DEFAULT NULL, '  + LF
                                    
        elif colDesc['type'] == 'enum':
            sql +=  ' ENUM(' + LF
            for enumVal in colDesc['enum']:
                sql += "\t\t" + '\'' + enumVal['key'] + '\', ' + LF
            sql = stripComma(sql)
            sql += TAB + ') CHARACTER SET utf8 COLLATE utf8_general_ci DEFAULT NULL, '  + LF

        else:
            raise Exception('Unknown column type ' + colDesc['type'])

    sql += LF

    # Key definitions
    sql += TAB + 'PRIMARY KEY (id), ' + LF
    if options['createIndexes']:
        for colName, colDesc in metadata['vehicles']['columns'].items():
            if colName.endswith('_UPPER'):
                continue
            sql += TAB + 'INDEX ' + colName + ' (' + colName + '), ' + LF
        
    sql = stripComma(sql)
    sql += LF
    
    sql += ') ENGINE=' + options['dbEngine'] + ' DEFAULT CHARSET=utf8'

    return sql

#
# Returns an SQL INSERT statement for a single record in 'vehicle'
#
# @param   csvRecord   An object containing one CSV record's keys and values
#
# @return  A tuple consisting of 0) an SQL "INSERT INTO foo = %s ..." statement 
#          and 1) list of values to substitute in the SQL statement
#
def getInsertVehicle(csvRecord):
    global metadata, dbConn, dbCursor, startTime, options 

    if options['debug']:
        print("----------------------------------------", file=sys.stderr)
        print("CSV RECORD\n", file=sys.stderr)
        print('', file=sys.stderr)
        print(csvRecord, file=sys.stderr)
        print('', file=sys.stderr)

    sql = 'INSERT INTO vehicle SET ' + LF
    sqlValues = []
    
    for key, val in csvRecord.items():
        dataType = metadata['vehicles']['columns'][key]['type']
                
        if '' == val:
            continue
                               
        if 'kayttoonottopvm' == key:
            # Special case, can be YYYYMMDD or YYYY0000
            # Always store commission year (kayttoonottovuosi)
            # Only store commission date (kayttoonottopvm) if MMDD != 0000
            dataType = None
            dataFormat = None
            year, month, day = val[0:4], val[4:6], val[6:8]

            sql += TAB + 'kayttoonottovuosi = %s, ' + LF
            sqlValues.append(str(int(year)))
            
            if month == '00' or day == '00':
                continue
                    
            val = year + '-' + month + '-' + day
            dataType = 'date'
                
        if 'date' == dataType:
            # dates
            #year, month, day = val[0:4], val[5:7], val[8:10]
            #normRecord[key] = datetime.datetime(int(year), int(month), int(day))
            sql += TAB + key + ' = %s, ' + LF
            sqlValues.append(val)
            
        elif 'number' == dataType:
            # make sure it is a number
            try:
                _val = int(val)
                incrementIntCols(key)
                    
            except ValueError:
                _val = float(val.replace(',', '.'))
                incrementFloatCols(key)
                
            sql += TAB + key + ' = %s, ' + LF
            sqlValues.append(str(val))
            
        elif 'bool' == dataType:
            if True == val or 'true' == val.lower():
                sql += TAB + key + ' = 1, ' + LF
            else:
                sql += TAB + key + ' = 0, ' + LF

        elif 'string' == dataType:
            sql += TAB + key + ' = %s, ' + LF
            sqlValues.append(val)
            
            # Add sibling <colName>_UPPER field for string columns
            #sql += TAB + key + '_UPPER = %s, ' + LF
            #sqlValues.append(val.upper())
            
        elif 'enum' == dataType:
            if val == 'nul':
                # Trafi's data actually has such string values...
                continue
            
            if checkEnum(metadata, key, val):
                sql += TAB + key + ' = %s, ' + LF
                sqlValues.append(val)
            #else:
                #raise Exception('ENUM field "%s" does not cover value "%s"' % (key, val))
                
        else:
            raise Exception('Unknown data type: ' + dataType)

    sql = stripComma(sql)

    if options['debug']:
        print("SQL:\n", file=sys.stderr)
        print('', file=sys.stderr)
        print(sql, file=sys.stderr)
        print('', file=sys.stderr)
        
    return sql, sqlValues


#
# Output an SQL query to stdout or DB
#
# Escapes and formats the SQL query in (sql, sqlValues) and either prints it out or 
# executes it in the database.
#
# @param sql          SQL query string
# @param sqlValues    List of values to replace in 'sql'
#
def outputSql(sql, sqlValues):
    global metadata, dbConn, dbCursor, startTime, options 

    if options['outputTarget'] == 'stdout':
        escapedValues = []
        for v in sqlValues:
            escapedValues.append('\'' + re.sub('\'', '\\\'',  v) + '\'')
        print((sql + ';') % tuple(escapedValues))
                    
    elif options['outputTarget'] == 'db':
        try:
            dbCursor.execute(sql, sqlValues)
        except Warning as w:
            print('cursor.execute warning', file=sys.stderr)
            print(w, file=sys.stderr)
            print(sql, file=sys.stderr)
            print(sqlValues, file=sys.stderr)
                    
        # Commit 
        try:
            dbConn.commit()
        except Warning as w:
            print('conn.commit warning', file=sys.stderr)
            print(w, file=sys.stderr)
            print(sql, file=sys.stderr)
            print(sqlValues, file=sys.stderr)

#
# Generates INSERT statements for CSV data supplied by csvReader
#
# Either outputs statements to stdout or executes them in the DB
#
# @param csvReader   A csv.DictReader object that provides records from the CSV file
#
def insertVehicleData(csvReader):
    global metadata, dbConn, dbCursor, startTime, options 

    sql = None
    sqlValues = []
    count = 0
    lastJarnro = None
    
    try:
        # Run INSERTs (one at a time, because a huge single-statement insert would timeout)
        for csvRecord in csvReader:
            sql = sqlValues = None
                
            # Sanity check to confirm number of imported records
            if None != lastJarnro and (int(lastJarnro) + 1 != int(csvRecord['jarnro'])):
                print("WARNING: at count=%d, non-consequtive change in jarnro from %s to %s" %
                    (count, lastJarnro, csv), file=sys.stderr)
            lastJarnro = csvRecord['jarnro']

            # Get inset clause
            sql, sqlValues = getInsertVehicle(csvRecord)

            # Insert
            outputSql(sql, sqlValues)
            count += 1

            # Print out stats every 1000 rows
            if (count % 1000) == 0:
                elapsedTime = time.time() - startTime
                print("                                                                                 \r", file=sys.stderr, end='')
                print("Inserted %d records, in %f seconds, %f records/s\r" % (count, elapsedTime, count/elapsedTime), file=sys.stderr, end='')

    except Exception as e:
        print("ERROR while inserting CSV record %d" % count, file=sys.stderr)
        print("CSV Record:", file=sys.stderr)
        print(csvRecord, file=sys.stderr)
        print('', file=sys.stderr)
        print("SQL:", file=sys.stderr)
        print(sql, file=sys.stderr)
        print('', file=sys.stderr)
        print("SQLVALUES:", file=sys.stderr)
        print(sqlValues, file=sys.stderr)
        print("TUPLE(SQLVALUES):", file=sys.stderr)
        print(tuple(sqlValues), file=sys.stderr)
        print('', file=sys.stderr)
        print("EXCEPTION:", file=sys.stderr)
        raise(e)

    # Print stats and sanity check data
    elapsedTime = time.time() - startTime
    print("Inserted %d records, in %f seconds, last jarnro was %s" % (count, elapsedTime, lastJarnro), file=sys.stderr)
    print("INTCOLS", file=sys.stderr)
    print(INTCOLS, file=sys.stderr)
    print("FLOATCOLS", file=sys.stderr)
    print(FLOATCOLS, file=sys.stderr)
    print("MARTIAN_ENUMS", file=sys.stderr)
    print(MARTIAN_ENUMS, file=sys.stderr)


#
# Print usage instruction and exit
#    
def usage(argv):
    global options
    print("USAGE: %s [optname=optval] [optname=optval] ..." % argv[0], file=sys.stderr)
    print("Where options and their defaults are:", file=sys.stderr)
    for o in options:
        print(("    " + o + "=" + str(options[o])), file=sys.stderr)
    print("outputTarget can be either 'db' or 'stdout'", file=sys.stderr)
    sys.exit(1)


#           
# Main function
#
def main(argv):
    global metadata, dbConn, dbCursor, startTime, options 

    # Process command line options
    for arg in argv[1:]:
        argsplit = arg.split('=')
        
        if len(argsplit) != 2:
            usage(argv)
        if not argsplit[0] in options:
            usage(argv)
            
        if argsplit[1].lower() == 'true':
            options[argsplit[0]] = True
        elif argsplit[1].lower() == 'false':
            options[argsplit[0]] = False
        else:
            options[argsplit[0]] = argsplit[1]
        
    startTime = time.time()

    # Open CSV file
    # The data seems to be Latin-1 encoded and ';'-delimited, with no quotes for strings
    if options['insertData']:
        csvFile = open(options['csvFileName'], newline='', encoding='latin1')
        csvReader = csv.DictReader(csvFile, restkey='_overflow', restval='_missing', delimiter=';')

    # Read in data types from metadata.json
    metadata = json.loads(open(options['metadataFileName']).read())
    
    # Connect to database
    if options['outputTarget'] == 'db':
        dbConn = pymysql.connect(host = options['dbServer'],
                                user =  options['dbUser'],
                                passwd = options['dbPass'],
                                db = options['dbName'])
        dbCursor = dbConn.cursor()

    # Generate header
    if options['outputTarget'] == 'stdout':
        print('-- ')
        print('-- Generated by ./tools/csv2sql.py')
        print('-- ')
        print('')

    # Generate DROP TABLE statement
    if options['dropTable']:
        # With "-Werror", this will cause a bogus error about the vehicle table missing
        try:
            outputSql('DROP TABLE IF EXISTS vehicle', [])
        except Warning as w:
            print("While dropping table, ignored warning:", file=sys.stderr)
            print(w, file=sys.stderr)
                
    # Generate CREATE TABLE statement
    if options['createTable']:
        outputSql(getCreateTableVehicle(), [])
    
    # Insert contents of CSV fle into database
    if options['insertData']:
        insertVehicleData(csvReader)
    
#
# Script body
#
main(sys.argv)

