#!/usr/bin/python3

from __future__ import print_function
#from sys import argv
import sys
import csv


# ajoneuvoluokka;ensirekisterointipvm;ajoneuvoryhma;ajoneuvonkaytto;variantti;versio;kayttoonottopvm;vari;ovienLukumaara;korityyppi;ohjaamotyyppi;istumapaikkojenLkm;omamassa;teknSuurSallKokmassa;tieliikSuurSallKokmassa;ajonKokPituus;ajonLeveys;ajonKorkeus;kayttovoima;iskutilavuus;suurinNettoteho;sylintereidenLkm;ahdin;sahkohybridi;merkkiSelvakielinen;mallimerkinta;vaihteisto;vaihteidenLkm;kaupallinenNimi;voimanvalJaTehostamistapa;tyyppihyvaksyntanro;yksittaisKayttovoima;kunta;Co2;matkamittarilukema;alue;valmistenumero2;jarnro
# MUU;;21;01;;;19670000;;;;;1;210;;;;;;01;590;;;;;BMW;R60/590;;;;;;01;049;;;027;;1
# M1;1997-01-10;;01;;;19970110;5;5;AC;1;5;1320;1780;1780;4600;1720;;01;1780;66;4;false;;Volkswagen;5D PASSAT VARIANT 1.8 CL-351-C/263;;;PASSAT;05;;01;286;;355890;469;WVWZZZ3AZT;2
# MUU;1976-09-01;13;01;;;19760000;;;;;;630;;750;;1960;;;;;;;;Sprite;ALPINE/C;;;;01;;;893;;;669;;3
# M1;1984-07-09;;01;;;19840000;1;;;1;5;780;1175;1155;;1590;;01;1110;;4;;;Ford;2D FIESTA 1.1-FBD/2280;;;FIESTA;05;;01;564;;;905;;4
# MUU;1983-09-22;13;01;;;19830000;;;;;;150;;350;;1580;;;;;;;;Omavalmiste;PV350/2000;;;;;;;734;;;252;;5
# O1;1994-02-09;1;01;;;19940209;;;;;;170;750;750;2000;1600;;;;;;;;Valtteri;LKZ-8101;;;;;;;761;;;314;;6
# M1;1990-05-08;;05;;;19900508;9;;;1;5;1060;1505;1435;4270;1680;;01;1900;88;4;;;Citroen;4D SEDAN BX 19 GTI-XBEY/2650;;;BX;09;;01;091;;;007;VF7XBEY000;7
# M1;2003-08-08;;01;;5365292375;20030808;2;;AB;;5;955;;1420;3770;1640;1420;01;1140;43;4;;;Renault;2D CLIO HATCHBACK 1.2-CB0FCF/247;;;CLIO;05;;01;609;143;92938;283;VF1CB0FCF2;8
# M1;2003-10-02;;01;1;4;20031002;6;;AA;;5;1462;1920;1920;4670;1760;1450;01;1990;114;4;;;Honda;4D ACCORD SEDAN 2.0-CL75/268;;;ACCORD;05;e6*2001/116*0091*00;01;837;190;238435;332;JHMCL75403;9

def dialectToString(d):
    return "Delimiter: " + str(d.delimiter) + ", doublequote: " + str(d.doublequote) + ", escapechar: " + str(d.escapechar) + ", lineterminator: " + str(d.lineterminator) + ", quotechar: " + str(d.quotechar) + ", quoting: " + str(d.quoting) + ", skipinitialspace: " + str(d.skipinitialspace) + ", strict: " + str(d.strict)

def main(argv):
    csvFileName = argv[1]
    print("CSV file: %s\n" % csvFileName)

    csvFile = open(csvFileName, newline='')
    csvReader = csv.reader(csvFile, delimiter=';')
    print("Dialect found: %s\n" % dialectToString(csvReader.dialect))
    headerRow = csvReader.__next__()
    print("Header row:\n")
    print(headerRow)
    #print("Field names:")
    #print(csvReader.fieldnames())

    count = 0
    for row in csvReader:
        print("-- Row: %d\n" % count)
        print("INSERT INTO %s (%s) VALUES (%s);", tableName, columnNames,)
        count += 1

main(sys.argv)
