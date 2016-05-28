#!/usr/bin/python3 -Werror

#
# Imports a raw CSV file from trafi.fi 
#
#
# USAGE: csv.py <source.csv> <metadata.json> 
#        csv.py rawdata/4.5/unzipped/AvoinData\ 4.5.csv metadata.json trafi_opendata vehicles

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

debug = False

LF = "\n"
TAB = "\t"

INTCOLS = {}
FLOATCOLS = {}
MARTIAN_ENUMS = {}

def stripComma(str):
    return re.sub(', $', '', str);

def getCreateTableVehicle(metadata):
    sql = ''
    sql += 'DROP TABLE IF EXISTS vehicle;' + LF
    sql = 'CREATE TABLE vehicle ('  + LF
    sql += TAB + 'id' + " " + 'INT(10) unsigned NOT NULL AUTO_INCREMENT, '  + LF

    # Column definitions
    for colName, colDesc in metadata['vehicles']['columns'].items():
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
            sql +=  ' VARCHAR(255) CHARACTER SET utf8 COLLATE utf8_bin DEFAULT NULL, '  + LF
                                    
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
    for colName, colDesc in metadata['vehicles']['columns'].items():
        sql += TAB + 'INDEX ' + colName + ' (' + colName + '), ' + LF
        
    sql = stripComma(sql)
    sql += LF
    
    sql += ') ENGINE=InnoDB DEFAULT CHARSET=utf8; ' + LF

    return sql


def incrementIntCols(key):
    if key in INTCOLS:
        INTCOLS[key] += 1
    else:
        INTCOLS[key] = 1

def incrementFloatCols(key):
    if key in FLOATCOLS:
        FLOATCOLS[key] += 1
    else:
        FLOATCOLS[key] = 1

def checkEnum(metadata, key, val):
    for e in metadata['vehicles']['columns'][key]['enum']:               
        if e['key'] == val:
            return True
        
    if not key in MARTIAN_ENUMS:
        MARTIAN_ENUMS[key] = set()

    print("Martian ENUM: %s in %s" % (val, key))
    MARTIAN_ENUMS[key].add(val)
    return False

#
def getInsertVehicle(metadata, csvRecord):
    if debug:
        print("----------------------------------------")
        print("CSV RECORD\n")
        print()
        print(csvRecord)
        print()

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
            sql += TAB + key + '_UPPER = %s, ' + LF
            sqlValues.append(val.upper())
            
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

    if debug:
        print("SQL:\n")
        print()
        print(sql)
        print()
        
    return sql, sqlValues
    
#           
def main(argv):
    csvFileName = argv[1]
    metadataFileName = argv[2]
    dbName = argv[3]

    startTime = time.time()
    
    # Open CSV file
    # The data seems to be Latin-1 encoded and ';'-delimited, with no quotes for strings
    csvFile = open(csvFileName, newline='', encoding='latin1')
    csvReader = csv.DictReader(csvFile, restkey='_overflow', restval='_missing', delimiter=';')

    # Read in data types from metadata.json
    metadata = json.loads(open(metadataFileName).read())
    
    # Connect
    dbConn = pymysql.connect(host = 'localhost',
                            user = 'trafi_opendata',
                            passwd = 'trafi_opendata',
                            db = dbName)

    sql = None
    sqlValues = []
    count = 0
    lastJarnro = None
    
    try:
        with dbConn.cursor() as cursor:
            sql = 'DROP TABLE IF EXISTS vehicle'
            cursor.execute(sql)
            dbConn.commit()

            sql = getCreateTableVehicle(metadata)
            cursor.execute(sql)
            dbConn.commit()

            # Run INSERTs (one at a time, because a huge single-statement insert would timeout)
            for csvRecord in csvReader:
                sql = sqlValues = None
                
                # Sanity check to confirm number of imported records
                if None != lastJarnro and (int(lastJarnro) + 1 != int(csvRecord['jarnro'])):
                    print("WARNING: at count=%d, non-consequtive change in jarnro from %s to %s" %
                        (count, lastJarnro, csv), file=sys.stderr)
                lastJarnro = csvRecord['jarnro']

                # Get inset clause
                sql, sqlValues = getInsertVehicle(metadata, csvRecord)

                # Insert
                if True:
                    try:
                        cursor.execute(sql, sqlValues)
                    except Warning as w:
                        print('cursor.execute warning')
                        print(w)
                    
                    # Commit 
                    try:
                        dbConn.commit()
                    except Warning as w:
                        print('conn.commit warning')
                        print(w)
                    
                count += 1
    
    except Exception as e:
        print("ERROR while inserting CSV record %d" % count)
        print("CSV Record:")
        print(csvRecord)
        print()
        print("SQL:")
        print(sql)
        print()
        print("SQLVALUES:")
        print(sqlValues)
        print()
        print("EXCEPTION:")
        raise(e)

    elapsedTime = time.time() - startTime
    print("Inserted %d records, in %f seconds, last jarnro was %s" % (count, elapsedTime, lastJarnro))
    print("INTCOLS")
    print(INTCOLS)
    print("FLOATCOLS")
    print(FLOATCOLS)
    print("MARTIAN_ENUMS")
    print(MARTIAN_ENUMS)
    
#
main(sys.argv)

