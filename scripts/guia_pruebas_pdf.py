"""Genera docs/guia-de-pruebas.pdf: guía paso a paso para que el equipo pruebe todo el sistema.

    pip install reportlab
    python scripts/guia_pruebas_pdf.py

Si cambia algo (comandos, pantallas, puertos), editar el texto de abajo y volver a generar.
Nunca poner valores de secretos en este archivo: el PDF va al repo.
"""
from __future__ import annotations

from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    KeepTogether,
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    Preformatted,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

OUT = Path(__file__).resolve().parent.parent / "docs" / "guia-de-pruebas.pdf"
TITLE = "Guía de pruebas paso a paso"
SUBTITLE = "Seguimiento de mascotas · Grupo 1 · Variante Ahorro de energía"

# ------------------------------------------------------------------ estilos ---
ACCENT = colors.HexColor("#1f5f8b")
SOFT = colors.HexColor("#eef4f8")
CODE_BG = colors.HexColor("#f3f3f3")
TIP = {"idea": ("#e8f5e9", "#2e7d32", "Tip"), "ojo": ("#fff4e5", "#b26a00", "Ojo"),
       "seguridad": ("#fdecea", "#b71c1c", "Seguridad"), "ok": ("#e8f0fe", "#1a4fa0", "Qué tenés que ver")}

ss = getSampleStyleSheet()
BODY = ParagraphStyle("body", parent=ss["Normal"], fontName="Helvetica", fontSize=10, leading=14.5, spaceAfter=5)
SMALL = ParagraphStyle("small", parent=BODY, fontSize=8.5, leading=11.5, spaceAfter=0)
CELL = ParagraphStyle("cell", parent=BODY, fontSize=9, leading=12, spaceAfter=0)
CELL_B = ParagraphStyle("cellb", parent=CELL, fontName="Helvetica-Bold", textColor=colors.white)
H1 = ParagraphStyle("h1", parent=ss["Heading1"], fontName="Helvetica-Bold", fontSize=17, leading=21,
                    textColor=ACCENT, spaceBefore=4, spaceAfter=8)
H2 = ParagraphStyle("h2", parent=ss["Heading2"], fontName="Helvetica-Bold", fontSize=12.5, leading=16,
                    textColor=ACCENT, spaceBefore=10, spaceAfter=5)
CODE = ParagraphStyle("code", fontName="Courier", fontSize=8.6, leading=11, textColor=colors.HexColor("#222222"))


def c(text: str) -> str:
    """Texto en línea con formato de código."""
    return f'<font face="Courier" color="#8a1c1c">{escape(text)}</font>'


def p(text: str, style=BODY):
    return Paragraph(text, style)


def h1(text: str):
    return p(text, H1)


def h2(text: str):
    return p(text, H2)


def code(text: str):
    t = Table([[Preformatted(text.strip("\n"), CODE)]], colWidths=[16.4 * cm])
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), CODE_BG),
                           ("BOX", (0, 0), (-1, -1), 0.4, colors.HexColor("#cccccc")),
                           ("LEFTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 5),
                           ("BOTTOMPADDING", (0, 0), (-1, -1), 5)]))
    return KeepTogether([t, Spacer(1, 6)])


def tip(kind: str, text: str):
    bg, fg, label = TIP[kind]
    t = Table([[p(f'<font color="{fg}"><b>{label}:</b></font> {text}', CELL)]], colWidths=[16.4 * cm])
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(bg)),
                           ("LINEBEFORE", (0, 0), (0, -1), 3, colors.HexColor(fg)),
                           ("LEFTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 5),
                           ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
    return KeepTogether([t, Spacer(1, 7)])


def steps(items: list, start: int = 1):
    return ListFlowable([ListItem(p(i) if isinstance(i, str) else i, leftIndent=14) for i in items],
                        bulletType="1", start=start, bulletFontName="Helvetica-Bold", bulletColor=ACCENT,
                        leftIndent=16, spaceAfter=4)


def bullets(items: list):
    return ListFlowable([ListItem(p(i), leftIndent=12) for i in items], bulletType="bullet",
                        start="•", leftIndent=14, bulletColor=ACCENT, spaceAfter=4)


def checks(items: list):
    return ListFlowable([ListItem(p(i), leftIndent=16) for i in items], bulletType="bullet",
                        start="[  ]", leftIndent=20, bulletFontName="Courier", spaceAfter=4)


def table(header: list[str], rows: list[list[str]], widths: list[float]):
    data = [[p(h, CELL_B) for h in header]] + [[p(x, CELL) for x in r] for r in rows]
    t = Table(data, colWidths=[w * cm for w in widths], repeatRows=1)
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), ACCENT),
                           ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, SOFT]),
                           ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#c5d3dd")),
                           ("VALIGN", (0, 0), (-1, -1), "TOP"),
                           ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                           ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]))
    return KeepTogether([t, Spacer(1, 8)]) if len(rows) < 12 else t


