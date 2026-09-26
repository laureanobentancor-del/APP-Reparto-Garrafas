#!/bin/bash
# Directorio de tu aplicación
PROJECT_DIR="/var/www/app-reparto-garrafas"
BACKUP_DIR="$PROJECT_DIR/backups"
DATE=$(date +%Y-%m-%d_%H-%M-%S)

# Crear la carpeta de respaldos si no existe
mkdir -p $BACKUP_DIR

# Copiar la base de datos de manera segura
sqlite3 "\(PROJECT_DIR/database.db" ".backup '\)BACKUP_DIR/database_$DATE.db'"

# Eliminar respaldos con más de 7 días de antigüedad para no llenar el disco
find $BACKUP_DIR -type f -name "*.db" -mtime +7 -exec rm {} \;

echo "Respaldo completado: database_$DATE.db"