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

    colPresentationOrder = int(a[3])
    #colDefaultVisibility = (True == a[4] or 'true' == a[4].lower() or '1' == a[4])
    colDefaultVisibility = ('1' == a[4])

    data.append({
        'columnName': colname,
        'presentationOrder': colPresentationOrder,
        'defaultVisibility': colDefaultVisibility
    })
    
# All done
print(json.dumps(data, indent=4))

