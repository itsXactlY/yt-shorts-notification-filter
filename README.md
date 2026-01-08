# YouTube Shorts Notification Filter

**For the average user who just wants this to work without reading 47 pages of documentation.**

---

## 🇺🇸 English

### What does this extension do?

This extension filters YouTube Shorts from your notifications and the notification bell dropdown. That's it. No nonsense, no complicated settings that don't work.

### Installation

1. Open Chrome/Edge/Brave
2. Type `chrome://extensions` in the address bar
3. Enable "Developer mode" in the top right (yes, you have to do this)
4. Click "Load unpacked extension"
5. Select the `yt-shorts-notification-filter` folder
6. Done. Reload YouTube.

### Options

| Option | What it does |
|--------|--------------|
| **Filter Status** | Turn extension on/off |
| **Block Bell Dropdown** | Hide Shorts in the bell menu |
| **Block Notifications Page** | Hide Shorts on notifications page |
| **Redirect /shorts/ → /watch** | Automatically redirect Shorts links to normal video pages |
| **YouTube Theme** | Switch YouTube Dark/Light mode directly here |
| **Creator Whitelist** | Add channels whose Shorts should NOT be filtered |

### FAQ

**Q: Why aren't Shorts on the homepage filtered?**
A: This is intentional. YouTube constantly changes the homepage structure, and reliably filtering it is practically impossible. This extension focuses on what works: notifications.

**Q: The theme switch doesn't work.**
A: The page should reload automatically after changing. If not, manually reload YouTube.

---

## 🇩🇪 Deutsch

### Was macht diese Extension?

Diese Extension filtert YouTube Shorts aus deinen Benachrichtigungen und dem Glocken-Dropdown. Das wars.

### Installation

1. Chrome/Edge/Brave öffnen
2. `chrome://extensions` in die Adresszeile eingeben
3. "Entwicklermodus" oben rechts aktivieren
4. Auf "Entpackte Extension laden" klicken
5. Den Ordner `yt-shorts-notification-filter` auswählen
6. Fertig.

### Optionen

| Option | Was passiert |
|--------|--------------|
| **Filter Status** | Extension an/aus |
| **Block Bell Dropdown** | Shorts im Glocken-Menü ausblenden |
| **Block Notifications Page** | Shorts auf Benachrichtigungsseite ausblenden |
| **Redirect /shorts/ → /watch** | Shorts-Links automatisch zu Videos umleiten |
| **YouTube Theme** | YouTube Dark/Light Modus hier umschalten |
| **Creator Whitelist** | Kanäle eintragen, deren Shorts NICHT gefiltert werden |

### FAQ

**Q: Warum werden Shorts auf der Startseite nicht gefiltert?**
A: YouTube ändert ständig die Startseite. Das zuverlässig zu filtern ist unmöglich. Diese Extension konzentriert sich auf Benachrichtigungen.

---

## 🇪🇸 Español

### ¿Qué hace esta extensión?

Filtra los Shorts de YouTube de tus notificaciones y del menú de la campana. Eso es todo.

### Instalación

1. Abre Chrome/Edge/Brave
2. Escribe `chrome://extensions` en la barra de direcciones
3. Activa "Modo desarrollador" arriba a la derecha
4. Carga la extensión descomprimida
5. Listo.

### Opciones

| Opción | Qué hace |
|--------|----------|
| **Filter Status** | Activar/desactivar extensión |
| **Block Bell Dropdown** | Ocultar Shorts del menú de campana |
| **Block Notifications Page** | Ocultar Shorts en la página de notificaciones |
| **Redirect /shorts/ → /watch** | Redirigir enlaces de Shorts a videos |
| **YouTube Theme** | Cambiar tema Dark/Light de YouTube |

---

## 🇺🇦 Українська

### Що робить цей розширення?

Фільтрує YouTube Shorts з ваших сповіщень та випадаючого меню дзвіночка. Це все.

### Встановлення

1. Відкрий Chrome/Edge/Brave
2. Введи `chrome://extensions` в адресний рядок
3. Увімкни "Режим розробника" праворуч вгорі
4. Завантаж розпакований розширення
5. Готово.

### Опції

| Опція | Що робить |
|-------|-----------|
| **Filter Status** | Увімкнути/вимкнути розширення |
| **Block Bell Dropdown** | Приховати Shorts у меню дзвіночка |
| **Block Notifications Page** | Приховати Shorts на сторінці сповіщень |
| **Redirect /shorts/ → /watch** | Перенаправити посилання Shorts на відео |
| **YouTube Theme** | Змінити тему YouTube |

---

## Technical Details

- **Manifest V3** (modern, secure, resource-efficient)
- **MutationObserver** for dynamic content
- **Periodic sweeps** every 1.5 seconds for new notifications
- **Chrome Storage** for settings persistence
