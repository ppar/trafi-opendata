#!/bin/bash

# Script to download the ca. 250 MB pig from Trafi
# See http://www.trafi.fi/en/services/open_data
# See ./trafi-data-releases.txt for URLS of earlier releases

# CC 4.0 licence for Trafi's open data content
# Creative Commons -lisenssi
# This work has been licensed under the Creative Commons Nimeä 4.0 International license.
# 
# Please state the Licensor's name, the name of the data body and the date on
# which Trafi delivered the data content (for example: contains Trafi's open data for vehicles 3.0)

mkdir -p rawdata/4.5 rawdata/4.x-schema

curl -o rawdata/4.5/160407_Ajoneuvot_4.5.zip  \
     http://wwwtrafifi.97.fi/opendata/160407_Ajoneuvot_4.5.zip

curl -o rawdata/4.x-schema/17629-avoin_data_ajoneuvojen_luokitukset.xls \
     http://www.trafi.fi/filebank/a/1433135757/74ee1d8be49178dbee2fc7df128bd5d6/17629-avoin_data_ajoneuvojen_luokitukset.xls

