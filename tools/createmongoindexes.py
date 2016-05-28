#!/usr/bin/python3

#
# Imports a raw CSV file from trafi.fi into a MongoDB collection
#
# NOTE: Importing the ~800 MB set of vehicle data will grow your 
#       /var/lib/mongodb by about 8 GB. On a 2010, 2.4 GHz Core i5 it
#       will take about 75 min.
#
# USAGE: createmongoindexes.py <metadata.json> <dbname> <collectionname>
#        createmongoindexes.py metadata.json trafi_opendata vehicles

from __future__ import print_function
import sys
import time
import json

from pymongo import MongoClient

debug = False

#           
def main(argv):
    metadataFileName = argv[1]
    dbName = argv[2]
    collectionName = argv[3]

    startTime = lapTime = time.time()
    count = 0
    
    # Read in data types from metadata.json
    metadata = json.loads(open(metadataFileName).read())

    # Open MongoDB connection
    mongoClient = MongoClient('mongodb://localhost:27017')
    mongoDb = mongoClient[dbName]
    collection = mongoDb[collectionName]

    #print(metadata)
    for key, val in metadata['vehicles']['columns'].items():
        if key.endswith('_UPPER'):
            print('Creating index: ' + key)
            response = collection.create_index(key, sparse=True)
            print("Index created: %s, elapsed time: %f"  % (response, time.time() - lapTime))
            lapTime = time.time()
            count += 1
            
    elapsedTime = time.time() - startTime
    print("Created %d indexes in %f seconds" % (count, elapsedTime))

#
main(sys.argv)

