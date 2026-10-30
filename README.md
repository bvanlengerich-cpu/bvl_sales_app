# BvL Sales App

Lokale, zweisprachige Progressive Web App für BvL-Vertriebswerkzeuge. Das Projekt liegt bewusst in einem eigenen Unterordner: Im übergeordneten Arbeitsordner liegen Prototyp und Zugangsdaten, die **nicht** ins GitHub-Repository gehören.

## Enthalten

- Mobile Startseite mit responsiven Link-Karten, Kategorien, Schnellzugriffen und frei wählbaren Icons; Desktop-Administration für Links und Benutzer.
- Interne Marktanalyse Deutschland mit Landkreis-Karte, Suche, Mehrfachauswahl und anpassbaren Modellannahmen. Die 398 Werte stammen unverändert aus der vorhandenen HTML-Analyse; 389 Datensätze sind einer aktuellen Kartenfläche eindeutig zugeordnet. Unsichere oder nicht vorhandene Zuordnungen bleiben ohne Kartenfarbe, die Datensätze sind über die Suche weiterhin auswählbar. Zugriff nur für `admin` und `staff`.
- Rollen `admin`, `staff` (BvL intern) und `dealer` (Händler). Nur Admins verwalten Benutzer, Links und Mitteilungen. Admins und einzeln berechtigte Nutzer dürfen Lieferzeiten bearbeiten.
- Messekontakte als internes Modul im Sales-App-Design: mobile Erfassung, eigene Kontakte, lokale Entwürfe/Offline-Warteschlange und zentrale Administration mit Messe-, Jahres-, Bearbeiter-, Status- und Prioritätsfiltern sowie Excel-tauglichem CSV-Export. Dankesmails öffnen einen bearbeitbaren Entwurf in der Mail-App des Verkäufers; kein SMTP und kein automatischer Mailversand.
- Deutsche/englische Oberfläche, iOS-Installationshinweis, Web-App-Manifest, Service Worker und Home-Screen-Icons.
- Nur Links zur BvL-Canto-Domain öffnen aus der installierten iPhone-/iPad-App direkt in Safari, damit Canto-Downloads dort funktionieren. Alle anderen Links behalten ihr bisheriges Verhalten. Die Safari-Übergabe nutzt ein von Apple nicht offiziell dokumentiertes URL-Schema und muss nach iOS-Updates auf einem echten Gerät geprüft werden.
- Vier separat gepflegte Lieferzeiten für V-MIX, V-MIX Drive, V-BIO/FIX und V-LOAD. Der Admin-Bereich nimmt ganze Wochenwerte von 1 bis 52 entgegen; bestehende Werte der ersten beiden Kategorien bleiben bei der Datenbank-Umstellung erhalten. Die beiden neuen Werte sind zunächst leer und werden nach der ersten Pflege angezeigt.
- Kleiner, für alle angemeldeten Rollen sichtbarer Besucherzähler. Gezählt wird der erste angemeldete App-Aufruf und erneut ein Aufruf nach 30 Minuten Inaktivität; Seitenwechsel und Neuladen innerhalb eines Besuchs zählen nicht doppelt. Der Gesamtstand liegt dauerhaft in SQLite, ohne IP-Adressen oder Fingerprints zu speichern.
- Deutschlands monatlicher Rohmilchpreis aus der EU-Kommissions-API, beim ersten Start und danach automatisch im Wochenabstand abgefragt. Nach einem Server-Neustart wird der gespeicherte Wochenrhythmus fortgesetzt. Die App rechnet `€/100 kg` in `ct/kg` um und zeigt den Preismonat sowie Datum/Uhrzeit des letzten erfolgreichen Abrufs (Europe/Berlin). Der Zeitpunkt bleibt auch nach einem Server-Neustart erhalten. Bei API-Ausfall wird ein zuletzt bekannter Wert ausdrücklich als veraltet gekennzeichnet; ohne erfolgreichen Abruf erscheint „nicht verfügbar“.
- In-App-Mitteilungen und optionaler Web Push an alle, BvL intern, Händler oder ausgewählte Benutzer. Nach jedem erfolgreichen wöchentlichen Milchpreis-Abruf geht zusätzlich eine kurze Push an alle aktiven Nutzer mit aktivierter Push-Freigabe – auch wenn der monatliche Preiswert unverändert ist. Bei API-Ausfall gibt es keine Milchpreis-Push; nach sechs Stunden wird erneut versucht. Push benötigt VAPID-Schlüssel und HTTPS. Auf iOS funktioniert Push nach der Installation auf dem Home-Bildschirm und ausdrücklicher Freigabe.
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

   Ist das GitHub-Repository nicht leer, zuerst die dortigen Änderungen prüfen und zusammenführen. Keinen Force-Push verwenden. Das derzeitige GitHub-Repository ist öffentlich; Passwörter, Umgebungsvariablen und Benutzerdaten gehören daher **nicht** hinein. Die Marktwerte sind laut BvL öffentliche Daten und werden unter `server/market-data.json` mitgeliefert.
