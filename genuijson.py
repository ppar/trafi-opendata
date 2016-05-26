#!/usr/bin/python3

#
# Generator for UI JSON
#
# Usage:
#   genuijson.py columndesc.txt > www/public/js/columns.json
#
# See genmeta.py for details
#


import sys
import json
import codecs

# Let print() output UTF-8. 
# (export LC_CTYPE="en_US.utf8" will take care of this too)
#sys.stdout = codecs.getwriter("utf-8")(sys.stdout.detach())

fp = open(sys.argv[1], encoding='utf-8');

data = []

# Read in descriptions of CSV columns
for line in fp:
    a = line.rstrip("\n").split("\t")
    colname = a[0]

    colType = a[1]
    colUnit = a[2]

    # Not used in API metadata, only UI
    colPresentationOrder = a[3]
    colDefaultVisibility = a[4]

    data.append({
        'columnName': a[0],
        'presentationOrder': a[3],
        'defaultVisibility': a[4]
    })
    
# All done
print(json.dumps(data, indent=4))

