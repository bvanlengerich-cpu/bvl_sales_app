# BvL Sales App

Lokale, zweisprachige Progressive Web App für BvL-Vertriebswerkzeuge. Das Projekt liegt bewusst in einem eigenen Unterordner: Im übergeordneten Arbeitsordner liegen Prototyp und Zugangsdaten, die **nicht** ins GitHub-Repository gehören.

## Enthalten

- Mobile Startseite mit responsiven Link-Karten, Kategorien, Schnellzugriffen und frei wählbaren Icons; Desktop-Administration für Links und Benutzer.
- Rollen `admin`, `staff` (BvL intern) und `dealer` (Händler). Nur Admins verwalten Benutzer, Links und Mitteilungen. Admins und einzeln berechtigte Nutzer dürfen Lieferzeiten bearbeiten.
- Deutsche/englische Oberfläche, iOS-Installationshinweis, Web-App-Manifest, Service Worker und Home-Screen-Icons.
- Lieferzeiten für gezogene Maschinen und Selbstfahrer, im Admin-Bereich in Wochen gepflegt.
- Kleiner, für alle angemeldeten Rollen sichtbarer Besucherzähler. Gezählt wird der erste angemeldete App-Aufruf und erneut ein Aufruf nach 30 Minuten Inaktivität; Seitenwechsel und Neuladen innerhalb eines Besuchs zählen nicht doppelt. Der Gesamtstand liegt dauerhaft in SQLite, ohne IP-Adressen oder Fingerprints zu speichern.
- Deutschlands monatlicher Rohmilchpreis aus der EU-Kommissions-API, beim ersten Start und danach automatisch im Wochenabstand abgefragt. Nach einem Server-Neustart wird der gespeicherte Wochenrhythmus fortgesetzt. Die App rechnet `€/100 kg` in `ct/kg` um und zeigt den Preismonat sowie Datum/Uhrzeit des letzten erfolgreichen Abrufs (Europe/Berlin). Der Zeitpunkt bleibt auch nach einem Server-Neustart erhalten. Bei API-Ausfall wird ein zuletzt bekannter Wert ausdrücklich als veraltet gekennzeichnet; ohne erfolgreichen Abruf erscheint „nicht verfügbar“.
- In-App-Mitteilungen und optionaler Web Push an alle, BvL intern, Händler oder ausgewählte Benutzer. Push benötigt VAPID-Schlüssel und HTTPS. Auf iOS funktioniert Push nach der Installation auf dem Home-Bildschirm und ausdrücklicher Freigabe.
- Passwörter per scrypt gehasht, HttpOnly-Sitzungscookies, CSRF-/Origin-Prüfung, Login-Sperre nach Fehlversuchen, Sicherheitsheader und Änderungsprotokoll.

## Lokal starten

Voraussetzung: Node.js 24.15 oder neuer und pnpm 11. Docker wird lokal nicht benötigt.

```powershell
cd 'C:\Users\Gerrit Sievering\Desktop\Bvl-Sales-App\sales-app'
Copy-Item .env.example .env
pnpm install --frozen-lockfile
pnpm admin:create admin 'BvL Administration'
pnpm start
```

Beim Erstellen des ersten Admins wird das Passwort verdeckt abgefragt. Es muss mindestens sechs Zeichen haben. Die App ist dann auf <http://localhost:3000> erreichbar. Alle weiteren Benutzer legt der Admin in der Oberfläche an; die Passwörter aus dem HTML-Prototyp werden absichtlich **nicht** übernommen. `pnpm test` führt die Backend- und Milchpreis-Tests aus. `pnpm backup` erstellt eine konsistente SQLite-Kopie im ignorierten Ordner `backups/`.

Der lokale Server bindet nur `127.0.0.1`. Für Tests auf einem echten iPhone ist später eine HTTPS-URL erforderlich; `localhost` auf dem PC ist vom iPhone aus nicht erreichbar. Ohne HTTPS funktionieren auf dem iPhone weder die produktive PWA-Installation noch Web Push zuverlässig.

## GitHub und Coolify: `sales.bvlki.cloud`

1. **Nur `sales-app/`** als Repository verwenden. `.env`, `data/` und `backups/` sind ignoriert. Die übergeordneten Prototyp-Dateien und Zugangsdaten nicht mitcommitten. Dieses lokale Repository verwendet den Branch `main`; die GitHub-Repository-URL ist noch nicht als Remote eingetragen.
2. Für ein bereits angelegtes, **leeres** GitHub-Repository im Ordner `sales-app` ausführen (Git-Autor und Platzhalter-URL durch die eigenen Angaben ersetzen). Die Dateien sind bereits für den ersten Commit vorgemerkt:

   ```powershell
   git config user.name "Ihr Name"
   git config user.email "ihre-github-adresse@example.com"
   git commit -m "Initial BvL Sales PWA"
   git remote add origin https://github.com/ORGANISATION/REPOSITORY.git
   git push -u origin main
   ```

   Ist das GitHub-Repository nicht leer, zuerst die dortigen Änderungen prüfen und zusammenführen. Keinen Force-Push verwenden. Das Repository sollte privat bleiben, bis BvL die Veröffentlichung ausdrücklich freigibt.