3. In Coolify auf dem bestehenden Hostinger-VPS ein **eigenes Projekt** und darin eine Anwendung aus diesem GitHub-Repository, Branch `main`, Build-Typ **Dockerfile** (`/Dockerfile`) anlegen. Das Gebrauchtmaschinenportal bleibt getrennt. Die Anwendung lauscht intern auf Port `3000`; kein zusätzlicher öffentlich erreichbarer Host-Port ist nötig.
4. Beim zuständigen DNS-Anbieter einen `A`-Eintrag für `sales` auf die **aktuelle** IPv4-Adresse desselben VPS legen, der auch `gebrauchtmaschinen.bvlki.cloud` bedient. Erst die tatsächliche VPS-IP und den zuständigen DNS-Anbieter prüfen; der alte Screenshot ist dafür keine verlässliche Quelle. In Coolify als Domain `https://sales.bvlki.cloud` eintragen und TLS/HTTPS aktivieren.
5. In Coolify `PUBLIC_ORIGIN=https://sales.bvlki.cloud` als Umgebungsvariable setzen, exakt ohne Slash am Ende. `HOST=0.0.0.0`, `PORT=3000` und `DATA_DIR=/app/data` sind bereits im Dockerfile vorbelegt. Die Origin-Prüfung und Secure-Cookies benötigen die exakte HTTPS-Origin.
6. **Vor dem ersten Admin-Zugang** ein persistentes Volume an `/app/data` hängen. Der Container läuft als Linux-Benutzer `node` (UID 1000); ein Host-Bind-Mount muss für diesen Benutzer schreibbar sein. Nur eine App-Instanz gegen diese SQLite-Datei betreiben. Im laufenden Container einmalig `pnpm admin:create admin 'BvL Administration'` ausführen; das Passwort nicht in GitHub speichern.
7. Für Push-Benachrichtigungen einen stabilen VAPID-Schlüsselpaar-Satz mit `pnpm vapid:generate` **im Terminal des laufenden App-Containers** erzeugen. Die ausgegebenen Werte sicher aufbewahren und in Coolify unter Environment Variables als `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` und `VAPID_SUBJECT=mailto:<erreichbare-Kontaktadresse>` hinterlegen; nur „Available at Runtime“ aktivieren und den privaten Schlüssel nicht in GitHub oder Screenshots weitergeben. Danach neu deployen. Jeder Nutzer muss auf seinem Gerät unter Profil „Push aktivieren“ wählen und die Systemfreigabe bestätigen; auf dem iPhone erst die PWA zum Home-Bildschirm hinzufügen und dort öffnen. Admins können unter Mitteilungen an „Alle“ veröffentlichen und damit sofort Push an alle angemeldeten Geräte mit aktiver Freigabe senden. Die Schlüssel nicht leichtfertig rotieren: Bereits abonnierte Geräte müssten Push sonst erneut aktivieren.
8. Einen regelmäßigen, extern gesicherten Backup-Prozess für die Datenbank einrichten und Rücksicherung testen. Ein persistentes Volume ist **noch kein Backup**. Für eine manuelle, konsistente Kopie kann `pnpm backup` mit `BACKUP_DIR` auf einen zusätzlich gesicherten Pfad zielen.

`/health` dient als Healthcheck. `compose.yaml` ist eine lokale/alternative Docker-Compose-Option; Coolify kann direkt das Dockerfile bauen. Auf diesem PC ist aktuell kein Docker installiert, daher wurde der Container hier noch nicht gebaut. API- und Browser-Tests laufen lokal mit Node.

## Marktanalyse in der bestehenden Sales App aktivieren

Die Analyse läuft unter `https://sales.bvlki.cloud/#/market/deutschland` in derselben PWA, demselben Docker-Container und auf derselben Domain. Ein neues Projekt, ein neuer Port und eine neue Domain sind nicht erforderlich. Im Admin-Bereich unter **Links** eine Kategorie „Marktinformationen“ anlegen und darin einen direkten Link mit genau dieser URL erstellen. Bei **beiden** Einträgen nur „BvL intern“ aktivieren und „Händler“ deaktivieren. Der Link öffnet sich innerhalb der PWA; Canto- und alle anderen externen Links verhalten sich unverändert. Selbst bei einem falsch gesetzten Händler-Häkchen verweigert die Daten-API Händlern den Zugriff.

