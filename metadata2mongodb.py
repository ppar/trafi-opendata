#!/usr/bin/python3

#
# Imports the metadata.json file into MongoDB
#
# USAGE: metadata2mongodb.py <metadatafile> <dbname> <collectionname>
#        metadata2mongodb.py metadata.json trafi_opendata metadata
#

#from __future__ import print_function
import sys
import json

from pymongo import MongoClient

debug = False

#           
def main(argv):
    metadataFileName = argv[1]
    dbName = argv[2]
    collectionName = argv[3]

    metadata = json.loads(open(metadataFileName).read())

    mongoClient = MongoClient('mongodb://localhost:27017')
    mongoDb = mongoClient[dbName]
    collection = mongoDb[collectionName]

    insertedId = collection.insert_one(metadata).inserted_id

    print(insertedId)
    
main(sys.argv)

