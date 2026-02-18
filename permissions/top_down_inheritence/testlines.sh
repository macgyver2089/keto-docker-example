#!/bin/bash

KETO_READ_REMOTE=127.0.0.1:4466
keto check alice view File folder-1 --insecure-disable-transport-security --max-depth 4

keto check alice view File folder-2 --insecure-disable-transport-security --max-depth 5

keto check alice view File file-1 --insecure-disable-transport-security --max-depth 6

