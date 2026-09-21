# Supuestos del modelo (JORNADA40)

Todos los datos son **sintéticos y deterministas** (seed fijo `4242`). Retailer ficticio "Tienda Aurora".
Ningún dato proviene de retailers reales; solo se usa su *patrón operativo* público y general (tienda
departamental/superficie: picos mediodía, sábado alto, domingo medio).

## Operación
- Horario de tienda: **09:00–21:00**, lunes a domingo (12h/día).
- Caso demo: **3 tiendas** × **~15 empleados** (escala legible para demo en 45 min). El modelo de datos
  soporta ~50 tiendas × ~80 FTEs sin cambios; el seed lo demuestra con `STORE_COUNT=50 npm run db:seed`.

## Demanda
- Tráfico por tienda/día/hora generado con curva realista: valle 9–11h, pico 13–16h, pico 18–20h,
  sábado ~+35%, domingo ~+10%, lunes bajo.
- **Headcount requerido por hora** = `ceil(tráfico_h / 12 clientes por empleado·h)` con mínimo operativo
  de 2 empleados en piso.
- Ventas históricas agregadas (por tienda/día) correlacionadas con tráfico; se usan como referencia
  visual y validación de coherencia, no como input del solver.

## Turnos y restricciones duras
- Plantillas: bloques de **4, 6 y 8 horas** dentro del horario de tienda, inicio en hora exacta.
- **≤ 40 horas/semana por empleado** (reforma Jornada 40 / LFT art. 61 en 40h).
- **≥ 1 día de descanso semanal completo** (LFT art. 69).
- **Cobertura ≥ demanda en cada hora** (no subdotación en ninguna hora, incluidas picos).
- Máximo 1 turno por empleado por día.

## Costos (MXN)
- Tarifa por hora según rol: Supervisor 95, Vendedor 70, Cajero 62, Almacén 58.
- **Horas extra** (>40h/semana): ×1.5 (línea base "actual" las incluye; la propuesta no debe tenerlas).
- **Prima dominical**: +25% sobre tarifa de las horas trabajadas el domingo.
- Costo semanal = Σ horas×tarifa (+ primas). Ahorro = costo línea base − costo propuesto.

## Línea base "actual" (la programación que se mejora)
- Turnos fijos planos (todos 9–18h o 10–19h) sin ajuste a demanda → sobrestaffing en valle.
- ~25% de la plantilla con **horas extra** (turnos de 10–11h o 6 días) → costo extra.
- Se siembra con el mismo generador, por lo que la comparación es estrictamente como a como.

## Criterio de éxito del reto
- Ahorro total ≥ **8%** del costo laboral semanal, sin violar ninguna restricción dura.
- Con los supuestos anteriores el solver alcanza típicamente **12–20%** de ahorro (validado en tests),
  dejando margen ante preguntas del CFO en la demo.
