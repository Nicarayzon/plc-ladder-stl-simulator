// Página «Instalación» de la web (docs/<idioma>/<carpeta>/): cómo instalar la app en Windows, paso a paso y con capturas.
// La genera `npm run web:teoria` (scripts/web/instalacion.ts) con la misma plantilla que la teoría. Solo se genera en los
// idiomas que están aquí; el enlace «Instalación» de la cabecera sale solo en esos.
// Los textos admiten Markdown (**negrita**, `código`, [enlaces](…)). `{portada}` es la portada del mismo idioma.
// Las capturas están en docs/images/instalacion/ (en la 4 se ocultó el nombre de usuario de Windows).
import type { Idioma } from '../teoria/paginas';

export interface Captura {
  fichero: string;
  /** Tamaño real del fichero, en píxeles */
  ancho: number;
  alto: number;
  /** Ancho máximo en la página, en píxeles CSS (las capturas de diálogos, a su tamaño; la de la app, a todo el ancho) */
  maximo: number;
  alt: string;
}

export interface PasoInstalacion {
  titulo: string;
  texto: string;
  captura?: Captura;
  /** Recuadro destacado debajo del paso */
  recuadro?: { titulo: string; texto: string };
}

export interface TextosInstalacion {
  /** Carpeta dentro de docs/<idioma>/ */
  carpeta: string;
  /** Texto del enlace de la cabecera */
  menu: string;
  antetitulo: string;
  titulo: string;
  descripcion: string;
  entradilla: string;
  /** Rótulo «Paso» de cada paso */
  paso: string;
  pasos: PasoInstalacion[];
  /** Al final: otras formas y ayuda */
  extraTitulo: string;
  extra: string[];
}

const IMG = 'images/instalacion/';

