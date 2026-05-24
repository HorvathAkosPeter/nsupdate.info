#!/bin/sh

set -euxo pipefail

cd /tmp && named -g -u named -c /etc/bind/named.conf.local &
pylint src/nsupdate
pytest src/nsupdate
