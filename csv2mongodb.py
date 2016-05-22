#!/usr/bin/python3

#
# Imports a raw CSV file from trafi.fi into a MongoDB collection
#
# NOTE: Using this script's current form (all fields casted to strings), 
#       importing the ~800 MB set of vehicle data will grow your 
#       /var/lib/mongodb by 8-10 GB !
#
# USAGE: csv2mongodb.py <source.csv> <dbname> <collectionname>
#        csv2mongodb.py rawdata/4.5/unzipped/AvoinData\ 4.5.csv trafi_opendata vehicles

from __future__ import print_function
import sys
import csv

from pymongo import MongoClient

debug = False

#           
def main(argv):
    csvFileName = argv[1]
    dbName = argv[2]
    collectionName = argv[3]

    # The data seems to be Latin-1 encoded and ';'-delimited, with no quotes for strings
    csvFile = open(csvFileName, newline='', encoding='latin1')
    csvReader = csv.DictReader(csvFile, restkey='_overflow', restval='_missing', delimiter=';')

    mongoClient = MongoClient('mongodb://localhost:27017')
    mongoDb = mongoClient[dbName]
    collection = mongoDb[collectionName]

    count = 0
    try:
        for csvRecord in csvReader:
            if debug:
                print("----------------------------------------")
                print("CSV RECORD\n")
                print(csvRecord)

            count += 1
            insertedId = collection.insert_one(csvRecord).inserted_id

    except Exception as e:
        print("ERROR while inserting CSV record %d" % count)
        print("CSV Record:")
        print(csvRecord)
        print("Exception:")
        print(e)
#
main(sys.argv)

