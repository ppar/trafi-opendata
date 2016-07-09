# WWW Interface

## Requirements

Nginx

```bash
apt-get install nginx
```

Bower (global install)

```
# cd /usr/local/lib
# npm install bower
# sed -ri 's|(^#\!.*) node$|\1 nodejs|' node_modules/bower/bin/bower
# ln -s ../lib/node_modules/bower/bin/bower /usr/local/bin/bower
```

## Project dependencies
Pull in external dependencies

```
$ cd www
$ bower install
```

~~~$ ./download-ext-deps.sh~~~

## Nginx config
Use www/conf/nginx_virtualhost.conf to set up a virtual host for the WWW interface and API
