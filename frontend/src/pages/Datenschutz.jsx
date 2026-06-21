import { Link } from "react-router-dom";

const wrap = {
  maxWidth: 760,
  margin: "0 auto",
  padding: "2rem 1.25rem 4rem",
  lineHeight: 1.6,
};

export default function Datenschutz() {
  return (
    <main style={wrap}>
      <p style={{ marginBottom: "1.5rem" }}>
        <Link to="/">← Back</Link>
      </p>

      <h1>Datenschutzerklärung</h1>

      <h2>1. Verantwortlicher</h2>
      <p>
        Verantwortlicher im Sinne der Datenschutz-Grundverordnung (DSGVO) und
        anderer nationaler Datenschutzgesetze ist:
      </p>
      <p>
        Ivan Andrianov
        <br />
        Wasgenstraße 75, Hs. 3, Zi. 03.01.02.05
        <br />
        14129 Berlin
        <br />
        Deutschland
        <br />
        E-Mail: ivaa03@zedat.fu-berlin.de
      </p>

      <h2>2. Ihre Rechte als betroffene Person</h2>
      <p>Sie haben gegenüber dem Verantwortlichen folgende Rechte:</p>
      <ul>
        <li>Recht auf Auskunft (Art. 15 DSGVO)</li>
        <li>Recht auf Berichtigung (Art. 16 DSGVO)</li>
        <li>Recht auf Löschung (Art. 17 DSGVO)</li>
        <li>Recht auf Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
        <li>Recht auf Datenübertragbarkeit (Art. 20 DSGVO)</li>
        <li>Recht auf Widerspruch gegen die Verarbeitung (Art. 21 DSGVO)</li>
      </ul>
      <p>
        Sie haben zudem das Recht, sich bei einer
        Datenschutz-Aufsichtsbehörde über die Verarbeitung Ihrer
        personenbezogenen Daten zu beschweren. Die für mich zuständige
        Aufsichtsbehörde ist die Berliner Beauftragte für Datenschutz und
        Informationsfreiheit, Alt-Moabit 59–61, 10555 Berlin.
      </p>

      <h2>3. Erfassung von Daten beim Besuch der Website (Hosting &amp; Server-Logfiles)</h2>
      <p>
        Diese Website wird bei der Vercel Inc., 340 S Lemon Ave #4133, Walnut,
        CA 91789, USA, gehostet. Beim Aufruf der Website werden durch den
        Hosting-Anbieter automatisch Informationen in sogenannten Server-Logfiles
        erfasst, die Ihr Browser übermittelt. Dies sind insbesondere:
      </p>
      <ul>
        <li>IP-Adresse des anfragenden Geräts</li>
        <li>Datum und Uhrzeit des Zugriffs</li>
        <li>aufgerufene Seite bzw. Datei</li>
        <li>verwendeter Browsertyp und dessen Version</li>
        <li>verwendetes Betriebssystem</li>
        <li>Referrer-URL (die zuvor besuchte Seite)</li>
      </ul>
      <p>
        Die Verarbeitung dieser Daten erfolgt auf Grundlage von Art. 6 Abs. 1
        lit. f DSGVO. Mein berechtigtes Interesse liegt in der technisch
        fehlerfreien Darstellung, der Stabilität und der Sicherheit der Website.
        Eine Zusammenführung dieser Daten mit anderen Datenquellen zur
        Identifizierung einzelner Personen findet nicht statt.
      </p>

      <h2>4. Datenübermittlung in Drittländer (USA)</h2>
      <p>
        Der eingesetzte Hosting- und Analysedienstleister Vercel Inc. hat seinen
        Sitz in den USA. Dabei kann es zu einer Übermittlung personenbezogener
        Daten in die USA kommen. Die Datenübermittlung ist durch den Abschluss
        der EU-Standardvertragsklauseln (Standard Contractual Clauses) im Rahmen
        einer Auftragsverarbeitungsvereinbarung mit Vercel abgesichert. Weitere
        Informationen finden Sie in den Datenschutzbestimmungen von Vercel unter{" "}
        <a
          href="https://vercel.com/legal/privacy-policy"
          target="_blank"
          rel="noopener noreferrer"
        >
          vercel.com/legal/privacy-policy
        </a>
        .
      </p>

      <h2>5. Reichweitenmessung mit Vercel Web Analytics</h2>
      <p>
        Auf dieser Website wird Vercel Web Analytics, ein Dienst der Vercel Inc.,
        zur statistischen Auswertung der Besucherzugriffe eingesetzt. Vercel Web
        Analytics arbeitet cookielos und ohne dauerhafte Identifikatoren. Es
        werden keine Cookies gesetzt und keine geräteübergreifenden Profile
        gebildet. Zur Zählung von Besuchern wird ein anonymer Hash aus den Daten
        der eingehenden Anfrage erzeugt, der spätestens nach 24 Stunden verworfen
        wird. Die erhobenen Daten (z. B. Seitenaufrufe, Referrer, ungefähre
        Region, Gerät und Browser) werden ausschließlich in aggregierter,
        anonymer Form ausgewertet und nicht einer identifizierbaren Person
        zugeordnet.
      </p>
      <p>
        Rechtsgrundlage für den Einsatz ist Art. 6 Abs. 1 lit. f DSGVO. Mein
        berechtigtes Interesse liegt in der datensparsamen, anonymen Analyse des
        Nutzungsverhaltens zur Verbesserung des Angebots. Da keine Informationen
        auf Ihrem Endgerät gespeichert oder ausgelesen werden, ist keine
        Einwilligung nach § 25 TDDDG erforderlich.
      </p>

      <h2>6. SSL- bzw. TLS-Verschlüsselung</h2>
      <p>
        Diese Seite nutzt aus Sicherheitsgründen und zum Schutz der Übertragung
        vertraulicher Inhalte eine SSL- bzw. TLS-Verschlüsselung. Eine
        verschlüsselte Verbindung erkennen Sie daran, dass die Adresszeile des
        Browsers von „http://“ auf „https://“ wechselt.
      </p>

      <h2>7. Aktualität und Änderung dieser Datenschutzerklärung</h2>
      <p>
        Diese Datenschutzerklärung ist aktuell gültig. Durch die Weiterentwicklung
        der Website oder aufgrund geänderter gesetzlicher bzw. behördlicher
        Vorgaben kann es notwendig werden, diese Datenschutzerklärung anzupassen.
      </p>
    </main>
  );
}