# ------------------------------------------------------------------ contenido ---
def content() -> list:
    s: list = []

    # Portada
    s += [Spacer(1, 4.5 * cm),
          p(TITLE, ParagraphStyle("t", parent=H1, fontSize=28, leading=34, alignment=TA_CENTER)),
          p(SUBTITLE, ParagraphStyle("st", parent=BODY, fontSize=13, alignment=TA_CENTER, textColor=ACCENT)),
          Spacer(1, 1.2 * cm),
          p("Para el equipo de desarrollo. Explica cómo probar todo el sistema, desde los tests "
            "automáticos hasta la simulación con Wokwi y las placas reales, sin dar nada por sabido.",
            ParagraphStyle("pc", parent=BODY, alignment=TA_CENTER)),
          Spacer(1, 0.4 * cm),
          p("Versión del 23/11/2026 · Entrega: jueves 26/11/2026",
            ParagraphStyle("pd", parent=SMALL, alignment=TA_CENTER, textColor=colors.grey)),
          Spacer(1, 2.5 * cm),
          tip("seguridad", "este documento <b>no tiene ningún secreto</b> y nunca debe tenerlos (va al repo). "
              "Las claves reales se pasan por un canal privado, nunca por el chat del grupo ni en commits."),
          PageBreak()]

    # Índice
    s += [h1("Contenido"),
          steps(["Cómo está armado el sistema (en un minuto)",
                 "Preparar la PC (una sola vez)",
                 "Configurar las claves (una sola vez)",
                 "Nivel A — Tests automáticos (5 minutos)",
                 "Levantar todo para probar a mano (cada vez)",
                 "Nivel B — Probar la página con la “unidad de prueba” (sin placas ni Wokwi)",
                 "Nivel C — Probar con las dos placas simuladas en Wokwi",
                 "Probar las fallas (robustez)",
                 "Nivel D — Probar con las placas reales (para el jueves)",
                 "Probar con otros grupos",
                 "Problemas frecuentes y cómo resolverlos",
                 "Checklist antes de la demo",
                 "Glosario"]),
          PageBreak()]

    # 1
    s += [h1("1. Cómo está armado el sistema (en un minuto)"),
          p("La idea del producto: un <b>collar</b> con GPS le manda la posición de la mascota a una "
            "<b>unidad</b> que tiene el dueño, por radio (LoRa). La unidad se la pasa por Bluetooth al "
            "<b>celular</b> (app Ovenbird Smart), que la sube a la nube de <b>Ovenbird</b>. Nuestra "
            "<b>página web</b> (frontend) y nuestro <b>servidor</b> (backend) muestran las mascotas en un mapa "
            "y permiten elegir el modo <b>Normal</b> o <b>Ahorro</b> de batería."),
          table(["Pieza", "Qué es", "Dónde está en el repo"], [
              ["Collar", "Arduino Nano + radio LoRa + GPS", c("firmware/src/collar")],
              ["Unidad", "ESP32 + radio LoRa + Bluetooth", c("firmware/src/unit")],
              ["Celular", "App Ovenbird Smart (de la cátedra)", "— (se baja de la plataforma)"],
              ["Ovenbird", "La nube de la cátedra: guarda posiciones y comandos", "—"],
              ["Backend", "Nuestro servidor: usuarios, mascotas, collares, modo ahorro", c("backend/")],
              ["Base de datos", "Supabase (Postgres) en tu PC con Docker", c("supabase/")],
              ["Frontend", "La página web que ve el usuario", c("frontend/")],
          ], [2.6, 8.2, 5.6]),
          h2("Qué reemplazamos cuando no hay placas"),
          table(["Si no tenés…", "Lo reemplaza…", "Qué se prueba"], [
              ["Las placas", "<b>Wokwi</b>: simula el Nano y el ESP32 con nuestro mismo código",
               "Todo el firmware, menos la radio y el Bluetooth físicos"],
              ["La radio y el celular", "El <b>puente</b> " + c("radiosim_bridge.py") +
               ": hace de “aire” entre las dos placas y de celular con la app",
               "Que la trama viaje bien, el ahorro llegue al collar y vuelva la confirmación"],
              ["Todo lo de abajo (placas, Wokwi, celular)", "La <b>unidad de prueba</b> " +
               c("unidad_prueba.py") + ": se empareja sola y manda posiciones",
               "La página, el servidor, la base y Ovenbird, sin depender de Wokwi"],
          ], [3.6, 7.0, 5.8]),
          h2("Los cuatro niveles de prueba"),
          table(["Nivel", "Qué prueba", "Cuándo usarlo", "Tiempo"], [
              ["<b>A</b> Tests automáticos", "Que nada se haya roto", "Siempre, antes de cada commit", "5 min"],
              ["<b>B</b> Página + unidad de prueba", "Toda la parte web con Ovenbird real",
               "Para probar pantallas, sin gastar minutos de Wokwi", "15 min"],
              ["<b>C</b> Wokwi completo", "Todo, incluido el firmware de las dos placas",
               "Para la demo en simulación y la robustez", "30 min"],
              ["<b>D</b> Placas reales", "Lo mismo con hardware de verdad", "El jueves", "—"],
          ], [4.0, 5.0, 5.4, 2.0]),
          PageBreak()]

    # 2
    s += [h1("2. Preparar la PC (una sola vez)"),
          p("Todo está pensado para <b>Windows con PowerShell</b> (la terminal azul o la de VS Code). "
            "Instalá estos programas; si ya los tenés, pasá al siguiente."),
          table(["Programa", "Para qué", "Cómo se instala"], [
              ["Git", "Bajar el repo", "git-scm.com · siguiente, siguiente…"],
              ["Node.js 22 o más nuevo", "Correr backend y frontend", "nodejs.org (versión LTS)"],
              ["Python 3.12", "Scripts del puente y tests", "python.org · tildar <b>Add python to PATH</b>"],
              ["PlatformIO", "Compilar el firmware", c("pip install platformio")],
              ["Docker Desktop", "Necesario para la base de datos local", "docker.com · dejarlo abierto"],
              ["Supabase CLI", "Levantar la base local", c("scoop install supabase") +
               " (con Scoop) o usar " + c("npx supabase ...")],
              ["wokwi-cli", "Simular las placas desde la terminal", c("iwr https://wokwi.com/ci/install.ps1 -useb | iex")],
              ["VS Code (opcional)", "Ver las placas simuladas en pantalla", "code.visualstudio.com + extensión <b>Wokwi Simulator</b>"],
          ], [3.6, 5.0, 7.8]),
          h2("Bajar el repo e instalar dependencias"),
          code("""git clone https://github.com/getJoelValotta/iot-ahorro-genergia.git
cd iot-ahorro-genergia
pip install pyserial pytest
cd backend;  npm ci;  cd ..
cd frontend; npm ci;  cd .."""),
          tip("idea", "si " + c("npm ci") + " se queja de versiones (“peer dependencies”), no hace falta "
              "hacer nada raro: el repo ya trae un " + c(".npmrc") + " que lo resuelve. Si falla igual, "
              "borrá la carpeta " + c("node_modules") + " y probá de nuevo."),
          h2("Chequeo rápido"),
          code("powershell -ExecutionPolicy Bypass -File scripts\\setup.ps1"),
          p("Te dice qué herramientas encontró (" + c("OK") + ") y cuáles faltan (" + c("FALTA") + "). "
            "Que falte " + c("WOKWI_CLI_TOKEN") + " es normal hasta el paso 7."),
          PageBreak()]

    # 3
    s += [h1("3. Configurar las claves (una sola vez)"),
          tip("seguridad", "las claves van <b>solo</b> en archivos " + c(".env") + " de tu PC, que git ignora. "
              "Nunca las pegues en el chat del grupo, en un issue, en un commit ni en Wokwi (los proyectos "
              "gratis de Wokwi son públicos). Si alguna se filtra, avisá para cambiarla."),
          h2("Backend: archivo backend/.env"),
          steps([
              "Copiá la plantilla: " + c("copy backend\\.env.example backend\\.env"),
              "Abrí " + c("backend/.env") + " con VS Code y completá lo que está vacío:",
          ]),
          table(["Variable", "De dónde sale"], [
              [c("JWT_SECRET"), "La inventás vos. Generala con: " +
               c("node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\"")],
              [c("SUPABASE_URL"), "Ya viene: " + c("http://127.0.0.1:54331")],
              [c("SUPABASE_SERVICE_ROLE_KEY"), "Después del paso 5 (" + c("supabase start") +
               "), corré " + c("supabase status") + " y copiá la clave <b>service_role</b> (o “Secret key”)."],
              [c("OVENBIRD_CLIENT_ID"), "Pedísela a quien administra el proyecto de Ovenbird del grupo, "
               "<b>por un canal privado</b>."],
              [c("OVENBIRD_CLIENT_SECRET"), "Igual que la anterior. Es la clave más delicada: solo vive acá."],
              ["El resto", "Dejá los valores que vienen (puertos, 1000 mAh, 15 s / 150 s)."],
          ], [5.0, 11.4]),
          h2("Frontend: archivo frontend/.env.local"),
          code("copy frontend\\.env.example frontend\\.env.local"),
          p("No hay que cambiar nada para probar en tu PC. Este archivo <b>no lleva secretos</b>."),
          h2("Ovenbird: permitir la página"),
          p("En la plataforma Ovenbird (Cuenta › proyecto) tienen que estar cargados los orígenes "
            + c("http://localhost:3000") + " y " + c("http://localhost:3001") +
            ". Ya están cargados para nuestro proyecto; si el mapa no carga, revisá esto primero."),
          PageBreak()]

    # 4
    s += [h1("4. Nivel A — Tests automáticos"),
          p("Son programas que prueban el código solos. Corren también en GitHub cada vez que alguien hace "
            "push (pestaña <b>Actions</b> del repo: tiene que estar en verde)."),
          code("""cd firmware;         pio test -e native;      cd ..
cd firmware\\tools;  python -m pytest -q;     cd ..\\..
cd backend;          npm test;                cd ..
cd frontend;         npm test;                cd .."""),
          table(["Comando", "Qué prueba", "Resultado esperado"], [
              [c("pio test -e native"), "Protocolo de radio, Bluetooth y lógica del collar y la unidad",
               c("32 test cases: 32 succeeded")],
              [c("python -m pytest -q"), "El puente, el “celular falso” y la unidad de prueba", c("36 passed")],
              [c("npm test") + " (backend)", "Las 14 rutas del contrato, la variante, errores, seguridad",
               c("Tests: 107 passed")],
              [c("npm test") + " (frontend)", "El intermediario que guarda la sesión en una cookie segura",
               c("Tests 14 passed")],
          ], [4.0, 7.4, 5.0]),
          tip("idea", "los números pueden subir con el tiempo; lo importante es que no haya ningún "
              + c("failed") + " ni " + c("FAIL") + ". Antes de un commit corré también "
              + c("npm run lint") + " en backend y frontend."),
          PageBreak()]

    # 5
    s += [h1("5. Levantar todo para probar a mano"),
          p("Cada vez que quieras usar la página necesitás <b>tres cosas prendidas</b>. Abrí tres terminales "
            "(en VS Code: menú Terminal › New Terminal, tres veces), todas parados en la carpeta del repo."),
          steps([
              "Abrí <b>Docker Desktop</b> y esperá a que diga que está corriendo.",
              "<b>Terminal 1 — base de datos:</b> " + c("supabase start") + " (la primera vez tarda varios minutos "
              "porque baja imágenes). Si es la primera vez, ahora completá " + c("SUPABASE_SERVICE_ROLE_KEY") +
              " (paso 3).",
              "<b>Terminal 2 — backend:</b> " + c("cd backend") + " y " + c("npm run start:dev") +
              ". Esperá el mensaje " + c("Backend en http://localhost:3001/api/v1"),
              "<b>Terminal 3 — frontend:</b> " + c("cd frontend") + " y " + c("npm run dev") +
              ". Esperá " + c("Ready") + ".",
          ]),
          table(["Dirección", "Qué es"], [
              [c("http://localhost:3000"), "<b>La página</b> (lo que ve el usuario)"],
              [c("http://localhost:3001/api/v1/capabilities"), "Prueba rápida del backend: tiene que mostrar "
               + c('{"apiVersion":"1","variants":["power-saving"]}')],
              [c("http://localhost:3001/api/docs"), "Swagger: la documentación de la API, se puede probar desde ahí"],
              [c("http://localhost:54333"), "Supabase Studio: ver las tablas de la base (usuarios, mascotas)"],
          ], [6.6, 9.8]),
          tip("ojo", "si el backend se cierra con " + c("Configuración inválida del backend") +
              ", te falta completar alguna variable de " + c("backend/.env") + " (el mensaje dice cuál)."),
          h2("Para apagar"),
          p("En cada terminal, " + c("Ctrl+C") + ". La base: " + c("supabase stop") +
            ". Para empezar la base de cero (borra todos los datos de prueba): " + c("supabase db reset") + "."),
          PageBreak()]

    # 6
    s += [h1("6. Nivel B — Probar la página con la unidad de prueba"),
          p("Esta es la forma <b>más fácil</b> de probar toda la parte web con Ovenbird de verdad, sin placas y "
            "sin gastar minutos de Wokwi. La “unidad de prueba” es un script que se empareja con el código "
            "de la página, manda posiciones que dan vueltas por Mar del Plata y responde los cambios de modo."),
          p("Con todo levantado (paso 5), abrí " + c("http://localhost:3000") + " y seguí estos pasos:"),
          steps([
              "<b>Crear cuenta:</b> botón <b>Crear cuenta</b>, completá nombre, email (puede ser inventado, "
              "por ejemplo " + c("prueba1@example.test") + ") y una contraseña de 8 o más caracteres. "
              "Tenés que entrar a <b>Mis mascotas</b>, vacío.",
              "<b>Crear mascota:</b> “Nueva mascota”, nombre y especie. Aparece una tarjeta con “Sin collar”. "
              "Probá también <b>Editar</b> desde la ficha.",
              "<b>Generar código:</b> menú <b>Emparejar</b> › “Generar código”. Aparece un código tipo "
              + c("ABC-123") + " con una cuenta regresiva de 10 minutos.",
              "<b>Encender la unidad de prueba:</b> en una cuarta terminal, desde la carpeta del repo:"
              + "<br/>" + c("python firmware\\tools\\unidad_prueba.py --pair-code ABC-123") +
              "<br/>(con el código que te dio la página). Tiene que decir “emparejada en Ovenbird” y empezar a "
              "mostrar reportes con posición y batería. Dejala andando.",
              "<b>Ver la unidad:</b> en Emparejar, abajo, en “Tus dispositivos” aparece "
              "<b>OB-0009 (unidad de prueba)</b> “En línea” (si no, recargá la página).",
              "<b>Vincular:</b> entrá a la ficha de la mascota, elegí la unidad en la lista y tocá "
              "<b>Vincular</b>. Tiene que decir “En línea · Visto recién” y aparecer la tarjeta "
              "<b>Batería y ahorro</b> con la batería y cuántas horas o días dura en cada modo.",
              "<b>Mapa:</b> menú <b>Mapa</b>. La mascota aparece cerca del puerto de Mar del Plata, con estado "
              "y batería. Tocala en la lista y el mapa se centra en ella. Si esperás, se va moviendo.",
              "<b>Activar ahorro:</b> en la ficha, mové el interruptor a <b>Ahorro</b>. Primero dice "
              "“Enviando…” y a los pocos segundos <b>“Aplicado en el collar”</b>. En la terminal de la unidad "
              "aparece " + c("modo AHORRO (confirmado)") + ".",
              "<b>Volver a Normal:</b> mismo interruptor; también se confirma.",
              "<b>Collar que no responde:</b> cortá la unidad (" + c("Ctrl+C") + "), generá otro código y "
              "volvé a encenderla con " + c("--no-responder") + " al final. Cambiá el modo: tiene que decir "
              "<b>“El collar no respondió. Probá de nuevo.”</b> La mascota sigue vinculada (se re-empareja "
              "la misma unidad).",
              "<b>Desvincular y borrar:</b> en la ficha, “Desvincular”; después “Borrar” (pide confirmación).",
          ]),
          tip("ok", "cada pantalla muestra “Cargando…” mientras espera y un mensaje claro si algo falla; "
              "nunca un error técnico ni la página en blanco."),
          h2("Probar que cada usuario ve solo lo suyo"),
          steps([
              "Abrí una <b>ventana de incógnito</b> (" + c("Ctrl+Shift+N") + ") en " + c("http://localhost:3000") +
              " y creá otra cuenta.",
              "No tiene que ver las mascotas ni la unidad del primer usuario.",
              "Copiá la dirección de la ficha de una mascota del primer usuario (" + c("/pets/...") + ") y abrila "
              "en la ventana de incógnito: tiene que decir que no la encuentra.",
          ]),
          h2("Opciones de la unidad de prueba"),
          table(["Opción", "Para qué"], [
              [c("--pair-code ABC-123"), "Obligatoria: el código que muestra la página (sirve una vez, 10 min)."],
              [c("--no-responder"), "Simula un collar que no contesta: la página muestra “El collar no respondió”."],
              [c("--bateria 20"), "Empieza con 20 % de batería (para ver cómo cambia la autonomía)."],
              [c("--uid 02:47:31:00:00:10"), "Otra unidad distinta (para tener dos mascotas en el mapa). "
               "Usar siempre UIDs inventados, nunca la MAC de una placa real."],
          ], [5.0, 11.4]),
          tip("idea", "la app oficial <b>Ovenbird Smart</b> también tiene un “modo simulado” que puede servir "
              "para lo mismo (APK en la plataforma, " + c("/descargas/ovenbird-smart.apk") +
              "). Nosotros no lo probamos todavía."),
          PageBreak()]

    # 7
    s += [h1("7. Nivel C — Probar con las dos placas simuladas en Wokwi"),
          p("Acá corre <b>nuestro firmware de verdad</b>: el collar (Nano) y la unidad (ESP32), cada uno en su "
            "simulación. Como Wokwi no simula la radio ni el Bluetooth, el <b>puente</b> "
            + c("radiosim_bridge.py") + " hace de aire entre las dos placas y de celular con la app."),
          h2("7.1 Token de Wokwi (una sola vez)"),
          steps([
              "Entrá a " + c("https://wokwi.com/dashboard/ci") + " con tu cuenta y creá un token.",
              "En PowerShell: " + c('setx WOKWI_CLI_TOKEN "el-token"') + " y <b>cerrá y abrí</b> la terminal.",
              "Comprobá con " + c("wokwi-cli --version") + ".",
          ]),
          tip("seguridad", "el token es personal: no lo compartas ni lo subas al repo."),
          h2("7.2 Compilar el firmware para simulación"),
          code("cd firmware\npio run -e collar_sim -e unit_sim"),
          p("Tarda la primera vez (baja las herramientas). Tiene que terminar en " + c("SUCCESS") + "."),
          h2("7.3 Opción 1: desde la terminal (la que usamos)"),
          p("Necesitás todo lo del paso 5 andando, y <b>tres terminales más</b>, todas en " + c("firmware") + ":"),
          steps([
              "<b>Terminal A — unidad:</b> " + c("wokwi-cli wokwi/unit --timeout 300000"),
              "<b>Terminal B — collar:</b> " + c("wokwi-cli wokwi/collar --timeout 300000"),
              "En la página: <b>Emparejar › Generar código</b>.",
              "<b>Terminal C — puente</b> (una sola línea, con tu código):" + "<br/>" +
              c("python tools/radiosim_bridge.py --collar rfc2217://localhost:4000 --unit rfc2217://localhost:4001 "
                "--cloud --pair-code ABC-123 --uid 02:47:31:00:00:01"),
          ]),
          tip("ok", "en el puente ves " + c("unidad emparejada en Ovenbird") +
              " y después, cada 15 segundos, una línea " + c("TEL") + " con lo que mandó el collar (posición, "
              "batería y " + c("g1_modo=normal I=15s") + ") y los reportes que suben a Ovenbird. Desde ahí, seguí los pasos 5 a 9 del "
              "Nivel B: vincular, mapa, ahorro, normal."),
          p("Diferencias con el Nivel B, que conviene mostrar en la demo:"),
          bullets([
              "Al activar <b>Ahorro</b>, las líneas " + c("TEL") + " del puente pasan a decir " +
              c("[AHORRO] ... g1_modo=ahorro I=150s") + " y llegan cada <b>150 s</b> en vez de 15 s. El collar apaga el GPS entre reportes.",
              "Al volver a <b>Normal</b> estando en ahorro, “Enviando…” puede durar <b>hasta 2 minutos y "
              "medio</b>: el collar solo escucha justo después de cada reporte, y la unidad le guarda la orden "
              "hasta ese momento. Es lo esperado (así ahorra batería).",
              "En la consola del puente podés escribir " + c("find 10") + " para hacer sonar el collar 10 s.",
          ]),
          h2("7.4 Opción 2: con VS Code (para ver las placas)"),
          p("Sirve para ver el circuito (LEDs, buzzer, botones) y también cuando se agota la cuota de la terminal."),
          steps([
              "Instalá la extensión <b>Wokwi Simulator</b> y activá la licencia gratis: " + c("F1") +
              " › “Wokwi: Request a New License”.",
              "Ventana 1: abrí la carpeta del repo. " + c("F1") + " › “Wokwi: Select Config File” › "
              + c("firmware/wokwi/unit/wokwi.toml") + ". Después " + c("F1") + " › “Wokwi: Start Simulator”.",
              "Ventana 2: Archivo › Nueva ventana › abrir la carpeta " + c("firmware/wokwi/collar") +
              " y arrancar el simulador igual.",
              "Dejá <b>visibles las dos pestañas del simulador</b> (si se ocultan, la simulación se puede pausar).",
              "Corré el mismo puente de la Opción 1 (Terminal C).",
          ]),
          p("Qué mirar en las placas: en el collar, el LED <b>GPS ON</b> (en ahorro se prende solo antes de cada "
            "reporte), el LED y el buzzer de <b>FIND_ME</b>, y la <b>perilla</b> que simula la batería (girala y "
            "mirá cómo cambia en la página). En la unidad, el LED de “en línea” y dos botones: FIND_ME 10 s y "
            "cambiar ahorro/normal."),
          tip("ojo", "esta opción con VS Code está documentada pero no la probamos paso a paso; si algo no "
              "coincide, ver " + c("docs/04-wokwi.md") + "."),
          h2("7.5 Límites del plan gratis de Wokwi"),
          bullets([
              "Cada simulación por terminal se <b>corta a los 5 minutos</b>. El puente se cierra solo. Para "
              "seguir: volvé a lanzar las dos placas, generá <b>otro código</b> y corré el puente de nuevo "
              "(la unidad conserva su identidad y la mascota sigue vinculada).",
              "Hay una <b>cuota de minutos por mes</b>. Si aparece " + c("monthly CI minute quota") +
              ", usá la Opción 2 (VS Code) o el Nivel B.",
              "En simulación el collar escucha <b>3 s</b> después de cada reporte (en la placa real, 0,5 s): "
              "las dos simulaciones se hablan por internet y necesitan ese margen.",
          ]),
          PageBreak()]

    # 8
    s += [h1("8. Probar las fallas (robustez)"),
          p("La consigna pide que el sistema aguante datos perdidos, repetidos o dañados. Con el puente andando "
            "(Nivel C), escribí estos comandos <b>en la consola del puente</b> y apretá Enter:"),
          table(["Escribí", "Qué simula", "Qué tenés que ver"], [
              [c("chaos loss=0.3"), "Se pierde el 30 % de lo que va por el aire",
               "En el puente, " + c("chaos: trama perdida") + ". El mapa sigue actualizándose, con algún salto."],
              [c("chaos dup=0.5"), "La mitad de las tramas llegan repetidas",
               "La unidad dice " + c("tel duplicada seq=...") + " y no la sube dos veces."],
              [c("chaos corrupt=0.3"), "Tramas con bytes cambiados",
               "La unidad dice " + c("rx descartada") + " y sigue con la siguiente sin trabarse."],
              [c("chaos loss=1"), "Se corta el enlace por completo",
               "Cambiá el modo en la página: a los segundos, <b>“El collar no respondió”</b>."],
              [c("chaos loss=0 dup=0 corrupt=0"), "Vuelve todo a la normalidad",
               "Todo sigue andando, sin reiniciar nada."],
          ], [4.4, 4.6, 7.4]),
          h2("Otras fallas que se pueden mostrar"),
          table(["Hacé esto", "Qué tiene que pasar"], [
              ["Cortá el backend (" + c("Ctrl+C") + " en su terminal) y navegá la página",
               "La página muestra un mensaje de error, no se cuelga. Al volver a levantarlo, anda."],
              ["Desconectá internet unos segundos con el puente andando",
               "El puente reintenta solo y sube los reportes guardados cuando vuelve la conexión."],
              ["Cortá la unidad de prueba o una simulación",
               "Al rato la mascota figura como desconectada y con “Visto hace…”."],
              ["Mandá algo inválido desde Swagger (por ejemplo una mascota sin nombre)",
               "Respuesta 400 con el campo que está mal, explicado en castellano."],
          ], [7.0, 9.4]),
          PageBreak()]

    # 9
    s += [h1("9. Nivel D — Probar con las placas reales (para el jueves)"),
          p("Es el mismo recorrido; cambian las placas y el celular reemplaza al puente."),
          tip("ojo", "<b>nunca enciendas un módulo LoRa sin su antena conectada</b>: se puede dañar. Y el GPS "
              "necesita ver el cielo (cerca de una ventana o afuera) para tener posición; bajo techo puede tardar mucho."),
          steps([
              "Compilá y grabá el collar (Nano por USB): " + c("cd firmware") + " y " +
              c("pio run -e collar_lora -t upload"),
              "Grabá la unidad (ESP32): " + c("pio run -e unit_lora -t upload"),
              "Para ver qué dice cada placa: " + c("pio device monitor -b 115200") +
              " (si hay dos conectadas, elegí el puerto, por ejemplo " + c("-p COM5") + ").",
              "Instalá en un Android la app <b>Ovenbird Smart</b> (APK en la plataforma, "
              + c("/descargas/ovenbird-smart.apk") + ") y activá el Bluetooth.",
              "En la página: <b>Emparejar › Generar código</b>.",
              "En la app: <b>Agregar dispositivo</b> › elegí la unidad que aparece como " + c("OB-xxxx") +
              " › ingresá el código.",
              "Seguí desde el paso 5 del Nivel B (vincular, mapa, ahorro, normal).",
          ]),
          tip("idea", "si la grabación del Nano falla, puede ser un Nano con el “bootloader viejo”: en "
              + c("platformio.ini") + " probá cambiar " + c("board = nanoatmega328") + " por " + c("board = nanoatmega328new") + " (o al revés)."),
          p("Robustez con placas: alejá el collar de la unidad o tapalo (pérdida de enlace), apagá el collar "
            "(“no respondió” y luego desconectado) y volvé a encenderlo (se recupera solo)."),
          PageBreak()]

    # 10
    s += [h1("10. Probar con otros grupos"),
          p("La consigna pide que cualquier collar funcione con cualquier unidad y cualquier página con cualquier "
            "servidor. La lista completa está en " + c("docs/08-pruebas-cruzadas.md") + "; en resumen:"),
          table(["Prueba", "Qué cambiar", "Qué revisar"], [
              ["Nuestra página con el servidor de otro grupo",
               "Solo " + c("NEXT_PUBLIC_API_URL") + " en " + c("frontend/.env.local") + " y reiniciar el front",
               "Login, mascotas, emparejar, mapa. La tarjeta de ahorro <b>no</b> aparece (es nuestra variante)."],
              ["La página de otro grupo con nuestro servidor",
               "Pasarles " + c("http://<IP-de-tu-PC>:3001/api/v1") + " y agregar su origen en nuestro Ovenbird",
               "Que todo ande con su página."],
              ["Nuestro collar con su unidad (o al revés)",
               "Ellos configuran nuestro " + c("DEV_ID 0x0101") + "; nosotros " + c("PAIRED_DEV_ID") +
               " en " + c("platformio.ini") + " (sin commitear)",
               "Posiciones, FIND_ME, cambio de intervalo y sus confirmaciones."],
          ], [4.4, 6.0, 6.0]),
          p("Anotá los resultados en la tabla del final de " + c("docs/08-pruebas-cruzadas.md") + "."),
          PageBreak()]

    # 11
    s += [h1("11. Problemas frecuentes y cómo resolverlos"),
          table(["Lo que pasa", "Por qué / qué hacer"], [
              [c("supabase start") + " falla", "Docker Desktop no está abierto. Abrilo, esperá y reintentá."],
              ["Supabase dice que un puerto está ocupado", "Otro proyecto de Supabase está prendido: "
               + c("supabase stop --project-id <otro>") + " o apagalo desde Docker Desktop."],
              ["El backend no arranca: " + c("Configuración inválida"), "Falta una variable en "
               + c("backend/.env") + ". El mensaje dice cuál (nunca muestra valores)."],
              ["Error " + c("permission denied") + " de la base", "Correr " + c("supabase db reset") +
               " para volver a crear las tablas."],
              ["El mapa dice “No pudimos conectar con el mapa”", "Falta el origen " + c("http://localhost:3000") +
               " en el proyecto de Ovenbird, o no hay internet."],
              ["La unidad no aparece para vincular", "El código venció (10 min) o lo generó otra cuenta. "
               "Generá otro y volvé a emparejar (la misma unidad se puede re-emparejar)."],
              ["Te saca al login con “Tu sesión venció”", "Pasó 1 hora. Iniciá sesión de nuevo."],
              ["“Enviando…” no termina", "Si es Wokwi en ahorro, esperá hasta 2,5 min. Si no hay unidad ni "
               "puente andando, nadie confirma: a los 10 minutos pasa a “El collar no respondió”."],
              [c("monthly CI minute quota"), "Se agotaron los minutos de Wokwi del mes: VS Code (7.4) o Nivel B."],
              ["La simulación se corta a los 5 min", "Límite del plan gratis: relanzar (7.5)."],
              [c("wokwi-cli") + " no se reconoce", "Cerrá y abrí la terminal después de instalarlo."],
              [c("npm ci") + " falla", "Borrá " + c("node_modules") + " y repetí. Revisá tener Node 22 o más."],
              ["Caracteres raros en la terminal", "Es solo la codificación de la consola; no afecta el funcionamiento."],
          ], [6.0, 10.4]),
          PageBreak()]

    # 12
    s += [h1("12. Checklist antes de la demo"),
          checks([
              "Tests automáticos en verde (Nivel A) y GitHub Actions en verde.",
              "Docker abierto, " + c("supabase start") + ", backend y frontend andando (paso 5).",
              "Una cuenta y una mascota creadas de antemano (ahorra tiempo en la demo).",
              "Minutos de Wokwi disponibles, o la Opción 2 (VS Code) preparada, o la unidad de prueba como plan B.",
              "Firmware compilado: " + c("collar_sim") + " y " + c("unit_sim") + " (o " + c("collar_lora") +
              " / " + c("unit_lora") + " grabados en las placas).",
              "Recorrido completo ensayado una vez: código › emparejar › vincular › mapa › ahorro › "
              "“Aplicado en el collar” › normal.",
              "Robustez ensayada: " + c("chaos loss=1") + " para “no respondió” y " + c("chaos dup=0.5") +
              " para duplicados.",
              "Explicación preparada de por qué volver a Normal tarda hasta 2,5 min en ahorro.",
              "Placas: antenas puestas, GPS cerca de una ventana, celular con la app y Bluetooth.",
              "Ninguna clave a la vista en pantalla (no abrir los " + c(".env") + " mientras se comparte).",
              "Antes de entregar: claves rotadas (sobre todo el " + c("clientSecret") +
              " de Ovenbird) y credenciales al docente por el canal que indique.",
          ]),
          h1("13. Glosario"),
          table(["Palabra", "Qué significa acá"], [
              ["Backend", "Nuestro servidor (NestJS). Guarda usuarios y mascotas y habla con Ovenbird."],
              ["Frontend", "La página web (Next.js)."],
              ["BFF / intermediario", "La parte del frontend que corre en el servidor y guarda la sesión en una "
               "cookie segura, para que el navegador nunca vea la clave de sesión."],
              ["Ovenbird", "La nube de la cátedra que recibe los datos de las unidades y manda los comandos."],
              ["Código de emparejamiento", "Código de un solo uso (10 min) que asocia una unidad a nuestra cuenta."],
              ["Vincular", "Asociar una unidad emparejada a una mascota."],
              ["Wokwi", "Simulador de placas en la web (y en VS Code)."],
              ["Puente", c("radiosim_bridge.py") + ": une las dos placas simuladas y hace de celular."],
              ["Unidad de prueba", c("unidad_prueba.py") + ": una unidad falsa para probar la página sin placas."],
              ["Modo ahorro", "El collar reporta cada 150 s, apaga el GPS y duerme la radio entre reportes, "
               "pero sigue atendiendo órdenes."],
              ["Trama", "Un paquete de datos que viaja por la radio entre el collar y la unidad."],
              [c("chaos"), "Comando del puente que inventa fallas (pérdida, duplicados, corrupción)."],
              ["Swagger", "Página que documenta la API del backend y permite probarla."],
          ], [4.2, 12.2]),
          p("Más detalle técnico: " + c("README.md") + ", " + c("docs/07-demo.md") + " (guion de la demo) y "
            + c("docs/06-decisiones-arquitectura.md") + ".", SMALL)]
    return s


def on_page(canvas, doc) -> None:
    if doc.page == 1:
        return
    canvas.saveState()
    canvas.setStrokeColor(ACCENT)
    canvas.setLineWidth(0.6)
    canvas.line(2.3 * cm, A4[1] - 1.5 * cm, A4[0] - 2.3 * cm, A4[1] - 1.5 * cm)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.grey)
    canvas.drawString(2.3 * cm, A4[1] - 1.3 * cm, f"{TITLE} · Grupo 1")
    canvas.drawRightString(A4[0] - 2.3 * cm, 1.2 * cm, f"Página {doc.page}")
    canvas.restoreState()


def main() -> None:
    doc = SimpleDocTemplate(str(OUT), pagesize=A4, leftMargin=2.3 * cm, rightMargin=2.3 * cm,
                            topMargin=2.0 * cm, bottomMargin=1.8 * cm, title=TITLE, subject=SUBTITLE,
                            author="Grupo 1 — TP Final IoT")
    doc.build(content(), onFirstPage=on_page, onLaterPages=on_page)
    print(f"PDF generado: {OUT}")


if __name__ == "__main__":
    main()
