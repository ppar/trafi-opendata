#!/usr/bin/python3

#
#
# USAGE: getcsvheader.py <source.csv>
#

from __future__ import print_function
import sys
import csv

#           
def main(argv):
    csvFileName = argv[1]

    # The data seems to be Latin-1 encoded and ';'-delimited, with no quotes for strings
    csvFile = open(csvFileName, newline='', encoding='latin1')
    csvReader = csv.reader(csvFile, delimiter=';')

    print(csvReader.__next__())
    
main(sys.argv)

