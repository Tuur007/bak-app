// Uitleg in gewone taal van de woorden in de app. Eén plaats, gebruikt in de eerste-keer-hulp en
// in de instellingen.

export interface Term { term: string; text: string }

export const GLOSSARY: Term[] = [
  { term: 'Verdubbeld', text: 'Na het voeden rijst je starter. Staat hij dubbel zo hoog als bij het voeden (zet er een elastiekje om het potje), dan is hij op zijn piek. Tik dan op "Verdubbeld".' },
  { term: 'Drijftest', text: 'Een theelepeltje starter in een glas water. Blijft het drijven, dan zit er genoeg lucht in en is de starter klaar. Zinkt het, voed hem dan nog eens en wacht tot hij verdubbeld is.' },
  { term: '1:5:5', text: 'De voedingsverhouding: 1 deel oude starter, 5 delen meel en 5 delen water. Met 20 g starter voeg je dus 100 g meel en 100 g water toe.' },
  { term: 'Klaar om te bakken', text: 'Een starter is klaar als hij na het voeden een paar keer op rij binnen enkele uren verdubbelt, en minstens twee weken oud is. Dat is een schatting: jij ziet het aan hem.' },
  { term: 'Hydratatie', text: 'Hoeveel water er in je deeg zit, in procent van het meel. 70% betekent 70 g water op 100 g meel. Het meel en water uit de starter tellen mee.' },
  { term: 'Bulk', text: 'Het eerste rijzen van het hele deeg, voor je het vormt. Je kijkt of het deeg gerezen is, bellen heeft en wiebelt.' },
  { term: 'Koude rijs', text: 'Het gevormde deeg rijst langzaam in de koelkast, vaak de hele nacht. Dat geeft meer smaak en laat je zelf kiezen wanneer je bakt.' },
  { term: 'Wekker en bel', text: 'De bel bij een stap zet een melding op je telefoon. Dat werkt als je een account hebt en de meldingen aanstaan. Het schema met uren blijft altijd zichtbaar.' },
];
