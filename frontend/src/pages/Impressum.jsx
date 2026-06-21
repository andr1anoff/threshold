import { Link } from "react-router-dom";

const wrap = {
  maxWidth: 760,
  margin: "0 auto",
  padding: "2rem 1.25rem 4rem",
  lineHeight: 1.6,
};

export default function Impressum() {
  return (
    <main style={wrap}>
      <p style={{ marginBottom: "1.5rem" }}>
        <Link to="/">← Back</Link>
      </p>

      <h1>Impressum</h1>

      <h2>Angaben gemäß § 5 DDG</h2>
      <p>
        Ivan Andrianov
        <br />
        Wasgenstraße 75, Hs. 3, Zi. 03.01.02.05
        <br />
        14129 Berlin
        <br />
        Deutschland
      </p>

      <h2>Kontakt</h2>
      <p>E-Mail: ivaa03@zedat.fu-berlin.de</p>

      <h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
      <p>
        Ivan Andrianov
        <br />
        Anschrift wie oben
      </p>

      <h2>Haftung für Inhalte</h2>
      <p>
        Als Diensteanbieter bin ich gemäß § 7 Abs. 1 DDG für eigene Inhalte auf
        diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis
        10 DDG bin ich als Diensteanbieter jedoch nicht verpflichtet, übermittelte
        oder gespeicherte fremde Informationen zu überwachen oder nach Umständen
        zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.
        Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen
        nach den allgemeinen Gesetzen bleiben hiervon unberührt. Eine
        diesbezügliche Haftung ist jedoch erst ab dem Zeitpunkt der Kenntnis einer
        konkreten Rechtsverletzung möglich. Bei Bekanntwerden von entsprechenden
        Rechtsverletzungen werde ich diese Inhalte umgehend entfernen.
      </p>
      <p>
        Diese Website aggregiert und verlinkt öffentlich zugängliche
        Informationen Dritter (Open-Source-Intelligence). Für die Richtigkeit,
        Vollständigkeit und Aktualität dieser fremden Inhalte wird keine
        Gewähr übernommen.
      </p>

      <h2>Haftung für Links</h2>
      <p>
        Mein Angebot enthält Links zu externen Websites Dritter, auf deren
        Inhalte ich keinen Einfluss habe. Deshalb kann ich für diese fremden
        Inhalte auch keine Gewähr übernehmen. Für die Inhalte der verlinkten
        Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten
        verantwortlich. Die verlinkten Seiten wurden zum Zeitpunkt der
        Verlinkung auf mögliche Rechtsverstöße überprüft. Rechtswidrige Inhalte
        waren zum Zeitpunkt der Verlinkung nicht erkennbar. Eine permanente
        inhaltliche Kontrolle der verlinkten Seiten ist jedoch ohne konkrete
        Anhaltspunkte einer Rechtsverletzung nicht zumutbar. Bei Bekanntwerden
        von Rechtsverletzungen werde ich derartige Links umgehend entfernen.
      </p>

      <h2>Urheberrecht</h2>
      <p>
        Die durch den Seitenbetreiber erstellten Inhalte und Werke auf diesen
        Seiten unterliegen dem deutschen Urheberrecht. Die Vervielfältigung,
        Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der
        Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung des
        jeweiligen Autors bzw. Erstellers. Soweit die Inhalte auf dieser Seite
        nicht vom Betreiber erstellt wurden, werden die Urheberrechte Dritter
        beachtet. Insbesondere werden Inhalte Dritter als solche gekennzeichnet.
        Sollten Sie trotzdem auf eine Urheberrechtsverletzung aufmerksam werden,
        bitte ich um einen entsprechenden Hinweis. Bei Bekanntwerden von
        Rechtsverletzungen werde ich derartige Inhalte umgehend entfernen.
      </p>
    </main>
  );
}
