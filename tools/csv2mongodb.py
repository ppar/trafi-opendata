#!/usr/bin/python3

#
# Imports a raw CSV file from trafi.fi into a MongoDB collection
#
# NOTE: Importing the ~800 MB set of vehicle data will grow your 
#       /var/lib/mongodb by about 8 GB. On a 2010, 2.4 GHz Core i5 it
#       will take about 75 min.
#
# USAGE: csv2mongodb.py <source.csv> <metadata.json> <dbname> <collectionname>
#        csv2mongodb.py rawdata/4.5/unzipped/AvoinData\ 4.5.csv metadata.json trafi_opendata vehicles

from __future__ import print_function
import sys
import csv
import json
import datetime
import time

from pymongo import MongoClient

debug = False

#           
def main(argv):
    csvFileName = argv[1]
    metadataFileName = argv[2]
    dbName = argv[3]
    collectionName = argv[4]

    startTime = time.time()
    
    # Open CSV file
    # The data seems to be Latin-1 encoded and ';'-delimited, with no quotes for strings
    csvFile = open(csvFileName, newline='', encoding='latin1')
    csvReader = csv.DictReader(csvFile, restkey='_overflow', restval='_missing', delimiter=';')

    # Read in data types from metadata.json
    metadata = json.loads(open(metadataFileName).read())

    # Open MongoDB connection
    mongoClient = MongoClient('mongodb://localhost:27017')
    mongoDb = mongoClient[dbName]
    collection = mongoDb[collectionName]

    count = 0
    lastJarnro = None
    try:
        for csvRecord in csvReader:
            if debug:
                print("----------------------------------------")
                print("CSV RECORD\n")
                print()
                print(csvRecord)
                print()

            # Sanity check to confirm number of imported records
            if None != lastJarnro and (int(lastJarnro) + 1 != int(csvRecord['jarnro'])):
                print("WARNING: at count=%d, non-consequtive change in jarnro from %s to %s" % (count, lastJarnro, csv))
            lastJarnro = csvRecord['jarnro']
            
            # Convert fields to their correct data types
            normRecord = {}
            for key, val in csvRecord.items():
                dataType = metadata['vehicles']['columns'][key]['type']
                
                if '' == val:
                    normRecord[key] = None
                    continue
                               
                if 'kayttoonottopvm' == key:
                    # Special case, can be YYYYMMDD or YYYY0000
                    # Always store commission year (kayttoonottovuosi)
                    # Only store commission date (kayttoonottopvm) if MMDD != 0000
                    dataType = None
                    dataFormat = None
                    year, month, day = val[0:4], val[4:6], val[6:8]
                    normRecord['kayttoonottovuosi'] = int(year)
                    
                    if month == '00' or day == '00':
                        continue
                    
                    val = year + '-' + month + '-' + day
                    dataType = 'date'
                        
                if 'date' == dataType:
                    # dates
                    year, month, day = val[0:4], val[5:7], val[8:10]
                    normRecord[key] = datetime.datetime(int(year), int(month), int(day))
                    
                elif 'number' == dataType:
                    try:
                        normRecord[key] = int(val)
                    except ValueError:
                        # Nasty
                        normRecord[key] = float(val.replace(',', '.'))
                    
                elif 'bool' == dataType:
                    normRecord[key] = (True == val or 'true' == val.lower())

                elif 'string' == dataType:
                    normRecord[key] = val
                    # Add sibling <colName>_UPPER field for string columns
                    normRecord[key + '_UPPER'] = val.upper()
                    
                elif 'enum' == dataType:
                    normRecord[key] = val
                    
                else:
                    # enums and strings
                    normRecord[key] = val

            if debug:
                print("NORMALIZED RECORD\n")
                print()
                print(normRecord)
                print()

            count += 1
            insertedId = collection.insert_one(normRecord).inserted_id

    except Exception as e:
        print("ERROR while inserting CSV record %d" % count)
        print("CSV Record:")
        print()
        print(csvRecord)
        print()
        print("Normalized record:")
        print()
        print(normRecord)
        print()
        raise(e)

    elapsedTime = time.time() - startTime
    print("Inserted %d records, in %f seconds, last jarnro was %s" % (count, elapsedTime, lastJarnro))


#
main(sys.argv)

