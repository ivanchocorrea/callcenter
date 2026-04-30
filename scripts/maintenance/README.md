# Scripts de mantenimiento

Estos scripts son los que usa el **Panel de mantenimiento** (`/admin/maintenance`)
y también están disponibles para el desarrollador desde la terminal.

## Lista rápida

| Script           | Para qué sirve                                        | Llamado desde el panel        |
|------------------|-------------------------------------------------------|-------------------------------|
| `backup.sh`      | Crea respaldo (BD + uploads + config sin secretos)    | "Crear respaldo ahora"        |
| `restore.sh`     | Restaura un respaldo ya existente                     | "Restaurar" (doble confirmación) |
| `restart.sh`     | Reinicia un servicio (docker / systemd / pm2)         | "Reiniciar"                   |
| `check-deps.js`  | Reporta paquetes desactualizados                      | "Buscar actualizaciones"      |
| `update.sh`      | Pipeline completo: respaldo + update + pruebas        | "Actualizar librerías seguras"|
| `run-tests.sh`   | Pruebas básicas tras una actualización                | uso interno por `update.sh`   |

## Permisos

```bash
chmod +x scripts/maintenance/*.sh
```

## Variables de entorno requeridas

Se leen de `.env` en la raíz del proyecto:

```
MYSQL_HOST=...
MYSQL_PORT=3306
MYSQL_USER=...
MYSQL_PASSWORD=...
MYSQL_DATABASE=...
STORAGE_LOCAL_PATH=./storage/uploads
BACKUP_DIR=./backups        # opcional
BACKEND_URL=http://localhost:3001  # opcional, para tests post-update
```

## Ejemplos manuales

```bash
# Respaldo manual
bash scripts/maintenance/backup.sh --out=./backups/manual-$(date +%F).tar.gz

# Ver qué hay desactualizado
node scripts/maintenance/check-deps.js

# Aplicar actualizaciones seguras (todo el monorepo)
bash scripts/maintenance/update.sh all

# Reiniciar el backend
bash scripts/maintenance/restart.sh --target=backend
```

## Por qué desde el panel y no desde la terminal

El panel:

1. Ejecuta los mismos scripts.
2. Pide confirmaciones a un usuario no técnico.
3. Bloquea acciones peligrosas (versiones major).
4. Crea respaldo automático antes de cualquier cambio.
5. Registra todo en `maintenance_actions` para auditoría.

El desarrollador tiene los scripts disponibles para casos avanzados.
