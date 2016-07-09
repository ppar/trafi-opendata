# Metadata

The JSON API and the data import scripts use schema information in 
`./metadata.json`; this file describes the CSV file's format and how the 
SQL schema (and MongoDB structure) are generated.

The web UI uses `./metadata.json` and `./www/public/js/columns.json` for schema 
information.

Unless the schema changes, it's not necessary to regenerate these
files. Updating the schema may become necessary if Trafi adds new
undocumented ENUM values or their stated data definition is changed in 
a future open data release.

## Generating metadata files

- metadata.json and columns.json are generated from tab-delimited text files under `./schema/vehicles/*.txt`, which in turn 
are created from individual sheets in sheets `./schema/17629-avoin_data_ajoneuvojen_luokitukset.numbers`
by manually copying the relevant cells in Numbers and pasting them to `cat > foo.txt`.

- `17629-avoin_data_ajoneuvojen_luokitukset.numbers` is `based on 17629-avoin_data_ajoneuvojen_luokitukset.xls`
from Trafi, with additional data on data types, amended translations etc. 

- To generate the JSON files, use the commands:

```bash
$ ./tools/genmeta.py schema/vehicles/_columns.txt schema/vehicles/ajoneuvoluokka.txt schema/vehicles/ajoneuvoryhma.txt schema/vehicles/ajoneuvonkaytto.txt schema/vehicles/vari.txt schema/vehicles/korityyppi.txt schema/vehicles/ohjaamotyyppi.txt schema/vehicles/kayttovoima.txt schema/vehicles/kunta.txt > metadata.json
```

```bash
$ ./tools/genuijson.py schema/vehicles/_columns.txt > www/public/js/columns.json
```
