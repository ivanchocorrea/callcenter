# Manual del Panel de Mantenimiento

Este manual explica cómo mantener el sistema **sin tocar código**, usando el
panel web `Mantenimiento` que verás en el menú lateral cuando inicies sesión
como administrador.

> Solo los usuarios con rol **Administrador de empresa** o **Super
> administrador** pueden ver este panel.

---

## 1. Cómo entrar

1. Inicie sesión en el sistema.
2. En el menú lateral haga clic en **Mantenimiento** (ícono de llave inglesa).
3. Verá una pantalla con varias pestañas: Estado, Errores, Actualizaciones,
   Respaldos, Reiniciar y Auditoría.

En la parte superior aparece un mensaje grande con el estado general:

- 🟢 **Todo funciona correctamente**
- 🟡 **Hay avisos que conviene revisar**
- 🔴 **Hay un componente caído**

---

## 2. Pestaña “Estado”

Le muestra de un vistazo cómo está el sistema:

- **Servidor del sistema** → si la aplicación está activa.
- **Base de datos** → si los datos se pueden leer y guardar.
- **Servidor de llamadas (Asterisk)** → si las llamadas funcionan.
- **Caché y colas (Redis)** → si las funciones rápidas funcionan.
- **CPU / Memoria / Almacenamiento** → barras de uso del servidor.
- **Versión actual** y **Última actualización**.

Cada tarjeta muestra un mensaje en lenguaje claro, por ejemplo:

> "La base de datos está conectada y responde correctamente."

El estado se refresca solo cada 30 segundos, o pulsando **Actualizar**.

---

## 3. Pestaña “Errores”

Aquí aparecen los errores importantes detectados en el sistema, traducidos a
lenguaje fácil de entender, con:

- Fecha y hora.
- Módulo afectado (por ejemplo: telefonía, base de datos, frontend).
- **Gravedad**: info, warning, error, critical.
- **Mensaje claro**: lo que significa para usted.
- **Recomendación**: qué hacer.

### Filtros y acciones

- **Solo abiertos** (predeterminado), **Solo críticos** o **Todos**.
- **Tomar**: marca el error como “en revisión”.
- **Resolver**: lo cierra cuando ya está arreglado.
- **Descargar .txt** o **.json**: guarda los logs en su computador.
- **Buscar errores**: refresca la lista.

Si hay errores **críticos sin atender**, verá una alerta roja al inicio de la
pestaña.

---

## 4. Pestaña “Actualizaciones”

Permite actualizar las librerías del sistema **de forma segura**.

1. Pulse **Buscar actualizaciones**.
2. Verá tarjetas con el resumen: total, parches, menores, mayores.
3. Las **mayores** muestran una advertencia amarilla y **NO se actualizan
   automáticamente**: hay que pedir al desarrollador que las revise.
4. Pulse **Actualizar librerías seguras** para aplicar solo parches y menores.
   Antes de actualizar, el sistema crea un respaldo automático.

Mensajes que verá:

- ✅ "Actualización completada."
- ⚠️ "No se recomienda actualizar esta librería automáticamente."
- ❌ "La actualización falló en algún paquete."

Si la actualización falla, el respaldo previo le permite volver atrás.

---

## 5. Pestaña “Respaldos”

Le permite **crear y restaurar respaldos** del sistema.

### Crear respaldo

Pulse **Crear respaldo ahora**. Se incluye:

- La base de datos completa.
- Los archivos subidos (grabaciones, imágenes, etc.).
- La configuración (sin contraseñas ni claves en texto plano).

Cada respaldo se guarda en la lista con fecha, tamaño y huella SHA-256.

### Restaurar respaldo

Solo se puede restaurar respaldos **exitosos**. La restauración pide:

1. **Doble confirmación** con casillas.
2. Escribir la palabra **RESTAURAR** exactamente.
3. Crea un respaldo automático adicional antes de tocar nada.

Una vez completada, conviene reiniciar el servicio.

---

## 6. Pestaña “Reiniciar”

Reinicia un componente del sistema cuando algo no responde:

- **Servidor del sistema** (backend).
- **Interfaz web** (frontend).
- **Servidor de llamadas** (Asterisk).
- **Caché y colas** (Redis).
- **TODO el sistema** (solo super administrador).

Cada opción muestra el riesgo, por ejemplo:

> "Las llamadas en curso se cortarán."

Antes de reiniciar el sistema le pide **confirmar**. Puede agregar un motivo
opcional. Cada reinicio queda registrado con fecha, usuario y resultado.

---

## 7. Pestaña “Auditoría”

Muestra el historial de **todo lo que se ha hecho desde el panel**:

- Quién (correo del usuario), cuándo, qué acción y resultado.
- IP desde la que se hizo.
- Notas opcionales.

Esto le permite saber, por ejemplo, quién reinició el servicio o quién
restauró un respaldo.

---

## 8. Mensajes que verá

| Mensaje                                                   | Significa                                          |
|-----------------------------------------------------------|----------------------------------------------------|
| Todo funciona correctamente                               | Todo OK.                                           |
| Hay un error en la conexión con la base de datos          | El sistema no puede leer/guardar datos.            |
| El servidor de llamadas NO responde                       | Las llamadas pueden estar caídas.                  |
| Actualización completada                                  | Las librerías se aplicaron sin problema.           |
| No se recomienda actualizar esta librería automáticamente | Es una versión MAYOR; pídale al desarrollador.     |
| Reinicio en curso                                         | El servicio está volviéndose a iniciar.            |
| Restauración completada                                   | El respaldo se restauró; reinicie por si acaso.    |

---

## 9. Buenas prácticas

1. **Antes de cualquier acción crítica**, cree un respaldo manual.
2. Si tiene dudas, **no confirme** la restauración: la palabra "RESTAURAR"
   está pensada para que solo se haga a propósito.
3. Después de actualizar librerías, vaya a **Estado** y compruebe que todo
   sigue en verde.
4. Si un error aparece varias veces seguidas, contacte al equipo de desarrollo
   y adjunte el archivo `.txt` o `.json` descargado de la pestaña Errores.

---

## 10. ¿Y si algo no se puede resolver desde el panel?

El panel está diseñado para resolver el 90 % de las situaciones cotidianas
**sin tocar código**. Si la situación no aparece en este manual o el panel
indica que la acción no es segura, contacte al desarrollador y adjunte:

- Captura de la pestaña **Estado**.
- Logs descargados desde **Errores**.
- ID del último respaldo o reinicio relevante.
