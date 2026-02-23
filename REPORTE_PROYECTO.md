# Reporte del Proyecto: Finanzas Generales V2.0

## 1. Resumen Ejecutivo
"Finanzas Generales" es una aplicación web progresiva (PWA) diseñada para gestionar de manera integral y ágil las finanzas personales y de negocios. El sistema permite a los usuarios manejar múltiples carteras (billeteras/wallets) de forma independiente, registrar ingresos y gastos de forma categorizada, y monitorear presupuestos y márgenes de ganancia.

La versión más reciente (V2.0) introdujo una sincronización en la nube con Supabase, una interfaz de usuario dinámica y gamificada centrada en el cumplimiento de metas, y capacidades avanzadas de clasificación automatizada de transacciones impulsadas por Inteligencia Artificial (DeepSeek AI).

---

## 2. Tecnologías Principales (Tech Stack)
* **Frontend:** HTML5, CSS3, JavaScript Vanilla (ES6+).
* **Herramientas de Construcción & Servidor local:** Vite.
* **Backend y Base de Datos:** Supabase (PostgreSQL, Autenticación y APIs RESTful).
* **Gráficos:** Chart.js (Doughnut charts para gastos).
* **Inteligencia Artificial:** DeepSeek V3 (vía OpenRouter API) para la auto-categorización inteligente de transacciones basadas en descripciones.
* **Alojamiento (Hosting):** GitHub Pages (con integración de GitHub Actions para despliegue continuo).
* **Estándares Web:** PWA (Progressive Web App) para instalación local en dispositivos móviles y de escritorio mediante `manifest.json`.

---

## 3. Arquitectura y Estructura de Archivos
Todos los componentes claves se encuentran en la carpeta `src/`, operando juntos mediante módulos de ES6 para escalar y mantener el código ordenado.

```text
finanzas-app/
├── index.html               # Interfaz principal (UI) y plantillas
├── vite.config.js           # Configuración del servidor y empaquetador de la app
├── package.json             # Dependencias del proyecto
├── import_new_data.js       # Script temporal de migración hacia Supabase
├── public/
│   └── manifest.json        # Archivo de configuración PWA
├── .github/workflows/
│   └── deploy.yml           # Pipeline CI/CD para GitHub Pages
└── src/
    ├── main.js              # Archivo de entrada: inicialización, UI, Event Listeners
    ├── state.js             # Gestor de memoria global y local (Local Storage Fallback)
    ├── supabase.js          # Conexiones, consultas y operaciones CRUD a la BD.
    ├── auto-categorize.js   # Lógica de Inteligencia artificial, reglas de usuario y fallback
    └── style.css            # Hoja de estilos principal (Variables CSS, Diseño responsivo, Temas Dinámicos)
```

---

## 4. Características Principales (Features)

### 4.1 Gestión Multi-Cartera (Wallets)
* Soporte para carteras "Personales" y "De Negocio".
* Transiciones fluidas entre carteras, manteniendo el estado filtrado (ej. Hogar vs Rand0m vs Dhash).
* Las carteras de negocio calculan automáticamente y de manera gráfica el "Margen de Ganancia" según ingresos/gastos.

### 4.2 Inteligencia Artificial: "Learning Loop" & Sugerencias
* **Clasificador (Auto Categorize):** Analiza en tiempo real las palabras ingresadas en la descripción del gasto/ingreso y se conecta a un LLM (DeepSeek) para adivinar el monto y sugerir la categoría de manera automática.
* **Ajuste Progresivo (Learning Loop):** Si el LLM falla o si el usuario clasifica algo de manera distinta de manera manual repetidas veces, el sistema memoriza esta preferencia y actualiza sus propias reglas para aplicarlas automáticamente la próxima vez.

### 4.3 Sistema de Metas vs. Deudas (Gamificación)
* Se eliminó el concepto estricto de "Deudas" y se reemplazó por "Metas" (Goals) para motivar el ahorro, el pago progresivo de servicios a largo plazo, y el seguimiento de inversiones.
* Barras de progreso visuales con celebraciones (confeti) al llegar a la meta.

### 4.4 Funcionalidad Offline y Persistencia
* Si falla la conexión a Supabase temporalmente, la app cuenta con soporte de "Drafts" a través del LocalStorage del navegador, asegurando cero pérdida de datos durante la captura rápida.

### 4.5 Temas Mensuales ("Monthly Theming")
* Incorpora un generador de esquemas de colores (colores acento, gradientes, menús) adaptativo, que cambia la paleta de colores del ecosistema automáticamente dependiendo de qué mes se esté visualizando (Ej. Enero=Azul hielo, Febrero=Verde Olivo, etc.).

---

## 5. Resumen de las Últimas Actualizaciones (V2.0.0)
1. **Migración a Base de Datos en Vivo (Supabase):** Implementación de una arquitectura asíncrona robusta. Reemplazando `localStorage` (como única fuente de verdad) con una base de datos PostgreSQL en tiempo real en la nube.
2. **Correcciones de UI y Responsividad:** Ajustes en espacios vacíos presentados en iPad y reestructuración completa de los formularios "modales".
3. **Formateo de Moneda Negativa:** Correcciones críticas en los resúmenes financieros permitiendo visualizar con precisión balances negativos con caracteres rojo mate.
4. **Despliegue Automático CI/CD:** El proyecto se enlaza automáticamente a `Rand0mArt/Finanzas-generales` vía GitHub Pages con las de "Acciones de Github", garantizando que los empujes (`pushes`) locales al branch `main` se publiquen automáticamente en internet y estén listos para el cliente.
5. **Migración de Datos Históricos:** Un script dedicado en node subió con éxito los históricos contables de febrero a la nueva base de unificando por completo los entornos contables a la V2.0.