export const INSTALACION: Partial<Record<Idioma, TextosInstalacion>> = {
  es: {
    carpeta: 'instalacion',
    menu: 'Instalación',
    antetitulo: 'Instalación',
    titulo: 'Cómo instalar Automatizacion en Windows',
    descripcion: 'Guía paso a paso, con capturas, para instalar el simulador de PLC Automatizacion en Windows 10 y 11: la descarga, el aviso de SmartScreen y el instalador.',
    entradilla: 'Instalar el simulador en Windows 10 u 11 lleva un par de minutos. Esta guía te acompaña paso a paso, con capturas, desde la descarga hasta abrir la app por primera vez.',
    paso: 'Paso',
    pasos: [
      {
        titulo: 'Descarga el instalador',
        texto: 'Pulsa **Instalador .exe** en la [zona de descargas]({portada}#descargar). El navegador lo guarda en tu carpeta de Descargas. Cuando termine (en la lista de descargas pondrá «Hecho»), haz **doble clic** en `Automatizacion-Setup-….exe` para empezar a instalar.',
        captura: { fichero: 'imagen1.png', ancho: 812, alto: 282, maximo: 406, alt: 'Lista de descargas del navegador con Automatizacion-Setup descargado' },
      },
      {
        titulo: 'Windows muestra un aviso: es normal',
        texto: 'Antes de abrir el instalador, Windows enseña la pantalla **«Windows protegió su PC»**. Sale porque el instalador no lleva una **firma digital de pago**: es un certificado que se compra cada año y que este proyecto gratuito no tiene. Por eso Windows lo llama «aplicación desconocida» y «editor desconocido». No quiere decir que haya encontrado nada malo en él.',
        captura: { fichero: 'imagen2.png', ancho: 952, alto: 868, maximo: 420, alt: 'Aviso de SmartScreen «Windows protegió su PC» con el enlace Más información' },
        recuadro: {
          titulo: '¿Es seguro?',
          texto: 'El código fuente de la app es **público en GitHub**: cualquiera puede leerlo y comprobar qué hace. Los instaladores se publican en la página de **Releases** de ese mismo repositorio, y la app funciona sin conexión a Internet. Descárgala siempre desde esta web o desde [GitHub](https://github.com/Nicarayzon/plc-ladder-stl-simulator/releases/latest), nunca desde otras páginas.',
        },
      },
      {
        titulo: 'Pulsa «Más información» y «Ejecutar de todas formas»',
        texto: 'Pulsa el enlace **Más información** que hay debajo del texto del aviso. Aparecen el nombre del fichero (`Automatizacion-Setup-….exe`) y el botón **Ejecutar de todas formas**: púlsalo para abrir el instalador.',
        captura: { fichero: 'imagen3.png', ancho: 658, alto: 617, maximo: 494, alt: 'El aviso de SmartScreen con el botón Ejecutar de todas formas' },
      },
      {
        titulo: 'Sigue el instalador',
        texto: 'Acepta las opciones que vienen marcadas: **Solo para mí** (no pide permisos de administrador), **Siguiente**, la carpeta de instalación que propone e **Instalar**. Si ya tenías una versión instalada, lo dice abajo y la actualiza: tus proyectos se conservan.',
        captura: { fichero: 'imagen4.png', ancho: 632, alto: 488, maximo: 632, alt: 'Instalador de Automatizacion: elegir si se instala para todos los usuarios o solo para ti' },
      },
      {
        titulo: 'Si dice que Automatizacion está activa',
        texto: 'Este mensaje solo sale si la app estaba abierta, por ejemplo al actualizar desde una versión anterior. Pulsa **Aceptar**: el instalador la cierra y sigue. Si no se cierra sola, ciérrala tú y vuelve a pulsar **Aceptar**.',
        captura: { fichero: 'imagen5.png', ancho: 630, alto: 478, maximo: 630, alt: 'Mensaje del instalador: Automatizacion está activa. Haz clic en Aceptar para cerrarla' },
      },
      {
        titulo: 'Termina y abre la app',
        texto: 'Al acabar, deja marcada la casilla **Ejecutar Automatizacion** y pulsa **Terminar**. La app se abre en el simulador libre, lista para escribir tu primer programa. A partir de ahora la tienes en el **menú Inicio** y con un acceso directo en el **escritorio**.',
        captura: { fichero: 'imagen6.png', ancho: 2608, alto: 1902, maximo: 1304, alt: 'Automatizacion abierto en Windows, con un programa AWL en RUN y el cronograma de señales' },
      },
    ],
    extraTitulo: 'Otras formas y ayuda',
    extra: [
      '**Sin permisos para instalar programas** (un ordenador del centro, por ejemplo): descarga el **Portable .zip**, descomprímelo y abre `Automatizacion.exe`. No se instala; si Windows muestra el mismo aviso, se pasa igual, con «Más información» y «Ejecutar de todas formas».',
      '**Para actualizar**, descarga el instalador nuevo y repite los pasos: se instala encima de la versión anterior y conserva tus proyectos. Desde la app, el menú **Ayuda ▸ Buscar actualizaciones…** te dice si hay una nueva.',
      '**¿Tienes un Mac o usas Linux?** Las instrucciones están en las [preguntas frecuentes]({portada}#preguntas). Si algo no funciona, cuéntalo en [GitHub](https://github.com/Nicarayzon/plc-ladder-stl-simulator/issues).',
    ],
  },
  // traducciones: los botones del instalador (que está en español) llevan su significado al lado
  en: {
    "carpeta": "installation",
    "menu": "Installation",
    "antetitulo": "Installation",
    "titulo": "How to install Automatizacion on Windows",
    "descripcion": "Step-by-step guide, with screenshots, to install the PLC simulator Automatizacion on Windows 10 and 11: the download, the SmartScreen warning and the installer.",
    "entradilla": "Installing the simulator on Windows 10 or 11 takes a couple of minutes. This guide takes you step by step, with screenshots, from the download to opening the app for the first time. The screenshots come from a Windows set to Spanish, and the installer itself is in Spanish: next to each Spanish button you have what it means.",
    "paso": "Step",
    "pasos": [
      {
        "titulo": "Download the installer",
        "texto": "Click **Installer .exe** in the [downloads section]({portada}#descargar). Your browser saves it in your Downloads folder. When it finishes, **double-click** `Automatizacion-Setup-….exe` to start the installation.",
        "captura": {
          "fichero": "imagen1.png",
          "ancho": 812,
          "alto": 282,
          "maximo": 406,
          "alt": "Browser download list with Automatizacion-Setup downloaded"
        }
      },
      {
        "titulo": "Windows shows a warning: that’s normal",
        "texto": "Before the installer opens, Windows shows the **“Windows protected your PC”** screen. It appears because the installer has no **paid digital signature**: a certificate that has to be bought every year, which this free project doesn’t have. That’s why Windows calls it an “unrecognized app” from an “unknown publisher”. It doesn’t mean that Windows found anything wrong with it.",
        "recuadro": {
          "titulo": "Is it safe?",
          "texto": "The source code of the app is **public on GitHub**: anyone can read it and check what it does. The installers are published on the **Releases** page of that same repository, and the app works without an Internet connection. Always download it from this website or from [GitHub](https://github.com/Nicarayzon/plc-ladder-stl-simulator/releases/latest), never from other sites."
        },
        "captura": {
          "fichero": "imagen2.png",
          "ancho": 952,
          "alto": 868,
          "maximo": 420,
          "alt": "SmartScreen warning “Windows protected your PC” with the More info link (Windows in Spanish)"
        }
      },
      {
        "titulo": "Click “More info” and “Run anyway”",
        "texto": "Click the **More info** link under the warning text. The file name (`Automatizacion-Setup-….exe`) and the **Run anyway** button appear: click it to open the installer. In the Spanish screenshots they are *Más información* and *Ejecutar de todas formas*.",
        "captura": {
          "fichero": "imagen3.png",
          "ancho": 658,
          "alto": 617,
          "maximo": 494,
          "alt": "The SmartScreen warning with the Run anyway button (Windows in Spanish)"
        }
      },
      {
        "titulo": "Follow the installer",
        "texto": "The installer is in Spanish. Keep the options it suggests: **Solo para mí** (just for me; it doesn’t ask for administrator rights), **Siguiente** (Next), the installation folder it proposes and **Instalar** (Install). If you already had a version installed, it says so at the bottom and updates it: your projects are kept.",
        "captura": {
          "fichero": "imagen4.png",
          "ancho": 632,
          "alto": 488,
          "maximo": 632,
          "alt": "Automatizacion installer: choose whether to install for all users or just for you"
        }
      },
      {
        "titulo": "If it says that Automatizacion is running",
        "texto": "This message (“Automatizacion está activa”) only appears if the app was open, for example when updating from an earlier version. Click **Aceptar** (OK): the installer closes the app and goes on. If it doesn’t close by itself, close it yourself and click **Aceptar** again.",
        "captura": {
          "fichero": "imagen5.png",
          "ancho": 630,
          "alto": 478,
          "maximo": 630,
          "alt": "Installer message: Automatizacion is running. Click OK to close it"
        }
      },
      {
        "titulo": "Finish and open the app",
        "texto": "At the end, leave **Ejecutar Automatizacion** (Run Automatizacion) ticked and click **Terminar** (Finish). The app opens in the free simulator, ready for your first program. From now on you have it in the **Start menu** and as a shortcut on the **desktop**. If it opens in another language, change it in **Settings ▸ Language**.",
        "captura": {
          "fichero": "imagen6.png",
          "ancho": 2608,
          "alto": 1902,
          "maximo": 1304,
          "alt": "Automatizacion open on Windows, with an STL program in RUN and the signal timeline"
        }
      }
    ],
    "extraTitulo": "Other ways and help",
    "extra": [
      "**No permission to install programs** (a school computer, for example): download the **Portable .zip**, unzip it and open `Automatizacion.exe`. It needs no installation; if Windows shows the same warning, get past it the same way, with “More info” and “Run anyway”.",
      "**To update**, download the new installer and repeat the steps: it installs over the previous version and keeps your projects. In the app, the menu **Ayuda ▸ Buscar actualizaciones…** (Help ▸ Check for updates) tells you if there is a new one.",
      "**On a Mac or on Linux?** The instructions are in the [FAQ]({portada}#preguntas). If something doesn’t work, report it on [GitHub](https://github.com/Nicarayzon/plc-ladder-stl-simulator/issues)."
    ]
  },
  de: {
    "carpeta": "installation",
    "menu": "Installation",
    "antetitulo": "Installation",
    "titulo": "Automatizacion unter Windows installieren",
    "descripcion": "Schritt-für-Schritt-Anleitung mit Screenshots, um den SPS-Simulator Automatizacion unter Windows 10 und 11 zu installieren: der Download, die SmartScreen-Warnung und das Installationsprogramm.",
    "entradilla": "Den Simulator unter Windows 10 oder 11 zu installieren dauert ein paar Minuten. Diese Anleitung führt dich Schritt für Schritt und mit Screenshots vom Download bis zum ersten Start. Die Screenshots stammen von einem spanischen Windows, und das Installationsprogramm selbst ist auf Spanisch: Neben jeder spanischen Schaltfläche steht, was sie bedeutet.",
    "paso": "Schritt",
    "pasos": [
      {
        "titulo": "Das Installationsprogramm herunterladen",
        "texto": "Klicke im [Download-Bereich]({portada}#descargar) auf **Installer .exe**. Der Browser speichert die Datei in deinem Download-Ordner. Wenn der Download fertig ist, **doppelklicke** auf `Automatizacion-Setup-….exe`, um die Installation zu starten.",
        "captura": {
          "fichero": "imagen1.png",
          "ancho": 812,
          "alto": 282,
          "maximo": 406,
          "alt": "Download-Liste des Browsers mit dem heruntergeladenen Automatizacion-Setup"
        }
      },
      {
        "titulo": "Windows zeigt eine Warnung: Das ist normal",
        "texto": "Bevor sich das Installationsprogramm öffnet, zeigt Windows den Bildschirm **«Der Computer wurde durch Windows geschützt»**. Er erscheint, weil das Installationsprogramm keine **kostenpflichtige digitale Signatur** hat: ein Zertifikat, das man jedes Jahr kaufen muss und das dieses kostenlose Projekt nicht hat. Deshalb nennt Windows es eine «unbekannte App» von einem «unbekannten Herausgeber». Das heißt nicht, dass Windows darin etwas Schädliches gefunden hat.",
        "recuadro": {
          "titulo": "Ist das sicher?",
          "texto": "Der Quellcode der App ist **öffentlich auf GitHub**: Jeder kann ihn lesen und prüfen, was er macht. Die Installationsprogramme werden auf der **Releases**-Seite desselben Repositorys veröffentlicht, und die App funktioniert ohne Internetverbindung. Lade sie immer von dieser Website oder von [GitHub](https://github.com/Nicarayzon/plc-ladder-stl-simulator/releases/latest) herunter, nie von anderen Seiten."
        },
        "captura": {
          "fichero": "imagen2.png",
          "ancho": 952,
          "alto": 868,
          "maximo": 420,
          "alt": "SmartScreen-Warnung «Der Computer wurde durch Windows geschützt» mit dem Link Weitere Informationen (spanisches Windows)"
        }
      },
      {
        "titulo": "Auf «Weitere Informationen» und «Trotzdem ausführen» klicken",
        "texto": "Klicke auf den Link **Weitere Informationen** unter dem Warntext. Dann erscheinen der Dateiname (`Automatizacion-Setup-….exe`) und die Schaltfläche **Trotzdem ausführen**: Klicke darauf, um das Installationsprogramm zu öffnen. Auf den spanischen Screenshots heißen sie *Más información* und *Ejecutar de todas formas*.",
        "captura": {
          "fichero": "imagen3.png",
          "ancho": 658,
          "alto": 617,
          "maximo": 494,
          "alt": "Die SmartScreen-Warnung mit der Schaltfläche Trotzdem ausführen (spanisches Windows)"
        }
      },
      {
        "titulo": "Dem Installationsprogramm folgen",
        "texto": "Das Installationsprogramm ist auf Spanisch. Übernimm die vorgeschlagenen Optionen: **Solo para mí** (nur für mich; dafür braucht es keine Administratorrechte), **Siguiente** (Weiter), den vorgeschlagenen Installationsordner und **Instalar** (Installieren). Wenn schon eine Version installiert war, steht das unten, und sie wird aktualisiert: Deine Projekte bleiben erhalten.",
        "captura": {
          "fichero": "imagen4.png",
          "ancho": 632,
          "alto": 488,
          "maximo": 632,
          "alt": "Installationsprogramm von Automatizacion: für alle Benutzer oder nur für dich installieren"
        }
      },
      {
        "titulo": "Wenn es heißt, dass Automatizacion läuft",
        "texto": "Diese Meldung («Automatizacion está activa») erscheint nur, wenn die App geöffnet war, zum Beispiel beim Aktualisieren von einer älteren Version. Klicke auf **Aceptar** (OK): Das Installationsprogramm schließt die App und macht weiter. Wenn sie sich nicht von selbst schließt, schließ sie selbst und klicke noch einmal auf **Aceptar**.",
        "captura": {
          "fichero": "imagen5.png",
          "ancho": 630,
          "alto": 478,
          "maximo": 630,
          "alt": "Meldung des Installationsprogramms: Automatizacion läuft. Mit OK wird es geschlossen"
        }
      },
      {
        "titulo": "Fertigstellen und die App öffnen",
        "texto": "Lass am Ende das Kästchen **Ejecutar Automatizacion** (Automatizacion ausführen) aktiviert und klicke auf **Terminar** (Fertigstellen). Die App öffnet sich im freien Simulator, bereit für dein erstes Programm. Ab jetzt findest du sie im **Startmenü** und als Verknüpfung auf dem **Desktop**. Wenn sie in einer anderen Sprache startet, stellst du sie unter **Einstellungen ▸ Sprache** um.",
        "captura": {
          "fichero": "imagen6.png",
          "ancho": 2608,
          "alto": 1902,
          "maximo": 1304,
          "alt": "Automatizacion unter Windows geöffnet, mit einem AWL-Programm in RUN und dem Signalverlauf"
        }
      }
    ],
    "extraTitulo": "Andere Wege und Hilfe",
    "extra": [
      "**Keine Rechte, um Programme zu installieren** (zum Beispiel an einem Schulrechner): Lade die **Portable .zip** herunter, entpacke sie und öffne `Automatizacion.exe`. Sie braucht keine Installation; wenn Windows dieselbe Warnung zeigt, geht es genauso weiter, mit «Weitere Informationen» und «Trotzdem ausführen».",
      "**Zum Aktualisieren** lädst du das neue Installationsprogramm herunter und wiederholst die Schritte: Es installiert sich über die alte Version und behält deine Projekte. In der App sagt dir das Menü **Ayuda ▸ Buscar actualizaciones…** (Hilfe ▸ Nach Updates suchen), ob es eine neue gibt.",
      "**Mac oder Linux?** Die Anleitung steht in den [häufigen Fragen]({portada}#preguntas). Wenn etwas nicht funktioniert, melde es auf [GitHub](https://github.com/Nicarayzon/plc-ladder-stl-simulator/issues)."
    ]
  },
};
