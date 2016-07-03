#!/bin/bash

# Script for downloading and extracting archives from GitHub. 
# Not used at the moment.

# 
function get_github_package(){
    ghuser="$1"
    ghrepo="$2"
    branch="$3"

    url="https://github.com/${ghuser}/${ghrepo}/archive/${branch}.zip"
    targetpath="public/ext/${ghrepo}"
    tmpfile="tmpfile.zip"

    echo "Installing ${url} into ${targetpath}"

    err=""
    [ -e "$targetpath" ] && {
        echo "ERROR: targetpath ${targetpath} exists" >&2
        err=true
    }
    [ -e "$tmpfile" ] && {
        echo "ERROR: tempfile ${tmpfile} exists" >&2
        err=true
    }
    [ "$err" == "true" ] && {
        echo "Skipping this package" >&2
        return
    }
        
    curl -s -L -o "${tmpfile}" "$url"
    unzip -q -d public/ext/ "${tmpfile}"
    mv "public/ext/${ghrepo}-${branch}" "${targetpath}"
    rm "${tmpfile}"
}

# Extended version of bs_grid (or clone/fork the repo and point www/public/ext/bs_grid to it)
#get_github_package ppar       bs_grid master

# Dependencies for bs_grid
#get_github_package pontikis   bs_pagination master
#get_github_package pontikis   jui_filter_rules master

