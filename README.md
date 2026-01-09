# YouTube Shorts Notification Filter

**For the average user who just wants this to work without reading 47 pages of documentation.**

---

## Quick Install (Recommended)

Install directly from the Chrome Web Store:  
https://chromewebstore.google.com/detail/youtube-shorts-notificati/hgcklniedbbghejifienmdkmnhidleae

- Works on Chrome, Edge, Brave (Chromium-based browsers)
- Automatic updates
- No Developer Mode required

---

## Manual Installation (Alternative)

Use this if you don’t want the Chrome Web Store version or you are testing locally.

1. Download or clone this repository
2. Open Chrome / Edge / Brave
3. Enter `chrome://extensions` in the address bar
4. Enable **Developer mode** (top right)
5. Click **Load unpacked extension**
6. Select the `yt-shorts-notification-filter` folder
7. Done. Reload YouTube.

---

## English

### What does this extension do?

This extension filters YouTube Shorts from your notifications and the notification bell dropdown. That’s it. No nonsense, no complicated settings.

### Options

| Option | What it does |
|------|-------------|
| Filter Status | Turn extension on/off |
| Block Bell Dropdown | Hide Shorts in the bell menu |
| Block Notifications Page | Hide Shorts on notifications page |
| Redirect /shorts/ → /watch | Redirect Shorts links to normal video pages |
| YouTube Theme | Switch YouTube Dark/Light mode |
| Creator Whitelist | Channels whose Shorts should NOT be filtered |

### FAQ

Q: Why aren’t Shorts on the homepage filtered?  
A: YouTube constantly changes the homepage structure. This extension focuses on what can be filtered reliably: notifications.

Q: The theme switch doesn’t work.  
A: Reload YouTube manually if it does not reload automatically.

---

## Deutsch

### Was macht diese Extension?

Diese Extension filtert YouTube Shorts aus deinen Benachrichtigungen und dem Glocken-Dropdown.

### Optionen

| Option | Beschreibung |
|------|--------------|
| Filter Status | Extension an/aus |
| Block Bell Dropdown | Shorts im Glocken-Menü ausblenden |
| Block Notifications Page | Shorts auf der Benachrichtigungsseite ausblenden |
| Redirect /shorts/ → /watch | Shorts-Links zu normalen Videos umleiten |
| YouTube Theme | Dark/Light Modus wechseln |
| Creator Whitelist | Kanäle erlauben, deren Shorts nicht gefiltert werden |

---

## Español

### ¿Qué hace esta extensión?

Filtra los Shorts de YouTube de las notificaciones y del menú de la campana.

### Opciones

| Opción | Función |
|------|---------|
| Filter Status | Activar o desactivar |
| Block Bell Dropdown | Ocultar Shorts del menú |
| Block Notifications Page | Ocultar Shorts en notificaciones |
| Redirect /shorts/ → /watch | Redirigir Shorts a videos normales |
| YouTube Theme | Cambiar tema |

---

## Українська

### Що робить це розширення?

Фільтрує YouTube Shorts зі сповіщень та меню дзвіночка.

### Опції

| Опція | Опис |
|------|------|
| Filter Status | Увімкнути / вимкнути |
| Block Bell Dropdown | Приховати Shorts у меню |
| Block Notifications Page | Приховати Shorts зі сповіщень |
| Redirect /shorts/ → /watch | Перенаправити Shorts |
| YouTube Theme | Змінити тему |

---

## Technical Details

- Manifest V3
- MutationObserver for dynamic UI changes
- Periodic sweeps every 1.5 seconds
- Chrome Storage API for persistent settings

Tip: If you just want it to work, use the Chrome Web Store version. Manual installation is intended for development or forks.
