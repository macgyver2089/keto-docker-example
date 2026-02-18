#!/bin/bash

KETO_READ_REMOTE=127.0.0.1:4466

# LabRat can create a new file in org1 (has file.edit via researcher role)
keto check LabRat canCreateNewFile Organization org1 --insecure-disable-transport-security --max-depth 4

# LabRat can edit data.txt (researcher role has file.edit on org1)
keto check LabRat edit File data.txt --insecure-disable-transport-security --max-depth 4

# Wizard cannot edit data.txt (analyst role has no permissions on org1)
keto check Wizard edit File data.txt --insecure-disable-transport-security --max-depth 4
