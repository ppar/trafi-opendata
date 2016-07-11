
# Who needs Ansible?

# curl https://raw.githubusercontent.com/ppar/trafi-opendata/master/tools/deploy.sh | sh -

sudo apt-get update
sudo apt-get -y install mariadb-{server,client} nginx nodejs npm unzip

cd /usr/local/lib
sudo npm install bower
sudo sed -ri 's|(^#\!.*) node$|\1 nodejs|' node_modules/bower/bin/bower
#sudo ln -s ../lib/node_modules/bower/bin/bower /usr/local/bin/bower
cd - 

sudo systemctl stop mysql
sudo rm -r /var/lib/mysql/*

sudo umount /mnt
sudo mkdir -p /var/lib/mysql/trafi_opendata
sudo chown -R mysql:mysql /var/lib/mysql/
sudo mount /dev/xvdb /var/lib/mysql/trafi_opendata/
sudo chown mysql:mysql /var/lib/mysql/trafi_opendata

curl -L -O http://ppar-trafi-opendata.s3-website-eu-west-1.amazonaws.com/vehicles/4.5/mysql/innodb/var_lib_mysql.tar.gz 
sudo tar -xpzv -f var_lib_mysql.tar.gz -C /
sudo systemctl start mysql

git clone https://github.com/ppar/trafi-opendata.git

sudo cp trafi-opendata/www/conf/nginx_virtualhost.conf /etc/nginx/conf.d/vehicledata.conf
sudo rm /etc/nginx/sites-enabled/default
sudo sed -i 's|<INSTALL-DIR>|/home/ubuntu/trafi-opendata|g' /etc/nginx/conf.d/vehicledata.conf
sudo systemctl restart nginx 

cd trafi-opendata/www
bower install
cd -

cd trafi-opendata/json-api
cp config/db.js.example config/db.js
npm install

nohup sh -c '(while true ; do echo STARTING ; date;  nodejs server.js ; echo DIED ; date ; sleep 2; done) > server.out 2>&1 ' &

tail -f server.out