Die öffentlichen Marktwerte aus der vorhandenen HTML-Datei werden unter `server/market-data.json` mit Code und Docker ausgeliefert. Nach dem GitHub-Upload und Coolify-Rebuild ist die Analyse sofort verfügbar; ein zusätzlicher Import ist nicht erforderlich. Der Zugriff innerhalb der App und über ihre Daten-API bleibt auf Mitarbeitende und Admins beschränkt. In einem öffentlichen GitHub-Repository sind die mitgelieferten Werte öffentlich lesbar.

Optional kann ein Admin unter **Administration → Marktanalyse** eine aktualisierte JSON-Datei mit demselben Format importieren. Diese Datei liegt im bestehenden persistenten `/app/data`-Volume und hat Vorrang vor den mitgelieferten Werten. Ein solcher Import bleibt auch nach weiteren Code-Updates erhalten und wird nicht durch einen neueren Bundle-Datenstand ersetzt. Das Werkzeug `node scripts/import-market-html.mjs <Pfad-zur-HTML-Datei>` erstellt den mitzuliefernden Datenstand unter `server/market-data.json` erneut.

Für dieses Update die Dateien aus dem vorbereiteten Ordner `GitHub-Upload-BvL-Sales/` im bestehenden GitHub-Repository aktualisieren und anschließend **dieselbe Anwendung** in Coolify neu deployen. Das bestehende persistente Volume mit Ziel `/app/data` und die Umgebungsvariablen unverändert beibehalten. Benutzer, geänderte Passwörter, Kategorien, Links, Lieferzeiten, Mitteilungen und Push-Abonnements liegen in `sales.sqlite` im Volume; das Marktanalyse-Update ersetzt diese Datei nicht und verändert ihr Schema nicht. Der Upload-Ordner enthält weder diese Datenbank noch `.env`, Backups oder die lokale iPhone-Vorschau.

