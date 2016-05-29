#!/usr/bin/python3 -Werror

#
# Imports a raw CSV file from trafi.fi 
#

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

LF = "\n"
TAB = "\t"

#
INTCOLS = {}
FLOATCOLS = {}
MARTIAN_ENUMS = {}
metadata = None
dbConn = None
dbCursor = None
startTime = None

options = {
    'outputTarget': 'stdout',
    
    'dropTable': True,
    'createTable': True,
    'createIndexes': False,
    'dbEngine': 'aria',
    
    'insertData': False, 

    'csvFileName': 'AvoinData 4.5.csv',
    'metadataFileName': 'metadata.json',

    'dbServer': 'localhost',
    'dbUser': 'trafi_opendata',
    'dbPass': 'trafi_opendata',
    'dbName': 'trafi_opendata'

    'debug': False
}

#
def stripComma(str):
    return re.sub(', $', '', str);

#
def incrementIntCols(key):
    if key in INTCOLS:
        INTCOLS[key] += 1
    else:
        INTCOLS[key] = 1
#
def incrementFloatCols(key):
    if key in FLOATCOLS:
        FLOATCOLS[key] += 1
    else:
        FLOATCOLS[key] = 1
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
def getCreateTableVehicle():
    global metadata, dbConn, dbCursor, startTime, options 
    
    sql = ''
    sql += 'DROP TABLE IF EXISTS vehicle;' + LF
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
            sql +=  ' CHAR(255) CHARACTER SET utf8 COLLATE utf8_bin DEFAULT NULL, '  + LF
                                    
        elif colDesc['type'] == 'enum':
            sql +=  ' ENUM(' + LF
            for enumVal in colDesc['enum']:
                sql += "\t\t" + '\'' + enumVal['key'] + '\', ' + LF
            sql = stripComma(sql)
            sql += TAB + ') CHARACTER SET utf8 COLLATE utf8_bin DEFAULT NULL, '  + LF

        else:
            raise Exception('Unknown column type ' + colDesc['type'])

        #sql += LF

    #sql = stripComma(sql)
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
    
    sql += ') ENGINE=' + options['dbEngine'] + ' DEFAULT CHARSET=utf8; ' + LF

    return sql

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

    elapsedTime = time.time() - startTime
    print("Inserted %d records, in %f seconds, last jarnro was %s" % (count, elapsedTime, lastJarnro), file=sys.stderr)
    print("INTCOLS", file=sys.stderr)
    print(INTCOLS, file=sys.stderr)
    print("FLOATCOLS", file=sys.stderr)
    print(FLOATCOLS, file=sys.stderr)
    print("MARTIAN_ENUMS", file=sys.stderr)
    print(MARTIAN_ENUMS, file=sys.stderr)

    
def usage(argv):
    global options
    print("USAGE: %s [optname=optval] [optname=optval] ..." % argv[0], file=sys.stderr)
    print("Where options and their defaults are:", file=sys.stderr)
    for o in options:
        print(("    " + o + "=" + str(options[o])), file=sys.stderr)
    print("outputTarget can be eitehr 'db' or 'stdout'", file=sys.stderr)
    sys.exit(1)
#           
def main(argv):
    global metadata, dbConn, dbCursor, startTime, options 

    # Command line options
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

    if options['insertData']:
        # Open CSV file
        # The data seems to be Latin-1 encoded and ';'-delimited, with no quotes for strings
        csvFile = open(options['csvFileName'], newline='', encoding='latin1')
        csvReader = csv.DictReader(csvFile, restkey='_overflow', restval='_missing', delimiter=';')

    # Read in data types from metadata.json
    metadata = json.loads(open(options['metadataFileName']).read())
    
    # Connect
    if options['outputTarget'] == 'db':
        dbConn = pymysql.connect(host = options['dbServer'],
                                user =  options['dbUser'],
                                passwd = options['dbPass'],
                                db = options['dbName'])
        dbCursor = dbConn.cursor()

    if options['dropTable']:
        # With "-Werror", this will cause a bogus error about the vehicle table missing
        try:
            outputSql('DROP TABLE IF EXISTS vehicle', [])
        except Warning as w:
            print("While dropping table, ignored warning:", file=sys.stderr)
            print(w, file=sys.stderr)
                
    if options['createTable']:
        outputSql(getCreateTableVehicle(), [])
    
    if options['insertData']:
        insertVehicleData(csvReader)
    
#
main(sys.argv)

