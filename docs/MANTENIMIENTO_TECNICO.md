# Módulo de Mantenimiento — Documentación técnica

Este documento describe la arquitectura y los puntos de extensión del
**panel de mantenimiento** (`/admin/maintenance`) para futuros
desarrolladores.

## 1. Visión general

El módulo permite a un usuario **no desarrollador** con rol
`company_admin` o `super_admin` realizar operaciones críticas con confirmación
y trazabilidad:

- Ver estado de los componentes del sistema.
- Capturar y consultar errores con traducción a lenguaje claro.
- Detectar y aplicar actualizaciones seguras de dependencias.
- Crear y restaurar respaldos.
- Reiniciar servicios.
- Consultar la auditoría de acciones del propio panel.

## 2. Estructura de archivos

```
backend/src/maintenance/
  maintenance.module.ts
  maintenance.controller.ts
  dto/maintenance.dto.ts
  services/
    status.service.ts            # estado del sistema + recursos
    errors.service.ts            # captura/translate/list/export
    dependencies.service.ts      # npm outdated / npm update
    backup.service.ts            # backup/restore vía scripts
    restart.service.ts           # reinicio de servicios
    maintenance-audit.service.ts # auditoría del panel

frontend/app/admin/maintenance/
  page.tsx                       # contenedor con pestañas
  _components/
    StatusCard.tsx
    ErrorsTable.tsx
    UpdatesPanel.tsx
    BackupsPanel.tsx
    RestartPanel.tsx
    AuditTable.tsx
    ConfirmDialog.tsx
    Toast.tsx
frontend/lib/api/maintenance.ts  # cliente HTTP

scripts/maintenance/
  backup.sh
  restore.sh
  restart.sh
  update.sh
  run-tests.sh
  check-deps.js
  README.md

db/migrations/013_maintenance_module.sql       # tablas nuevas
```

## 3. Modelo de datos (migración 013)

| Tabla                  | Propósito                                                   |
|------------------------|-------------------------------------------------------------|
| `system_errors`        | Errores capturados, traducidos a lenguaje claro             |
| `backup_history`       | Histórico de respaldos (manual, scheduled, pre_update)      |
| `restart_history`      | Histórico de reinicios solicitados desde el panel           |
| `dependency_updates`   | Snapshots de `npm outdated` y aplicaciones de update        |
| `maintenance_actions`  | Auditoría específica del panel (acción + resultado + meta)  |

Ejecutar la migración:

```bash
mysql -u root -p < db/migrations/013_maintenance_module.sql
# o desde el script existente:
npm run migration:run --prefix backend
```

## 4. Endpoints REST (todos protegidos por `Roles('super_admin','company_admin')`)

| Método | Ruta                                  | Acción                                |
|--------|---------------------------------------|---------------------------------------|
| GET    | `/api/maintenance/status`             | Estado del sistema                    |
| GET    | `/api/maintenance/summary`            | Estado + resumen de errores           |
| GET    | `/api/maintenance/errors`             | Lista de errores                      |
| POST   | `/api/maintenance/errors/update`      | Cambiar estado del error              |
| GET    | `/api/maintenance/logs/download`      | Descargar logs (.txt o .json)         |
| GET    | `/api/maintenance/updates/check`      | `npm outdated` en backend y frontend  |
| POST   | `/api/maintenance/updates/apply-safe` | `npm update` (solo patch+minor)       |
| GET    | `/api/maintenance/backups`            | Lista de respaldos                    |
| POST   | `/api/maintenance/backups/create`     | Crear respaldo                        |
| POST   | `/api/maintenance/backups/restore`    | Restaurar (doble confirmación + frase)|
| POST   | `/api/maintenance/restart`            | Programa reinicio de un servicio      |
| GET    | `/api/maintenance/restart/history`    | Historial de reinicios                |
| GET    | `/api/maintenance/restart/last`       | Último reinicio                       |
| GET    | `/api/maintenance/audit`              | Auditoría del panel                   |

### Garantías de seguridad

- Mayor → bloqueado en backend (`applySafeUpdates` rechaza si `onlySafe=false`).
- Restore exige `confirm1`, `confirm2` y frase `RESTAURAR`.
- Reinicio de `all` solo lo permite `super_admin`.
- Antes de actualizar dependencias se crea un respaldo `pre_update`.
- `MaintenanceAuditService.scrubSecrets` redacta claves antes de persistir.
- `ErrorsService.scrubText` y `scrub` quitan tokens, `Authorization`, JWT, etc.