Die vereinfachte Karte basiert auf den amtlichen [BKG-Verwaltungsgebieten VG250 (Stand 01.01.2025)](https://gdz.bkg.bund.de/index.php/default/open-data/wfs-verwaltungsgebiete-1-250-000-stand-01-01-wfs-vg250.html), [dl-de/by-2-0](https://www.govdata.de/dl-de/by-2-0), mit sichtbarer Namensnennung in der App. Das reproduzierbare Build-Skript liegt unter `scripts/build-market-geo.mjs`. Weil die HTML-Werte teils ältere Gebietseinteilungen oder abweichende Landesangaben enthalten, wird nicht per unscharfem Namen geraten; diese Fälle sind als nicht kartiert erkennbar. Die Berechnung übernimmt exakt die Standardannahmen der HTML-Datei (20 % alternative Fütterung, 10 Jahre Erneuerung, 20 % Gebrauchtmaschinen).

## Messekontakte verwenden

Nach dem Rebuild wird einmalig eine interne Kachel **Messekontakte** angelegt. Sie öffnet `https://sales.bvlki.cloud/#/contacts` innerhalb der PWA. Bezeichnung, Icon, Position und Sichtbarkeit können danach unter Administration → Links angepasst werden. Ein später gelöschter Link wird nicht bei jedem Neustart neu angelegt. Händler haben unabhängig von der Kachel keinen Zugriff auf die Kontakt-API. Interne Mitarbeitende sehen ihre eigenen Kontakte; Admins sehen unter **Administration → Kontakte** den gesamten synchronisierten Bestand.

Die Erfassung enthält Messe/Jahr, Ansprechpartner, Betrieb, Kontaktdaten, Adresse, Kundensprache, mehrere Produktinteressen, Maschinendaten, Gesprächsnotiz, vereinbarte Aktionen, Priorität, Status und Nachfasstermin. Der Bearbeiter wird aus dem angemeldeten Konto übernommen. Kontakte und Änderungen werden zuerst atomar in IndexedDB auf dem Gerät gesichert und danach mit der Server-Datenbank abgeglichen. Lokale Entwürfe, Kontakte und Übertragungswarteschlangen sind nach Benutzerkonto getrennt. Die Admin-Gesamtübersicht wird nicht offline zwischengespeichert.

Für Offline-Nutzung die aktualisierte App einmal online öffnen und anmelden, damit ihre Oberfläche auf dem Gerät verfügbar ist. Nach einem Start ohne Verbindung kann das zuletzt online bestätigte interne Konto bis zu sieben Tage die eigenen lokal gespeicherten Messekontakte nutzen; eine neue Anmeldung und administrative Aktionen benötigen Internet. Ausstehende Kontakte bleiben bei einer Abmeldung lokal für dasselbe Konto erhalten. Eine Offline-Abmeldung sperrt die lokale Ansicht sofort und merkt die serverseitige Abmeldung für die nächste Verbindung vor. Beim Kontowechsel erscheinen keine Kontakte oder Entwürfe des vorherigen Kontos.

Der Abgleich wird beim Öffnen, bei Rückkehr zur App, bei wiederhergestellter Verbindung und im Vordergrund regelmäßig versucht. Auf iOS wird keine Synchronisierung bei vollständig geschlossener App versprochen. Die Anzeige unterscheidet **lokal gespeichert**, **wartet auf Abgleich**, **synchronisiert** und **Änderungskonflikt**. Wiederholte Übertragungen derselben Änderung sind serverseitig idempotent; Konflikte mit zwischenzeitlich geänderten Serverdaten werden ausdrücklich aufgelöst. Gleichzeitiges Bearbeiten desselben Kontakts in mehreren Fenstern desselben Geräts sollte vermieden werden, da diese dieselbe lokale Warteschlange teilen. Erst „synchronisiert“ bestätigt die Speicherung auf dem VPS. Das Löschen von Website-/App-Daten auf dem Handy entfernt auch noch nicht übertragene Kontakte; der lokale Puffer ist kein Backup.

**Dankes-E-Mail öffnen** erstellt einen `mailto:`-Entwurf mit Kundenadresse, Messe, ausgewählten Produktbezeichnungen und Verkäufername in Deutsch bzw. Englisch. Interne Gesprächsnotizen und Anforderungsdetails werden nicht in die Vorlage übernommen. Die auf dem Gerät eingerichtete Mail-App bestimmt das Absenderkonto; der Verkäufer kann Text und Absender bearbeiten und bestätigt dort den Versand. Kein automatischer Versand, keine Marketing-Weiterleitung, kein SMTP-Zugang und kein Zugriff auf `info@bvlki.cloud` sind dafür nötig. Ein geöffneter Entwurf wird nicht als tatsächlicher Versandnachweis dargestellt. Die Übergabe an die konfigurierte Mail-App muss auf echten iPhones und Android-Geräten geprüft werden.

Unter **Administration → Kontakte** lassen sich Kontakte nach Messe, Jahr, Bearbeiter, Status und Priorität filtern oder nach Name, Betrieb, E-Mail, Ort und PLZ suchen. Details zeigen die vollständige Erfassung. CSV-Exporte enthalten entweder das gefilterte Ergebnis oder bis zu 200 ausgewählte Kontakte, mit UTF-8-BOM, Semikolon und Schutz gegen Excel-Formelausführung. CSV lässt sich in Excel öffnen; es handelt sich nicht um eine native `.xlsx`-Datei.

Die zusätzlichen Tabellen `contacts`, `contact_mutations` und `app_migrations` werden beim Start additiv in der bestehenden `sales.sqlite` angelegt. Nutzerkonten, Passwörter, Links und andere Bestandsdaten werden nicht ersetzt. Weiterhin dasselbe persistente `/app/data`-Volume verwenden und vor dem produktiven Update eine konsistente Datenbanksicherung erstellen. Die vorhandene SQLite-Sicherung enthält auch synchronisierte Kontakte; lokale, noch nicht übertragene Kontakte sind dort nicht enthalten. Kontaktdaten, Testdaten und die lokale Vorschau gehören nicht in GitHub und sind nicht im Upload-Paket enthalten.

## Vor echtem Rollout prüfen

- Ziel-URLs und Zugriffsgruppen der aus dem Prototyp übernommenen Links durch BvL bestätigen lassen (einschließlich des generischen Canto-Einstiegs).
- DNS und HTTPS für `sales.bvlki.cloud`, GitHub-Repository und spätere Benutzerliste prüfen.
- iPhone-Safari/Home-Screen-Installation, iOS-Web-Push und Android-Push auf physischen Geräten testen; Push-Berechtigung wird nur nach Benutzeraktion angefragt.
- Datenschutz/Impressum sowie Aufbewahrung von Benutzer- und Mitteilungsdaten mit BvL abstimmen.
- Backup und Wiederherstellung auf dem VPS testen, bevor die App produktive Benutzer erhält.

## Technische Grenzen

Der Service Worker hält die öffentliche App-Oberfläche offline vor und speichert keine API-Antworten. Eigene Messekontakte und Entwürfe liegen separat benutzerbezogen in IndexedDB. Marktwerte, Milchpreis, Lieferzeiten, die Admin-Kontaktübersicht und externe Zielseiten werden nicht offline gespeichert. Die SQLite-Datenbank ist für eine einzelne VPS-Instanz ausgelegt; für mehrere App-Replikas wäre eine Server-Datenbank nötig. Die verwendete `node:sqlite`-API in Node 24 ist noch als Release Candidate gekennzeichnet; vor breiter Produktion ist eine erneute technische Freigabe sinnvoll.
