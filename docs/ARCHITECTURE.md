# Smartnotes MVP - Architektur-Handbuch

Dieses Dokument erklärt die technische Logik und die Sicherheits-Mechanismen der Anwendung, insbesondere das anonyme Authentifizierungs-System.

## 1. Das "Spurlose" Authentifizierungs-System

Das Ziel dieses Systems ist es, dass in der Datenbank keine Verbindung zwischen einem Login-Versuch (Magic Link oder Code) und einer tatsächlichen Sitzung (`accessGrant`) nachvollziehbar bleibt.

### Der Magic-Link-Flow (Verifizierung)

Wenn ein Benutzer einen Link wie `?magicToken=XYZ` öffnet:

1.  **Frontend-Initialisierung:** Die `App.tsx` erkennt den URL-Parameter und ruft die Mutation `access:consumeMagicLink` auf.
2.  **Verifizierung (Backend):**
    - Der `magicToken` wird in der Tabelle `magicLinks` gesucht.
    - Existiert er nicht oder ist er abgelaufen (> 15 Min), bricht die Funktion mit einem Fehler ab.
3.  **Anonymisierung durch "Rauschen" (Decoys):**
    - Das System sucht alle verfügbaren (unbenutzten) `accessCodes`.
    - Es wählt zufällig **drei** dieser Codes aus (sofern vorhanden).
4.  **Sitzungs-Erstellung (`accessGrant`):**
    - Ein neuer `accessGrant` (Sitzungs-Ticket) wird erstellt.
    - **Wichtig:** Dieser Grant speichert _keine_ ID des ursprünglichen Zugangscodes. Er ist technisch völlig isoliert.
5.  **Spurenvernichtung (Löschen):**
    - Der benutzte `magicLink` wird physisch aus der Datenbank gelöscht.
    - Die drei ausgewählten `accessCodes` werden ebenfalls physisch aus der Datenbank gelöscht.
6.  **Rückgabe:** Das System schickt den Sitzungs-Token (`grantToken`) und die drei (nun gelöschten) Codes als Liste an das Frontend zurück.

**Sicherheits-Effekt:** Ein Administrator oder Angreifer kann in der Datenbank nicht sehen, welcher der drei gelöschten Codes die Sitzung aktiviert hat. Da auch der Magic Link weg ist, ist der Ursprung der Sitzung unauffindbar.

## 2. Datenmodell (Schema)

Die wichtigsten Tabellen in `convex/schema.ts`:

- **`accessCodes`**: Einmalige Codes für den manuellen oder automatischen Login.
- **`magicLinks`**: Kurzlebige Einmal-Tokens für URL-Logins.
- **`accessGrants`**: Die "Ausweise" eingeloggter Benutzer. Sie steuern, ob jemand Zugriff auf eine Lern-Sitzung hat.
- **`studySessions`**: Das Herzstück – enthält Lernfortschritt, Themen-Zusammenfassungen und Quiz-Fragen.
- **`sessionDocuments`**: Referenzen auf hochgeladene Dateien im Convex File Storage.

## 3. Privacy vs. Pseudonymität

Technisch ist das System **stark pseudonymisiert**.

- **Pseudonym:** Es gibt keine Namen oder E-Mails. Ein Benutzer ist für das System nur eine anonyme ID (`grantId`).
- **Logs:** Die einzige Spur sind temporäre Server-Logs (ca. 14 Tage). Ein Admin könnte dort theoretisch via Zeitstempel Korrelationen ziehen ("Wer hat um 14:00 Uhr den Link geklickt?"). Nach Ablauf der Log-Aufbewahrung ist das System faktisch **anonym**.

## 4. Wartung & MVP-Hinweise

- **Admin-Secret:** Die Variable `ACCESS_CODE_ADMIN_SECRET` in den Convex Environment Variables ist der Generalschlüssel zum Erstellen von Codes und Links. Sie darf niemals im Frontend auftauchen.
- **Lösch-Logik:** Da wir Daten (Codes/Links) löschen, statt sie nur zu markieren, muss das Frontend robust mit Fehlern umgehen (z. B. wenn ein Link doppelt geklickt wird).

---

_Dieses Dokument dient dem Verständnis des MVP-Codes. Bei Erweiterungen sollte die Lösch-Logik stets auf Konsistenz geprüft werden._