## 5. Cómo capturar errores desde otros módulos

`ErrorsService` se exporta en `MaintenanceModule`. Cualquier módulo que lo
importe puede registrar incidencias:

```ts
import { ErrorsService } from '../maintenance/services/errors.service';

@Injectable()
export class CallsService {
  constructor(private readonly errors: ErrorsService) {}

  async ringAgent(...) {
    try { /* ... */ }
    catch (e: any) {
      await this.errors.record({
        source: 'telephony',
        module: 'CallsService.ringAgent',
        severity: 'error',
        technicalMessage: e?.message ?? 'AMI dial failed',
        // friendlyMessage / recommendation se generan automáticamente si no llegan
        metadata: { agentId: 42 },
      });
      throw e;
    }
  }
}
```

Conviene usarlo en `AllExceptionsFilter` y en cualquier callback de
schedulers (`@Cron`) para que los errores invisibles para el usuario también
aparezcan en el panel.

## 6. Hook recomendado en el filtro global

```ts
// backend/src/common/filters/all-exceptions.filter.ts
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(@Optional() private readonly errors?: ErrorsService) {}

  async catch(exception: any, host: ArgumentsHost) {
    // ... respuesta HTTP existente ...
    if (this.errors) {
      void this.errors.record({
        source: 'backend',
        module: host.switchToHttp().getRequest()?.url ?? 'unknown',
        severity: exception?.status >= 500 ? 'critical' : 'error',
        technicalMessage: exception?.message ?? String(exception),
        stackTrace: exception?.stack,
      }).catch(() => {});
    }
  }
}
```

## 7. Política de actualizaciones

| Tipo   | ¿Aplicado por panel? | Motivo                                  |
|--------|----------------------|------------------------------------------|
| patch  | ✅ Sí                | Solo arreglos                            |
| minor  | ✅ Sí                | Compatible hacia atrás                   |
| major  | ❌ No                | Cambios rompedores → revisión manual     |

`npm update` (sin args) respeta el rango semver de `package.json`. Para
cambiar la política basta con tocar `DependenciesService.applySafeUpdates`.

## 8. Reinicio: cómo reconoce el orquestador

`scripts/maintenance/restart.sh` busca, en orden:

1. `docker compose` (si existe `docker-compose.yml` y el servicio está listado).
2. `systemctl` (si el servicio está como unit de systemd).
3. `pm2`.

Mapeo de nombre interno → servicio:

| Interno   | Servicio                |
|-----------|-------------------------|
| backend   | `callcenter-backend`    |
| frontend  | `callcenter-frontend`   |
| asterisk  | `asterisk`              |
| redis     | `redis`                 |

Si su `docker-compose.yml` usa otros nombres, ajuste la función `service_for`
o monte alias.

## 9. Pruebas básicas

`scripts/maintenance/run-tests.sh` se invoca desde `update.sh` y comprueba:

1. Que el backend compila (`tsc` vía `nest build`).
2. Que pasa lint (no bloquea si falla).
3. Que `/health/live` y `/health/ready` responden 200 (si `BACKEND_URL`
   está disponible).

Para añadir suites adicionales (jest, e2e), agréguelas al final del script.

## 10. Variables de entorno relevantes

```
# Telefonía
ASTERISK_HOST=...
ASTERISK_AMI_PORT=5038

# Caché/colas
REDIS_HOST=...
REDIS_PORT=6379

# BD (ya existían)
MYSQL_HOST=...
MYSQL_PORT=3306
MYSQL_USER=...
MYSQL_PASSWORD=...
MYSQL_DATABASE=...

# Almacenamiento
STORAGE_LOCAL_PATH=./storage/uploads
BACKUP_DIR=./backups

# Marcadores que muestra el panel
APP_VERSION=1.0.0    # opcional, fallback de package.json
```

## 11. Próximas mejoras sugeridas

- WebSocket para empujar el estado en tiempo real (en lugar del polling 30 s).
- Programar respaldos automáticos diarios con `@nestjs/schedule`.
- Notificación por correo / Slack cuando aparezca un error `critical`.
- Soporte de "modo mantenimiento" que devuelva 503 en endpoints públicos
  (acción `toggle_maintenance_mode` ya está prevista en `maintenance_actions`).
- Firmar respaldos con GPG antes de subirlos a S3.
