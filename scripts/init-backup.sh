#!/bin/bash

# Créer le répertoire de backup s'il n'existe pas
BACKUP_DIR=${VOLUME_BACKUP_DIR:-/var/lib/docker/backups}
mkdir -p $BACKUP_DIR

# Définir les bonnes permissions
chown -R 1000:1000 $BACKUP_DIR
chmod 755 $BACKUP_DIR

# Nettoyer les backups invalides (vides)
find $BACKUP_DIR -type f -name "*.tar" -size 0 -delete

echo "Backup directory initialized at $BACKUP_DIR"
