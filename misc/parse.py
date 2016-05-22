import codecs
import csv
import datetime

csvFileName = "rawdata/4.3/AvoinData 4.3.csv"


"""
{u'kayttovoima': u'', u'ensirekisterointipvm': u'1992-06-01', u'omamassa': u'180', u'matkamittarilukema': u'',
u'Co2': u'', u'suurinNettoteho': u'', u'tyyppihyvaksyntanro': u'', u'versio': u'', u'ahdin': u'',
u'ajoneuvonkaytto': u'01', u'vari': u'', u'teknSuurSallKokmassa': u'750', u'ajoneuvoryhma': u'1',
u'ohjaamotyyppi': u'', u'sahkohybridi': u'', u'voimanvalJaTehostamistapa': u'', u'mallimerkinta':
u'K750/2370', u'jarnro': u'55', u'ajonKorkeus': u'', u'vaihteisto': u'', u'kunta': u'077',
u'iskutilavuus': u'', u'ajoneuvoluokka': u'O1', u'sylintereidenLkm': u'', u'ajonKokPituus': u'3700',
u'ajonLeveys': u'1660', u'ovienLukumaara': u'', u'korityyppi': u'', u'kaupallinenNimi': u'',
u'variantti': u'', u'yksittaisKayttovoima': u'', u'valmistenumero2': u'',
u'merkkiSelvakielinen': u'K\xe4rpp\xe4', u'tieliikSuurSallKokmassa': u'750', u'alue': u'415',
u'vaihteidenLkm': u'', u'istumapaikkojenLkm': u'', u'kayttoonottopvm': u'19920601'}

{u'kayttovoima': u'', u'ensirekisterointipvm': u'1992-06-01', u'omamassa': u'190', u'matkamittarilukema': u'',
u'Co2': u'', u'suurinNettoteho': u'', u'tyyppihyvaksyntanro': u'', u'versio': u'', u'ahdin': u'',
u'ajoneuvonkaytto': u'01', u'vari': u'', u'teknSuurSallKokmassa': u'750', u'ajoneuvoryhma': u'1',
u'ohjaamotyyppi': u'', u'sahkohybridi': u'', u'voimanvalJaTehostamistapa': u'', u'mallimerkinta':
u'750KL/2670', u'jarnro': u'13161', u'ajonKorkeus': u'', u'vaihteisto': u'', u'kunta': u'734',
u'iskutilavuus': u'', u'ajoneuvoluokka': u'O1', u'sylintereidenLkm': u'', u'ajonKokPituus': u'4200',
u'ajonLeveys': u'1750', u'ovienLukumaara': u'', u'korityyppi': u'', u'kaupallinenNimi': u'',
u'variantti': u'', u'yksittaisKayttovoima': u'', u'valmistenumero2': u'', u'merkkiSelvakielinen':
u'Juhta', u'tieliikSuurSallKokmassa': u'750', u'alue': u'241', u'vaihteidenLkm': u'',
u'istumapaikkojenLkm': u'', u'kayttoonottopvm': u'19920601'}

{u'kayttovoima': u'01', u'ensirekisterointipvm': u'1992-06-01', u'omamassa': u'1050',
u'matkamittarilukema': u'', u'Co2': u'', u'suurinNettoteho': u'77', u'tyyppihyvaksyntanro': u'',
u'versio': u'', u'ahdin': u'', u'ajoneuvonkaytto': u'01', u'vari': u'9', u'teknSuurSallKokmassa': u'1490',
u'ajoneuvoryhma': u'', u'ohjaamotyyppi': u'1', u'sahkohybridi': u'', u'voimanvalJaTehostamistapa': u'05',
u'mallimerkinta': u'4D COROLLA 1.6XSI LIFTBACK-AE92L-ALMDKW/243', u'jarnro': u'22159', u'ajonKorkeus': u'',
u'vaihteisto': u'', u'kunta': u'598', u'iskutilavuus': u'1580', u'ajoneuvoluokka': u'M1',
u'sylintereidenLkm': u'4', u'ajonKokPituus': u'4220', u'ajonLeveys': u'1660', u'ovienLukumaara': u'',
u'korityyppi': u'', u'kaupallinenNimi': u'COROLLA', u'variantti': u'', u'yksittaisKayttovoima': u'01',
u'valmistenumero2': u'JT1L0AE920', u'merkkiSelvakielinen': u'Toyota', u'tieliikSuurSallKokmassa': u'1425',
u'alue': u'686', u'vaihteidenLkm': u'', u'istumapaikkojenLkm': u'5', u'kayttoonottopvm': u'19920601'}
"""

