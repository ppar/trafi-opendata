#!/usr/bin/python3

#
# Generator for metadata.json
#
# Usage:
#   genmeta.py columndesc.txt \
#              ajoneuvoryhma.tmp ajoneuvonkaytto.tmp vari.tmp  \
#              korityyppi.tmp ohjaamotyyppi.tmp kayttovoima.tmp \
#              kunta.tmp  \
#     > metadata.json
#
# Where:
#
# - columndesc.txt contains supplemented column descriptions, \t-delimited, UTF-8:
#   - column name
#   - Type
#   - Unit
#   - presentation order  (used in web UI, not included in API metadata)
#   - default visibility  (used in web UI, not included in API metadata)
#   - Name FI
#   - Desc FI
#   - Name SV
#   - Desc SV
#   - Name EN
#   - Desc EN
#
# - each of the *.tmp files contains data from the respective sheets
#   in "17629-avoin_data_ajoneuvojen_luokitukset.xls", in \t -delimited
#   form, UTF-8-encoded.
#
# Note: the English translations found in sheet 'kayttovoima' are wrong,
# you need to edit them manually before processing.
#
# Outputs a metadata.json file containing information from above files.
#


import sys
import json
import codecs
from collections import OrderedDict

#def escape_bson_key(key):
#    # \ -> \\
#    # . -> \u002e
#    # $ -> \u0024
#    return key.replace("\\", "\\\\").replace(".", "\\u002e").replace("$", "\\u0024")

    
# Let print() output UTF-8. 
# (export LC_CTYPE="en_US.utf8" will take care of this too)
#sys.stdout = codecs.getwriter("utf-8")(sys.stdout.detach())

# Open files
fp = {
    # Descriptions of all CSV columns
    'columndesc':      open(sys.argv[1], encoding='utf-8'),

    # Values for ENUM columns:
    'ajoneuvoluokka':  open(sys.argv[2], encoding='utf-8'),
    'ajoneuvoryhma':   open(sys.argv[3], encoding='utf-8'),
    'ajoneuvonkaytto': open(sys.argv[4], encoding='utf-8'),
    'vari':            open(sys.argv[5], encoding='utf-8'),
    'korityyppi':      open(sys.argv[6], encoding='utf-8'),
    'ohjaamotyyppi':   open(sys.argv[7], encoding='utf-8'),
    'kayttovoima':     open(sys.argv[8], encoding='utf-8'),
    'kunta':           open(sys.argv[9], encoding='utf-8')    
}

# Use OrderedDict to make the output human-readable. No code
# assumes the dict is ordered, however.
metadata = OrderedDict()
metadata['vehicles'] = OrderedDict()
metadata['vehicles']['updated'] = ''
metadata['vehicles']['columns'] = OrderedDict()

# Read in descriptions of CSV columns
for line in fp['columndesc']:
    a = line.rstrip("\n").split("\t")

    colname = a[0]

    colType = a[1]
    colUnit = a[2]

    # Not used in API metadata, only UI
    #colPresentationOrder = a[3]
    #colDefaultVisibility = a[4]
        
    metadata['vehicles']['columns'][colname] = {
        'name': {
            'fi': a[5],
            'sv': a[7],
            'en': a[9]
        },
        'desc': {
            'fi': a[6],
            'sv': a[8],
            'en': a[10]
        }, 
        'type': colType        
    }

    if colType != 'ENUM' and colUnit != '':
        metadata['vehicles']['columns'][colname]['unit'] = colUnit

    # Insert ENUM values
    if colname in fp:
        metadata['vehicles']['columns'][colname]['type'] = 'enum'
        metadata['vehicles']['columns'][colname]['enum'] = []
        
        for enumLine in fp[colname]:
            # It would be nice to use the enum value (b[0]) as key here,
            # but some of the values contain dots, which is not allowed
            # in MongoDB's BSON keys, so we'll just store it in 'key'
            b = enumLine.rstrip("\n").split("\t")

            if colname == 'ajoneuvoluokka':
                prefix = b[0] + ' '
            else:
                prefix = ''

            if colname == 'ajoneuvoluokka' or colname == 'ajoneuvonkaytto':
                metadata['vehicles']['columns'][colname]['enum'].append({
                    'key': b[0],
                    'name': {
                        'fi': prefix + b[1],
                        'sv': prefix + b[3],
                        'en': prefix + b[5]
                    },
                    'desc': {
                        'fi': prefix + b[2],
                        'sv': prefix + b[4],
                        'en': prefix + b[6]
                    }
                })
                
            else:
                metadata['vehicles']['columns'][colname]['enum'].append({
                    'key': b[0],
                    'name': {
                        'fi': prefix + b[1],
                        'sv': prefix + b[2],
                        'en': prefix + b[3]
                    }
                })
                
        # Justified Anciets of MUUMUU
        if colname == 'ajoneuvoluokka':
            metadata['vehicles']['columns'][colname]['enum'].append({
                'key': 'MUU',
                'name': {
                    'fi': 'MUU',
                    'sv': 'MUU',
                    'en': '(Other)'
                },
                'desc': {
                    'fi': 'MUU - Muu luokka',
                    'sv': 'MUU - Muu luokka',
                    'en': 'MUU - Other Class'
                }
            })

# All done
print(json.dumps(metadata, indent=4))