3. In Coolify auf dem bestehenden Hostinger-VPS ein **eigenes Projekt** und darin eine Anwendung aus diesem GitHub-Repository, Branch `main`, Build-Typ **Dockerfile** (`/Dockerfile`) anlegen. Das Gebrauchtmaschinenportal bleibt getrennt. Die Anwendung lauscht intern auf Port `3000`; kein zusätzlicher öffentlich erreichbarer Host-Port ist nötig.
4. Beim zuständigen DNS-Anbieter einen `A`-Eintrag für `sales` auf die **aktuelle** IPv4-Adresse desselben VPS legen, der auch `gebrauchtmaschinen.bvlki.cloud` bedient. Erst die tatsächliche VPS-IP und den zuständigen DNS-Anbieter prüfen; der alte Screenshot ist dafür keine verlässliche Quelle. In Coolify als Domain `https://sales.bvlki.cloud` eintragen und TLS/HTTPS aktivieren.
5. In Coolify `PUBLIC_ORIGIN=https://sales.bvlki.cloud` als Umgebungsvariable setzen, exakt ohne Slash am Ende. `HOST=0.0.0.0`, `PORT=3000` und `DATA_DIR=/app/data` sind bereits im Dockerfile vorbelegt. Die Origin-Prüfung und Secure-Cookies benötigen die exakte HTTPS-Origin.
6. **Vor dem ersten Admin-Zugang** ein persistentes Volume an `/app/data` hängen. Der Container läuft als Linux-Benutzer `node` (UID 1000); ein Host-Bind-Mount muss für diesen Benutzer schreibbar sein. Nur eine App-Instanz gegen diese SQLite-Datei betreiben. Im laufenden Container einmalig `pnpm admin:create admin 'BvL Administration'` ausführen; das Passwort nicht in GitHub speichern.
7. Für Push-Benachrichtigungen einen stabilen VAPID-Schlüsselpaar-Satz mit `pnpm vapid:generate` erzeugen und in Coolify als geheime Variablen `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` und `VAPID_SUBJECT=mailto:...` hinterlegen. Schlüssel nicht leichtfertig rotieren. Dieser Schritt kann nach dem ersten Start folgen.
8. Einen regelmäßigen, extern gesicherten Backup-Prozess für die Datenbank einrichten und Rücksicherung testen. Ein persistentes Volume ist **noch kein Backup**. Für eine manuelle, konsistente Kopie kann `pnpm backup` mit `BACKUP_DIR` auf einen zusätzlich gesicherten Pfad zielen.

`/health` dient als Healthcheck. `compose.yaml` ist eine lokale/alternative Docker-Compose-Option; Coolify kann direkt das Dockerfile bauen. Auf diesem PC ist aktuell kein Docker installiert, daher wurde der Container hier noch nicht gebaut. API- und Browser-Tests laufen lokal mit Node.

## Vor echtem Rollout prüfen

- Ziel-URLs und Zugriffsgruppen der aus dem Prototyp übernommenen Links durch BvL bestätigen lassen (einschließlich des generischen Canto-Einstiegs).
- DNS und HTTPS für `sales.bvlki.cloud`, GitHub-Repository und spätere Benutzerliste prüfen.
- iPhone-Safari/Home-Screen-Installation, iOS-Web-Push und Android-Push auf physischen Geräten testen; Push-Berechtigung wird nur nach Benutzeraktion angefragt.
- Datenschutz/Impressum sowie Aufbewahrung von Benutzer- und Mitteilungsdaten mit BvL abstimmen.
- Backup und Wiederherstellung auf dem VPS testen, bevor die App produktive Benutzer erhält.

## Technische Grenzen

Der Service Worker hält nur die öffentliche App-Oberfläche offline vor. Private Daten, Milchpreis, Lieferzeiten und externe Zielseiten werden nicht offline gespeichert. Die SQLite-Datenbank ist für eine einzelne VPS-Instanz ausgelegt; für mehrere App-Replikas wäre eine Server-Datenbank nötig. Die verwendete `node:sqlite`-API in Node 24 ist noch als Release Candidate gekennzeichnet; vor breiter Produktion ist eine erneute technische Freigabe sinnvoll.
