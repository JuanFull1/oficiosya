ENUNCIADO DEL SISTEMA (TRANSCRIPCIÓN LITERAL)
OficiosYA: Empleabilidad local y servicios por zona

En muchas ciudades, personas con habilidades prácticas (electricidad, plomería, reparación de equipos, carpintería, pintura, tutorías, diseño, soporte técnico, etc.) tienen dificultades para encontrar clientes de forma constante. A la vez, quienes necesitan un servicio suelen contratar por recomendación informal, sin información clara de disponibilidad, precios aproximados, reputación o cumplimiento. Esto genera subempleo, desconfianza, pérdida de oportunidades y tiempos de búsqueda altos.

Problema a resolver

Diseñar y modelar un sistema que permita conectar talento local (trabajadores/as por oficio) con personas que requieren un servicio, con mecanismos básicos de:

Publicación y búsqueda de servicios por zona

Solicitud y gestión de trabajos

Reputación (calificación y reseñas)

Verificación básica de identidad

Seguimiento del estado del servicio (solicitado, aceptado, finalizado, etc.)

Objetivo general

Modelar y posteriormente implementar (en el segundo parcial) una aplicación que permita a usuarios publicar solicitudes de servicio y a trabajadores/as ofertar y gestionar trabajos, priorizando la economía local y la confianza.

Alcance del sistema
Roles

Cliente: publica una solicitud de servicio o busca un trabajador/a.

Trabajador/a (Profesional de oficio): crea su perfil, publica servicios, acepta trabajos, finaliza servicios.

Administrador/a: gestiona reportes, revisa perfiles y controla parámetros generales.

Nota: un usuario puede registrarse como cliente y/o trabajador/a.

Requerimientos funcionales mínimos

RF1. Registro e inicio de sesión de usuarios.

RF2. Perfil de trabajador/a con: oficios/habilidades, descripción, zona de atención, disponibilidad (simple), y medios de contacto (según política del equipo).

RF3. Catálogo de servicios/oficios (categorías) gestionado por el sistema (mínimo un conjunto fijo).

RF4. Publicación de solicitudes por parte del cliente indicando: categoría, descripción, zona, fecha preferida y presupuesto opcional.

RF5. Búsqueda y filtrado de trabajadores/as por: oficio, zona, reputación y disponibilidad.

RF6. Postulación/Oferta a una solicitud: un trabajador/a puede enviar una propuesta (mensaje corto + valor estimado opcional).

RF7. Selección de trabajador/a: el cliente elige una propuesta o invita directamente a un trabajador/a.

RF8. Gestión del servicio por estados: el sistema debe permitir cambios de estado (p. ej.: solicitado → en negociación → confirmado → en curso → finalizado / cancelado).

RF9. Calificación y reseña al finalizar el servicio (cliente califica a trabajador/a y viceversa opcional).

RF10. Verificación básica de identidad (simple): mecanismo de verificación definido por el equipo (ej.: correo/teléfono + documento “marcado como verificado” por admin).

RF11. Reportes: clientes o trabajadores/as pueden reportar malas prácticas (motivo + evidencia opcional).

RF12. Administración básica: el administrador/a revisa reportes y aplica acciones (advertir, suspender, bloquear).

Requerimientos no funcionales (mínimos)

RNF1. Seguridad: autenticación, control de roles, protección de datos sensibles.

RNF2. Privacidad: la app mostrará información de contacto solo según reglas definidas (por ejemplo, después de confirmar un servicio).

RNF3. Usabilidad: interfaz simple orientada a móvil.

RNF4. Trazabilidad: registro de eventos clave (publicación, aceptación, cancelación, finalización).

Reglas y restricciones

La geolocalización exacta es opcional; el sistema trabajará por zona/barrio/sector.

El sistema no procesa pagos en línea en el MVP (si lo proponen, quedará como extensión).

Un cliente puede publicar múltiples solicitudes, pero el sistema debe evitar “spam” (regla simple, a criterio del equipo).

La reputación se calcula con promedio de calificaciones y cantidad de servicios completados.

El administrador/a puede suspender usuarios por reportes acumulados o verificación inconsistente.

