# Investigación: Cómo se calcula la planilla/nómina por país (Latinoamérica)

> Investigación de referencia para configurar `hr_employees` / `payroll_runs` / `paystubs`
> (Portal ERP → Nómina y Planillas) según el país donde se instale cada colegio.
> Cifras vigentes a la fecha de la investigación (sep. 2026) — **verificar siempre
> contra la fuente oficial del país antes de usarlas en producción real**, porque
> cambian con frecuencia (ver ejemplo de Panamá: la Ley 462 de 2025 subió la cuota
> patronal de la CSS a mitad de año).

## Qué varía entre países (los "ejes" que hay que poder configurar)

1. **Seguro social / salud / pensión**: casi todos los países tienen una cuota
   del empleado (se descuenta del salario) y una cuota del empleador (aparte,
   no sale del bolsillo del empleado pero sí del presupuesto del colegio). El
   % y cómo se llama la institución cambia totalmente país a país.
2. **Impuesto sobre la renta / ISR**: casi siempre es un cálculo por **tramos
   progresivos** sobre una base anualizada, no un % plano.
3. **"Mes extra" / aguinaldo / décimo tercer mes / prima**: existe en casi
   todos los países pero con nombre, frecuencia de pago (1, 2 o 3 veces al
   año) y base de cálculo distintos, y en algunos países ese pago también
   lleva su propia cuota de seguro social (distinta a la del salario normal).
4. **Vacaciones y liquidación/cesantía**: provisión mensual (% del salario)
   que se acumula para cuando el empleado sale o toma vacaciones.

## Resumen por país investigado

### 🇵🇦 Panamá (contexto actual de la app: ITBMS, Yappy, Banco General)
- **CSS empleado**: 9.75% del salario bruto, sin tope.
- **CSS empleador**: 13.25% (abril 2025 – feb 2027; sube a 14.25% en 2027 y 15.25% en 2029 — Ley 462 de 2025).
- **Décimo Tercer Mes**: tiene su propia cuota CSS, distinta a la del salario regular — empleado 7.25%, empleador 10.75%, calculada sobre el monto del décimo. Se paga en 3 partidas (abril, agosto, diciembre).
- **ISR (Impuesto Sobre la Renta) 2026**: 0% hasta B/.11,000 anuales, 15% de B/.11,001 a B/.50,000, 25% sobre el exceso — tramos progresivos sobre base anual.

### 🇲🇽 México
- **IMSS cuota obrera (empleado)**: suma de varios ramos (enfermedad/maternidad ~0.625%, cesantía y vejez 1.125%, etc.) — no es un solo número, son ~6 ramos distintos sobre el Salario Base de Cotización (SBC).
- **IMSS cuota patronal (empleador)**: también varios ramos (retiro 2.00%, riesgo de trabajo variable 3.15%–4.24% según industria, etc.) — significativamente más compleja que Panamá.
- **SBC**: no es el salario puro — integra aguinaldo, prima vacacional y bonos fijos vía un "factor de integración".
- **ISR**: tramos progresivos + "subsidio para el empleo" (crédito que reduce el ISR de salarios bajos).
- **Aguinaldo**: mínimo 15 días de salario al año, exento de ISR hasta cierto tope.

### 🇨🇴 Colombia
- **Salud**: 12.5% del IBC (Ingreso Base de Cotización), normalmente 4% empleado + 8.5% empleador (para salarios >4 SMMLV el empleado paga más).
- **Pensión**: 16% del IBC, normalmente 4% empleado + 12% empleador.
- **Prestaciones sociales** (a cargo 100% del empleador, no se descuentan al empleado): Prima de Servicios 8.33% (se paga en junio y diciembre), Cesantías 8.33% (se consignan anualmente a un fondo), Intereses sobre cesantías 12% anual sobre el saldo, Vacaciones 4.17%.
- El auxilio de transporte NO cuenta para el IBC de seguridad social, pero SÍ para liquidar prestaciones.

### 🇨🇷 Costa Rica
- **CCSS empleador**: 26.83% del salario bruto (SEM 9.25% + IVM 5.58% + FODESAF 5.00% + INA 1.50% + IMAS 0.50% + Banco Popular 0.50% + FCL 1.50% + Pensión Complementaria 2.00%) — es la suma de MUCHOS conceptos distintos.
- **CCSS empleado**: 10.83% (SEM 5.50% + IVM 4.33% + Banco Popular 1.00%).
- **Aguinaldo**: exento de renta y de cargas sociales sobre el monto que recibe el TRABAJADOR, pero el PATRONO sí paga sus cargas sociales patronales sobre el aguinaldo.

### 🇩🇴 República Dominicana
- **TSS empleado**: 2.87% AFP (pensión) + 3.04% SFS (salud) = 5.91%.
- **TSS empleador**: 7.10% AFP + 7.09% SFS + 1.10%–1.30% Riesgos Laborales + 1% INFOTEP ≈ 15.69%–15.99%.
- **Regalía Pascual** ("doble sueldo"): se provisiona mensualmente a razón de 8.33%, se paga en diciembre; NO se cotiza mensualmente a la TSS pero sí hay que provisionarla en el presupuesto.
- Hay topes de cotización (montos máximos sobre los que se calculan los aportes), a diferencia de Panamá que no tiene tope en la cuota del empleado.

## Conclusión para el diseño

No hay forma honesta de meter esto en un solo "% de deducción" configurable
(que es lo que hace hoy `POST /payroll/runs/:id/calculate` con
`deduction_rate`) — cada país tiene una estructura distinta de cuántos
"ramos" existen, si hay tope o no, y si el mes extra lleva su propia cuota
distinta. Lo mínimamente honesto es:

1. Agregar `country` (código ISO, ej. 'PA', 'MX', 'CO', 'CR', 'DO') a `tenants`.
2. Una tabla `payroll_country_rules` por país con, como mínimo: nombre del
   seguro social, % empleado, % empleador (pueden ser un solo número para
   países simples como Panamá, o requerir que se guarde ya la suma total
   de los ramos para países complejos como México/Costa Rica — un desglose
   ramo por ramo es más preciso pero es una tabla aparte y bastante más
   trabajo), nombre y frecuencia del "mes extra" (aguinaldo/décimo/prima/
   regalía), y si ese mes extra tiene su propia cuota distinta (como Panamá).
3. El botón "Calcular" de una planilla usaría el `% empleado` del país del
   colegio como valor por defecto (en vez de pedir un `deduction_rate`
   manual sin contexto), pero seguiría siendo editable a mano para casos
   especiales.
4. **Fuera de alcance por ahora** (se puede agregar después si se necesita):
   tramos de ISR/impuesto sobre la renta calculados automáticamente — es
   sustancialmente más trabajo (tablas de tramos que cambian cada año,
   distintas bases imponibles) y ningún colegio lo pidió todavía
   explícitamente; por ahora el ISR se puede seguir manejando fuera del
   sistema o como una deducción manual adicional en el recibo de pago.