carRecordDescriptor = {
     'ajoneuvoluokka': ('str', 'enum'), 
     'ensirekisterointipvm': ('date1', 'YYYY-MM-DD'), 
     'ajoneuvoryhma': ('int', 'enumcode'), 
     'ajoneuvonkaytto': ('str', 'enum'), 
     'variantti': ('str'), 
     'versio': ('str'), 
     'kayttoonottopvm': ('date2', 'YYYYMMDD'), 
     'vari': ('str', 'enum'), 
     'ovienLukumaara': ('int', ''), 
     'korityyppi': ('str', 'enum'), 
     'ohjaamotyyppi': ('int', 'enumcode'), 
     'istumapaikkojenLkm': ('int', ''), 
     'omamassa': ('int', 'kg'), 
     'teknSuurSallKokmassa': ('int', 'kg'), 
     'tieliikSuurSallKokmassa': ('int', 'kg'), 
     'ajonKokPituus': ('int', 'mm'), 
     'ajonLeveys': ('int', 'mm'), 
     'ajonKorkeus': ('int', 'mm'), 
     'kayttovoima': ('str', 'enum'), 
     'iskutilavuus': ('int', 'cm3'), 
     'suurinNettoteho': ('float', 'kW, at most 1 decimal'), 
     'sylintereidenLkm': ('int', ''), 
     'ahdin': ('bool', 'true|false'), 
     'sahkohybridi': ('bool', 'true|false'), 
     'merkkiSelvakielinen': ('str', ''), 
     'mallimerkinta': ('str', ''), 
     'vaihteisto': ('str', ''), 
     'vaihteidenLkm': ('int', ''), 
     'kaupallinenNimi': ('str', ''), 
     'voimanvalJaTehostamistapa': ('str', ''), 
     'tyyppihyvaksyntanro': ('str', ''), 
     'yksittaisKayttovoima': ('str', ''), 
     'kunta': ('str', 'enum'), 
     'Co2': ('int', 'g'), 
     'matkamittarilukema': ('int'), 
     'alue': ('str', ''), 
     'valmistenumero2': ('str', ''), 
     'jarnro': ('int', ''),
}

        
# ajoneuvoluokka,ensirekisterointipvm,ajoneuvoryhma,ajoneuvonkaytto,variantti,versio,kayttoonottopvm,vari,ovienLukumaara,korityyppi,ohjaamotyyppi,istumapaikkojenLkm,omamassa,teknSuurSallKokmassa,tieliikSuurSallKokmassa,ajonKokPituus,ajonLeveys,ajonKorkeus,kayttovoima,iskutilavuus,suurinNettoteho,sylintereidenLkm,ahdin,sahkohybridi,merkkiSelvakielinen,mallimerkinta,vaihteisto,vaihteidenLkm,kaupallinenNimi,voimanvalJaTehostamistapa,tyyppihyvaksyntanro,yksittaisKayttovoima,kunta,Co2,matkamittarilukema,alue,valmistenumero2,jarnro

# L1,2005-08-23,109,01,I,III,20050822,,,,4,2,97,277,277,1740,690,,01,49,2,1,,,Yamaha,AEROX R YQ50-SA144/49,,,,02,e13*92/61*0036*02,01,049,,,021,,321

def validateDate(year, month, day):
    if year < 1800 or year > 2100:
        raise ValueError, ("Wrong year ", year)
    
    elif month < 0 or month > 12:
        raise ValueError, ("Wrong month ", month)

    elif day < 0 or day > 31:
        raise ValueError, ("Wrong day ", day)    

def normalizeRecord(desc, record):
    #record[field + '_year'] = None
    for field in record:
        try:
            if desc[field][0] == 'str':
                pass
            
            elif record[field] == "":
                record[field] = None
                
            elif desc[field][0] == 'date1':
                s = record[field].split('-')
                year = int(s[0])
                month = int(s[1])
                day = int(s[2])

                try:
                    validateDate(year, month, day)
                except  ValueError, e:
                    print record
                    raise e
                
                record[field] = datetime.date(year, month, day)

            elif desc[field][0] == 'date2':
                if int(record[field]) == 0:
                    record[field] = None
                    continue

                # There's at least one broken line in the data: "00050812" instead of "20050812"
                # L1e,2008-06-18,109,01,N.A,CK50QT-5-00,00050812,,,,,2,100,250,,1750,700,1130,01,49,2,1,false,,Kymco,,6,,,02,e4*2002/24*0403*01,01,976,,,956,,3593818
                if record[field][0:2] == '00':
                    year = int('20' + record[field][2:4])
                else:
                    year = int(record[field][0:4])
                    
                month = int(record[field][4:6])
                day = int(record[field][6:8])

                #record[field + '_year'] = year
                if month == 0 and day == 0:
                    # date is something like "19670000", i.e. just year
                    continue

                try:
                    validateDate(year, month, day)
                except ValueError, e:
                    print record
                    raise e
                
                record[field] = datetime.date(year, month, day)
                            
            elif desc[field][0] == 'int':
                record[field] = int(record[field])
                
            elif desc[field][0] == 'float':
                record[field] = float(record[field])
                
            elif desc[field][0] == 'bool':
                record[field] = bool(record[field])
        except ValueError, e:
            print "ValueError for field '", field, "', value '", record[field], "'"
            raise e


def carCsvToSql(csvFileName):
    csvFile = open(csvFileName, 'r')
    csvReader = csv.DictReader(csvFile, restkey="_overflow")

    i = 0    
    for rec in csvReader:
        #print rec
        try:
            normvals = normalizeRecord(carRecordDescriptor, rec)
        except ValueError, e:
            print "vals: ", rec
            print "i: ", i
            print "jarnro: ", rec['jarnro']
            raise e
        i += 1

        if i % 10000 == 0:
            print "Parsed ", i, " lines"
        
    print
    print "PARSED ", i, " LINES"

carCsvToSql(csvFileName)