Extras

Integración real con mapas en tiempo real (GPS tracking en vivo).

Aplicación adaptada para móvil.

DECISIÓN DEL PROYECTO

En este proyecto no vamos a dejar nada importante como opcional.

Vamos a implementar:

todos los requerimientos funcionales

todos los requerimientos no funcionales

y también los extras

Eso significa que para nosotros será obligatorio:

mapas

GPS tracking en vivo

aplicación adaptada para móvil

Además, aunque el enunciado dice que el sistema no procesa pagos en línea en el MVP, sí vamos a incorporar una solución de pago externo con confirmación manual dentro del sistema.

Esto quiere decir:

el sistema no cobrará directamente con pasarela interna

pero sí permitirá ver datos de pago

marcar “ya pagué”

subir comprobante opcional

y confirmar manualmente el pago dentro del sistema

Así mantenemos la regla del MVP, pero añadimos una solución funcional y realista.

CÓMO MANEJAREMOS EL PAGO

No habrá pasarela de pago integrada dentro del sistema.

El flujo será así:

El cliente verá un botón o sección de pago.

El sistema mostrará los datos para transferir:

banco

tipo de cuenta

número de cuenta

titular

cédula

monto

El cliente realizará el pago externamente desde su banca móvil o transferencia.

Luego el cliente marcará en el sistema:

“Ya pagué”

Opcionalmente podrá subir:

comprobante

captura

referencia

El trabajador o administrador confirmará el pago recibido.

El sistema cambiará el estado del pago.

Estados de pago sugeridos

pendiente

reportado por cliente

confirmado

rechazado

Esto no contradice el enunciado porque el sistema no procesa el pago en línea, solo gestiona su reporte y confirmación.

FULL STACK QUE USAREMOS
Frontend web

Next.js

React

TypeScript

Tailwind CSS

Backend y servicios principales

Supabase

autenticación

base de datos PostgreSQL

realtime

storage

Mapas y geolocalización

Google Maps

Geolocation API para web

tracking en tiempo real conectado con Supabase Realtime

Adaptación móvil

Capacitor

luego empaquetaremos la aplicación para Android y iOS

Hosting

Vercel para el frontend web

Supabase para backend, base de datos, autenticación y tiempo real

Control de versiones

GitHub

RESUMEN DE LO QUE HAREMOS

El proyecto OficiosYA será una plataforma para conectar clientes con trabajadores por oficio.

Permitirá:

registro e inicio de sesión

perfiles de cliente y trabajador

catálogo de oficios

publicación de solicitudes

búsqueda y filtrado

propuestas

selección de trabajador

gestión de estados del servicio

calificaciones y reseñas

verificación básica

reportes

administración

mapas

tracking en vivo del trabajador

adaptación móvil

y pago externo con confirmación manual

Enfoque del GPS

búsqueda general por zona

tracking exacto en vivo solo durante servicios activos

visualización del trabajador moviéndose en el mapa

Enfoque del pago

sin pasarela integrada

pago externo

confirmación manual dentro del sistema

RESUMEN PARA CONTINUAR EN OTRO CHAT

Estamos desarrollando OficiosYA: Empleabilidad local y servicios por zona.

Stack acordado

Next.js + React + TypeScript

Tailwind CSS

Supabase

Google Maps

Capacitor

Vercel

GitHub

Decisiones del proyecto

se implementarán todos los requerimientos funcionales

se implementarán todos los requerimientos no funcionales

los extras también serán obligatorios

el tracking en vivo del trabajador será una parte central del sistema

la geolocalización general será por zona, pero durante servicios activos habrá ubicación exacta en tiempo real

no se integrará una pasarela de pago interna en el MVP

sí se añadirá pago externo con confirmación manual dentro del sistema

Fases generales

construir la web base

implementar autenticación y perfiles

implementar solicitudes, propuestas y estados

integrar mapas

implementar tracking en vivo

integrar el flujo de pago externo con confirmación manual

adaptar a móvil con Capacitor

En el siguiente chat ya podemos empezar con la arquitectura del proyecto y la estructura de carpetas.