#!/usr/bin/env python3
"""Genereert de 5 mockup-pagina's (r1..r5.html) + index.html. Alleen voor ontwerpverkenning, geen app-code."""
import html, os
OUT = os.path.dirname(os.path.abspath(__file__))

PAGE = """<!doctype html>
<html lang="nl-BE"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>%%NAAM%% - richting %%NR%%</title>
%%FONTS%%
<link rel="stylesheet" href="shared.css">
<style>%%CSS%%</style></head>
<body><div class="page">
<div class="top">%%NAV%%</div>
<div class="layout">
<div class="info">
<h1>Richting %%NR%%: %%NAAM%%</h1>
<p class="sfeer">%%SFEER%%</p>
<div class="jump">%%JUMP%%</div>
<h2>Kleurpalet en contrast</h2>
<div class="sw">%%SW%%</div>
<h2>Contrast (WCAG)</h2>
<table class="c">%%CONTRAST%%</table>
<h2>Lettertypes</h2><p>%%LETTERS%%</p>
<h2>Waarom dit bij brood past</h2><p>%%WAAROM%%</p>
<h2>Sterk</h2><ul class="plus">%%PLUS%%</ul>
<h2>Zwak</h2><ul class="min">%%MIN%%</ul>
<p class="note">Alle cijfers in de mockup zijn voorbeelden. Tik op de knoppen, de tabbalk, de stappen en de timer; de velden in &quot;Nieuwe bak&quot; rekenen live mee.</p>
</div>
<div class="phonewrap"><div class="phone"><div class="screenbox">
<div class="notch"></div><div class="statusbar"><span>9:41</span><span>5G 87%</span></div>
%%SCREENS%%
<div class="homebar"></div>
</div></div></div>
</div></div>
<script src="shared.js"></script>
</body></html>"""

def nav(cur):
    items = [("index.html", "Overzicht")] + [("r%d.html" % i, "Richting %d" % i) for i in range(1, 10)] + [("../rapport/index.html", "Rapport")]
    return "".join('<a href="%s"%s>%s</a>' % (h, ' class="on"' if h == "r%d.html" % cur else "", t) for h, t in items)

def tabs(labels):
    return '<div class="tabbar">' + "".join('<button data-s="%d">%s</button>' % (i, l) for i, l in enumerate(labels)) + "</div>"

D = {}

# ---------------------------------------------------------------- 1 RECEPTEN-LOOK
D[1] = dict(
 naam="Zusjes Recepten", sfeer="Dezelfde warme keuken als de Recepten-app: terracotta, zachte kaarten, rustig en bekend.",
 fonts='<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=Oswald:wght@600&display=swap" rel="stylesheet">',
 sw=[("Warm wit","#FFFBF8"),("Terracotta","#A94F37"),("Roze vlak","#F8DDD4"),("Tekst (inkt uit Recepten-app)","#2B2420"),("Gedempt (textLight)","#625C58"),("Donkere terracotta","#8C3D29")],
 contrast=[("Tekst op warm wit","14,8"),("Terracotta op warm wit","5,3"),("Wit op terracotta (knop)","5,4"),("Donkere terracotta #8C3D29 op roze","5,8"),("Gedempt op warm wit","6,4")],
 letters="Oswald 600 in hoofdletters voor schermtitels, Nunito voor al de rest. Geen gradients, geen harde schaduwen. Kaarten radius 16, knoppen radius 12. Kleuren overgenomen uit constants/Designsystem.ts van de Recepten-app (inkt #2B2420, textLight ca. 74% inkt, primaryDark #8C3D29 voor tekst op roze).",
 waarom="Je zus kent de look al, dus nul leercurve. Eén codebasis en één set componenten voor beide apps. Rustig en hoog contrast.",
 plus=["Herkenbaar, snel te bouwen: bestaande componenten hergebruiken","Zacht, rustig en goed leesbaar (contrast 5 tot 14)"],
 min=["Het voelt als 'nog een receptenapp' en niet als iets voor brood","Terracotta op roze haalt 4,2: alleen voor grote of vette tekst"],
 css="""
.screenbox{background:#FFFBF8;color:#2B2420;font-family:Nunito,system-ui,sans-serif}
.statusbar{color:#2B2420}.homebar{background:#2B2420}
h2.t{font:600 28px/1.1 Oswald,sans-serif;text-transform:uppercase;letter-spacing:.02em;margin:0 0 16px}
.card{background:#fff;border:1px solid #F0DDD5;border-radius:16px;padding:16px;margin-bottom:16px}
.card.pink{background:#F8DDD4;border-color:#F8DDD4}
.lbl{font-size:13px;font-weight:700;color:#625C58;text-transform:uppercase;letter-spacing:.05em}
.big{font:600 44px/1 Oswald,sans-serif;color:#A94F37;letter-spacing:.02em}
.btn{display:flex;align-items:center;justify-content:center;min-height:48px;border-radius:12px;background:#A94F37;color:#fff;font:800 16px Nunito;border:0;width:100%;cursor:pointer}
.btn.ghost{background:#fff;color:#A94F37;border:2px solid #A94F37}
.row{display:flex;justify-content:space-between;align-items:center;gap:8px}
.pill{background:#F8DDD4;color:#8C3D29;border-radius:12px;padding:4px 8px;font-weight:700;font-size:13px}
.tabbar{background:#fff;border-top:1px solid #F0DDD5}.tabbar button{color:#625C58;font-weight:700;font-size:13px}.tabbar button.on{color:#A94F37}
.field{margin-bottom:8px}.field label{display:block;font-size:13px;font-weight:700;color:#625C58;margin-bottom:4px}
.field input{width:100%;height:48px;border:2px solid #F0DDD5;border-radius:12px;padding:0 16px;font:700 18px Nunito;background:#fff;color:#2B2420}
.two{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.ratio{text-align:center;background:#F8DDD4;border-radius:16px;padding:12px 8px}.ratio b{display:block;font:600 26px Oswald;color:#A94F37}.ratio span{font-size:12px;font-weight:700;color:#8C3D29}
.step{display:flex;gap:16px;align-items:center;min-height:56px;padding:8px 0;border-bottom:1px solid #F0DDD5;cursor:pointer}
.step .tm{width:56px;font:600 16px Oswald;color:#625C58}.step .dot{width:24px;height:24px;border-radius:12px;border:2px solid #A94F37;flex:none}
.step.done .dot{background:#A94F37}.step.done .nm{text-decoration:line-through;color:#625C58}
.step.now{background:#F8DDD4;border-radius:12px;padding:8px;border:0}
.photo{width:64px;height:64px;border-radius:12px;background:#F8DDD4;flex:none;display:flex;align-items:center;justify-content:center;font:600 12px Oswald;color:#A94F37}
.log{display:flex;gap:16px}.log h4{font-size:17px}.log p{font-size:14px;color:#625C58}
.stars{color:#A94F37;font-weight:800;letter-spacing:2px}
""",
 screens="""
<div class="scr on"><div class="body">
<h2 class="t">Vandaag</h2>
<div class="card pink"><div class="lbl">Lopende bak</div><div class="row" style="margin:8px 0"><div><h3 style="font-size:20px">Landbrood</h3><p style="font-size:14px">Vouwen 3 van 4</p></div><div class="big" data-sec="760"></div></div>
<button class="btn" data-s="2">Naar de tijdlijn</button></div>
<div class="card"><div class="lbl">Starter</div><div class="row" style="margin-top:8px"><div><h3 style="font-size:18px">Oma-starter</h3><p style="font-size:14px;color:#625C58">Gevoed om 06:30, 1:5:5</p></div><span class="pill">Op piek</span></div></div>
<div class="card"><div class="lbl">Vandaag in de oven</div><p style="margin-top:8px"><b>Zaterdag 10:00</b> oven aan, <b>10:45</b> bakken. Klaar om <b>12:00</b>.</p></div>
<button class="btn ghost" data-s="1">Nieuwe bak plannen</button>
</div>%%TABS%%</div>

<div class="scr"><div class="body">
<h2 class="t">Nieuwe bak</h2>
<div class="two">
<div class="field"><label>Meel (g)</label><input class="calc" id="f-meel" inputmode="decimal" value="500"></div>
<div class="field"><label>Water (g)</label><input class="calc" id="f-water" inputmode="decimal" value="350"></div>
<div class="field"><label>Starter (g)</label><input class="calc" id="f-starter" inputmode="decimal" value="100"></div>
<div class="field"><label>Starter hydratatie %</label><input class="calc" id="f-sthyd" inputmode="decimal" value="100"></div>
<div class="field"><label>Zout (g)</label><input class="calc" id="f-zout" inputmode="decimal" value="10"></div>
<div class="field"><label>Keuken (graden)</label><input id="f-temp" inputmode="decimal" value="21"></div>
</div>
<div class="two" style="grid-template-columns:1fr 1fr 1fr;margin:8px 0 16px">
<div class="ratio"><b id="o-hyd"></b><span>Hydratatie</span></div><div class="ratio"><b id="o-st"></b><span>Starter</span></div><div class="ratio"><b id="o-zout"></b><span>Zout</span></div></div>
<div class="card pink"><div class="lbl">Klaar tegen</div><p style="font:600 22px Oswald;margin-top:4px">Zaterdag 12:00</p><p style="font-size:14px;margin-top:4px">Keuken 21 graden: bulk wordt 45 min langer dan bij 24 graden.</p></div>
<button class="btn" data-s="2">Plan terugrekenen</button>
</div>%%TABS%%</div>

<div class="scr"><div class="body">
<h2 class="t">Tijdlijn</h2>
<p style="margin-bottom:8px;font-size:14px;color:#625C58">Landbrood, klaar zaterdag 12:00</p>
<div class="step done" data-step><span class="tm">06:30</span><span class="dot"></span><span class="nm">Starter voeden</span></div>
<div class="step done" data-step><span class="tm">14:00</span><span class="dot"></span><span class="nm">Mengen, zout erbij</span></div>
<div class="step done" data-step><span class="tm">15:15</span><span class="dot"></span><span class="nm">Vouwen 2</span></div>
<div class="step now" data-step><span class="tm">16:00</span><span class="dot"></span><span class="nm"><b>Vouwen 3</b><br><span class="big" style="font-size:26px" data-sec="760"></span></span></div>
<div class="step" data-step><span class="tm">16:45</span><span class="dot"></span><span class="nm">Vouwen 4</span></div>
<div class="step" data-step><span class="tm">19:30</span><span class="dot"></span><span class="nm">Bulk klaar, vormen</span></div>
<div class="step" data-step><span class="tm">20:00</span><span class="dot"></span><span class="nm">Koelkast (koude rijs)</span></div>
<div class="step" data-step><span class="tm">za 10:00</span><span class="dot"></span><span class="nm">Oven aan, 240 graden</span></div>
<div class="step" data-step><span class="tm">za 10:45</span><span class="dot"></span><span class="nm">Bakken, 40 min</span></div>
<p style="font-size:13px;color:#625C58;margin-top:16px">Meldingen komen van de server; de tijden blijven kloppen ook als de app dicht was.</p>
</div>%%TABS%%</div>

<div class="scr"><div class="body">
<h2 class="t">Logboek</h2>
<div class="card log"><div class="photo">FOTO</div><div><h4>Landbrood</h4><p>za 31 okt, 73%, starter 20%</p><div class="stars">4 van 5</div><p>Volgende keer: bulk 30 min langer.</p></div></div>
<div class="card log"><div class="photo">FOTO</div><div><h4>Volkoren 30%</h4><p>za 24 okt, 78%, starter 20%</p><div class="stars">3 van 5</div><p>Korst te donker, oven 10 graden lager.</p></div></div>
<div class="card log"><div class="photo">FOTO</div><div><h4>Landbrood</h4><p>za 17 okt, 72%, starter 18%</p><div class="stars">5 van 5</div><p>Zo houden.</p></div></div>
</div>%%TABS%%</div>
""", tabs_labels=["Vandaag","Nieuwe bak","Tijdlijn","Logboek"],
)

# ---------------------------------------------------------------- 2 BAKSCHRIFT
D[2] = dict(
 naam="Bakschrift", sfeer="Een oud schrift vol aantekeningen: lijntjes, een rode kantlijn, geel markeerstift en een beetje handschrift.",
 fonts='<link href="https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=Source+Serif+4:wght@400;600;700&family=Courier+Prime:wght@400;700&display=swap" rel="stylesheet">',
 sw=[("Papier","#F5ECD9"),("Inkt","#26283A"),("Kantlijn rood","#B03A2E"),("Markeerstift","#F4D35E"),("Gedempt","#5E5A66")],
 contrast=[("Inkt op papier","12,4"),("Rood op papier","5,1"),("Gedempt op papier","5,7"),("Papier op inkt (knop)","12,4")],
 letters="Caveat 700 voor titels en notities (handschrift, alleen groot gebruikt), Source Serif 4 voor lopende tekst, Courier Prime voor cijfers en gram. Handschrift nooit voor kleine tekst of getallen: dat leest slecht.",
 waarom="Een bakker schrijft al eeuwen op papier; het voelt als haar eigen schrift. Lijnen en kantlijn geven structuur zonder dozen. Cijfers in typemachine-letter blijven helder.",
 plus=["Warm, persoonlijk en onderscheidend; past bij 'wat deed ik, wat vond ik'","Weinig kaders: schermen voelen licht en rustig"],
 min=["Handschriftfont kan bij veel tekst vermoeien; strikte regels nodig","Lijnenpapier-achtergrond is druk als er veel inhoud is"],
 css="""
.screenbox{background:#F5ECD9;color:#26283A;font-family:'Source Serif 4',Georgia,serif}
.statusbar{color:#26283A}.homebar{background:#26283A}
.paper{background:repeating-linear-gradient(#F5ECD9 0,#F5ECD9 31px,#C5D3E6 31px,#C5D3E6 32px);background-position:0 -9px}
.scr .body{background:repeating-linear-gradient(#F5ECD9 0,#F5ECD9 31px,#C5D3E6 31px,#C5D3E6 32px);background-position:0 8px;padding-left:48px;border-left:2px solid #B03A2E;margin-left:32px;padding-left:16px}
h2.t{font:700 44px/1 Caveat,cursive;color:#B03A2E;margin:0 0 16px;transform:rotate(-1deg)}
.hand{font:700 26px/32px Caveat,cursive}
.mono{font-family:'Courier Prime',monospace;font-weight:700}
.hl{background:linear-gradient(transparent 20%,#F4D35E 20%,#F4D35E 90%,transparent 90%);padding:0 4px}
.btn{display:flex;align-items:center;justify-content:center;min-height:48px;background:#26283A;color:#F5ECD9;font:700 24px Caveat;border:0;border-radius:4px;width:100%;cursor:pointer;margin-top:16px;transform:rotate(-.5deg)}
.btn.ghost{background:transparent;color:#26283A;border:2px solid #26283A}
.tabbar{background:#EBDFC6;border-top:2px solid #26283A}.tabbar button{font:700 22px Caveat;color:#5E5A66}.tabbar button.on{color:#B03A2E;text-decoration:underline wavy}
.line{min-height:32px;line-height:32px;font-size:17px}
.frow{display:flex;align-items:baseline;gap:8px;min-height:48px}.frow label{flex:1;font:700 22px Caveat}
.frow input{width:112px;height:44px;border:0;border-bottom:2px solid #26283A;background:transparent;font:700 22px 'Courier Prime';text-align:right;color:#26283A}
.sum{display:flex;gap:8px;margin:16px 0}.sum div{flex:1;border:2px solid #26283A;border-radius:4px;text-align:center;padding:4px;background:#F5ECD9}
.sum b{display:block;font:700 26px 'Courier Prime'}.sum span{font:700 18px Caveat;color:#B03A2E}
.step{display:flex;gap:8px;align-items:center;min-height:44px;cursor:pointer;font-size:17px}
.step .tm{font:700 16px 'Courier Prime';width:64px}.step .dot{width:24px;height:24px;border:2px solid #26283A;border-radius:4px;flex:none}
.step.done .dot{background:#26283A}.step.done .nm{text-decoration:line-through;color:#5E5A66}
.step.now .nm{font-weight:700}
.count{font:700 56px 'Courier Prime';color:#B03A2E;display:inline-block;transform:rotate(-1deg)}
.photo{width:72px;height:72px;background:#fff;padding:4px 4px 12px;box-shadow:0 1px 0 #999;transform:rotate(-3deg);flex:none}.photo i{display:block;height:100%;background:#C7925A}
.entry{display:flex;gap:16px;padding:8px 0;margin-bottom:8px}
.stars{font:700 22px Caveat;color:#B03A2E}
.note{font:700 22px/1.1 Caveat;margin-top:4px}
""",
 screens="""
<div class="scr on"><div class="body">
<h2 class="t">Vandaag</h2>
<p class="line mono">vr 6 nov - landbrood</p>
<p class="hand">Vouwen 3 van 4 <span class="hl">nog</span></p>
<div class="count" data-sec="760"></div>
<p class="line" style="margin-top:8px">Starter: gevoed 06:30, piekt rond 13:00 <span class="hl">klaar</span></p>
<p class="hand" style="margin-top:16px">In de oven:</p>
<p class="line mono">za 10:00 oven aan / 10:45 bakken / 12:00 eten</p>
<p class="hand" style="margin-top:16px;color:#B03A2E">Vorige keer: bulk 30 min langer!</p>
<button class="btn" data-s="2">Open de tijdlijn</button><button class="btn ghost" data-s="1">Nieuwe bak</button>
</div>%%TABS%%</div>

<div class="scr"><div class="body">
<h2 class="t">Nieuwe bak</h2>
<div class="frow"><label>meel</label><input class="calc" id="f-meel" inputmode="decimal" value="500"><span class="mono">g</span></div>
<div class="frow"><label>water</label><input class="calc" id="f-water" inputmode="decimal" value="350"><span class="mono">g</span></div>
<div class="frow"><label>starter</label><input class="calc" id="f-starter" inputmode="decimal" value="100"><span class="mono">g</span></div>
<div class="frow"><label>starter hydr.</label><input class="calc" id="f-sthyd" inputmode="decimal" value="100"><span class="mono">%</span></div>
<div class="frow"><label>zout</label><input class="calc" id="f-zout" inputmode="decimal" value="10"><span class="mono">g</span></div>
<div class="frow"><label>keuken</label><input id="f-temp" inputmode="decimal" value="21"><span class="mono">C</span></div>
<div class="sum"><div><b id="o-hyd"></b><span>hydratatie</span></div><div><b id="o-st"></b><span>starter</span></div><div><b id="o-zout"></b><span>zout</span></div></div>
<p class="hand">klaar tegen: <span class="hl">za 12:00</span></p>
<p class="line">bij 21 graden bulk 45 min langer</p>
<button class="btn" data-s="2">Reken terug</button>
</div>%%TABS%%</div>

<div class="scr"><div class="body">
<h2 class="t">Tijdlijn</h2>
<div class="step done" data-step><span class="tm">06:30</span><span class="dot"></span><span class="nm">starter voeden</span></div>
<div class="step done" data-step><span class="tm">14:00</span><span class="dot"></span><span class="nm">mengen, zout erbij</span></div>
<div class="step done" data-step><span class="tm">15:15</span><span class="dot"></span><span class="nm">vouwen 2</span></div>
<div class="step now" data-step><span class="tm">16:00</span><span class="dot"></span><span class="nm">vouwen 3 <span class="count" style="font-size:30px" data-sec="760"></span></span></div>
<div class="step" data-step><span class="tm">16:45</span><span class="dot"></span><span class="nm">vouwen 4</span></div>
<div class="step" data-step><span class="tm">19:30</span><span class="dot"></span><span class="nm">vormen</span></div>
<div class="step" data-step><span class="tm">20:00</span><span class="dot"></span><span class="nm">koelkast</span></div>
<div class="step" data-step><span class="tm">za 10:00</span><span class="dot"></span><span class="nm">oven aan 240</span></div>
<div class="step" data-step><span class="tm">za 10:45</span><span class="dot"></span><span class="nm">bakken 40 min</span></div>
<p class="hand" style="margin-top:8px">Aantekening: dag 2 ruikt fruitig.</p>
</div>%%TABS%%</div>

<div class="scr"><div class="body">
<h2 class="t">Logboek</h2>
<div class="entry"><div class="photo"><i></i></div><div><b class="mono">31 okt</b> landbrood<br><span class="mono">73% / 20% / 1,8%</span><div class="stars">4 van 5</div><div class="note">bulk 30 min langer!</div></div></div>
<div class="entry"><div class="photo"><i></i></div><div><b class="mono">24 okt</b> volkoren 30%<br><span class="mono">78% / 20% / 1,8%</span><div class="stars">3 van 5</div><div class="note">korst te donker, oven -10</div></div></div>
<div class="entry"><div class="photo"><i></i></div><div><b class="mono">17 okt</b> landbrood<br><span class="mono">72% / 18% / 1,8%</span><div class="stars">5 van 5</div><div class="note">zo houden</div></div></div>
</div>%%TABS%%</div>
""", tabs_labels=["Vandaag","Nieuw","Tijdlijn","Schrift"],
)

# ---------------------------------------------------------------- 3 LABO
D[3] = dict(
 naam="Labo", sfeer="Een bakkerslaboratorium: koel wit, strakke cijfers, monospace en kleine grafiekjes waarop je trends ziet.",
 fonts='<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">',
 sw=[("Achtergrond","#F4F5F2"),("Inkt","#101417"),("Groen (actie)","#0F6B4F"),("Oranje (let op)","#9A5000"),("Raster","#D9DCD6"),("Gedempt","#55605B")],
 contrast=[("Inkt op achtergrond","16,9"),("Groen op achtergrond","5,9"),("Wit op groen (knop)","6,5"),("Oranje #9A5000 op achtergrond (eerst #B25E00 = 4,3, daarom donkerder)","5,4"),("Gedempt op achtergrond","6,0")],
 letters="IBM Plex Mono voor alle getallen en tijden (vaste breedte, uitgelijnd), IBM Plex Sans voor tekst. 8px-raster zichtbaar in de opmaak.",
 waarom="Voor wie tweaket: hydratatie, starter% en rijstijd naast elkaar zien en de volgende bak bijsturen. Cijfers staan in kolommen, grafieken tonen of de bulk korter of langer moet.",
 plus=["Meest geschikt voor ratio's en trends; bakker 'ziet' haar vooruitgang","Heel scherp leesbaar, weinig ruis"],
 min=["Kil en technisch: minder gezellig, kan beginners afschrikken","Grafieken zijn zinloos zonder 10+ bakken data"],
 css="""
.screenbox{background:#F4F5F2;color:#101417;font-family:'IBM Plex Sans',system-ui,sans-serif}
.statusbar{color:#101417}.homebar{background:#101417}
h2.t{font:600 13px 'IBM Plex Mono';text-transform:uppercase;letter-spacing:.12em;color:#55605B;margin:0 0 16px;border-bottom:2px solid #101417;padding-bottom:8px}
.mono{font-family:'IBM Plex Mono',monospace;font-weight:600}
.panel{background:#fff;border:1px solid #D9DCD6;padding:16px;margin-bottom:8px}
.lbl{font:500 11px 'IBM Plex Mono';text-transform:uppercase;letter-spacing:.1em;color:#55605B}
.big{font:600 56px/1 'IBM Plex Mono';letter-spacing:-.02em}
.btn{display:flex;align-items:center;justify-content:center;min-height:48px;background:#0F6B4F;color:#fff;font:600 15px 'IBM Plex Sans';border:0;width:100%;cursor:pointer;margin-top:8px;border-radius:0}
.btn.ghost{background:transparent;color:#101417;border:1px solid #101417}
.tabbar{background:#101417}.tabbar button{color:#9aa39e;font:500 12px 'IBM Plex Mono';text-transform:uppercase}.tabbar button.on{color:#fff;border-top:3px solid #4CC9A0}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:#D9DCD6;border:1px solid #D9DCD6;margin-bottom:8px}
.g2>div{background:#fff;padding:8px 16px;min-height:64px}
.g2 input{width:100%;height:44px;border:0;border-bottom:2px solid #101417;background:#F4F5F2;font:600 22px 'IBM Plex Mono';padding:0 8px;color:#101417}
.res{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:#101417;margin-bottom:8px}.res div{background:#0F6B4F;color:#fff;padding:8px;text-align:center}.res b{display:block;font:600 24px 'IBM Plex Mono'}.res span{font:500 10px 'IBM Plex Mono';text-transform:uppercase;letter-spacing:.08em}
.tl{display:grid;grid-template-columns:72px 1fr auto;gap:8px;align-items:center;min-height:44px;border-bottom:1px solid #D9DCD6;cursor:pointer;padding:0 4px}
.tl .tm{font:600 14px 'IBM Plex Mono'}.tl .st{font:500 11px 'IBM Plex Mono';color:#55605B}
.tl.done{color:#55605B}.tl.done .nm{text-decoration:line-through}
.tl.now{background:#101417;color:#fff;min-height:64px}.tl.now .st{color:#4CC9A0}
.spark{width:100%;height:56px;display:block}
.tbl{width:100%;border-collapse:collapse;font:500 13px 'IBM Plex Mono'}.tbl td,.tbl th{border-bottom:1px solid #D9DCD6;padding:8px 4px;text-align:right}.tbl td:first-child,.tbl th:first-child{text-align:left}.tbl th{font-size:10px;text-transform:uppercase;color:#55605B}
""",
 screens="""
<div class="scr on"><div class="body">
<h2 class="t">Vandaag / vr 06.11</h2>
<div class="panel" style="background:#101417;color:#fff"><div class="lbl" style="color:#4CC9A0">Nu: vouwen 3/4</div><div class="big" data-sec="760"></div><div class="lbl" style="color:#9aa39e;margin-top:8px">Dough 24,1 C / bulk +18% / doel +30%</div></div>
<div class="g2"><div><div class="lbl">Starter</div><div class="mono" style="font-size:20px">piek ~13:00</div></div><div><div class="lbl">Keuken</div><div class="mono" style="font-size:20px">21 C</div></div></div>
<div class="panel"><div class="lbl">Oven</div><div class="mono" style="font-size:18px;margin-top:4px">za 10:00 aan / 10:45 bak / 12:00 klaar</div></div>
<div class="panel"><div class="lbl">Hydratatie laatste 6 bakken</div>
<svg class="spark" viewBox="0 0 240 56"><polyline fill="none" stroke="#0F6B4F" stroke-width="2" points="8,40 56,34 104,26 152,30 200,18 232,12"/><g fill="#0F6B4F"><circle cx="8" cy="40" r="3"/><circle cx="56" cy="34" r="3"/><circle cx="104" cy="26" r="3"/><circle cx="152" cy="30" r="3"/><circle cx="200" cy="18" r="3"/><circle cx="232" cy="12" r="3"/></g></svg></div>
<button class="btn ghost" data-s="1">Nieuwe bak</button>
</div>%%TABS%%</div>

<div class="scr"><div class="body">
<h2 class="t">Nieuwe bak / formule</h2>
<div class="g2">
<div><div class="lbl">Meel g</div><input class="calc" id="f-meel" inputmode="decimal" value="500"></div>
<div><div class="lbl">Water g</div><input class="calc" id="f-water" inputmode="decimal" value="350"></div>
<div><div class="lbl">Starter g</div><input class="calc" id="f-starter" inputmode="decimal" value="100"></div>
<div><div class="lbl">Starter hydr. %</div><input class="calc" id="f-sthyd" inputmode="decimal" value="100"></div>
<div><div class="lbl">Zout g</div><input class="calc" id="f-zout" inputmode="decimal" value="10"></div>
<div><div class="lbl">Keuken C</div><input id="f-temp" inputmode="decimal" value="21"></div></div>
<div class="res"><div><b id="o-hyd"></b><span>Hydratatie</span></div><div><b id="o-st"></b><span>Starter</span></div><div><b id="o-zout"></b><span>Zout</span></div></div>
<div class="panel"><div class="lbl">Totaal deeg / totaal meel</div><div class="mono" style="font-size:20px"><span id="o-tot"></span> / <span id="o-meel2"></span></div></div>
<div class="panel"><div class="lbl">Terugrekenen vanaf</div><div class="mono" style="font-size:20px">za 12:00</div><div style="font-size:13px;color:#9A5000;margin-top:4px;font-weight:600">Keuken 21 C: bulk +45 min</div></div>
<button class="btn" data-s="2">Genereer tijdlijn</button>
</div>%%TABS%%</div>

<div class="scr"><div class="body">
<h2 class="t">Tijdlijn / landbrood</h2>
<div class="tl done" data-step><span class="tm">06:30</span><span class="nm">Starter voeden</span><span class="st">OK</span></div>
<div class="tl done" data-step><span class="tm">14:00</span><span class="nm">Mengen + zout</span><span class="st">OK</span></div>
<div class="tl done" data-step><span class="tm">15:15</span><span class="nm">Vouwen 2</span><span class="st">OK</span></div>
<div class="tl now" data-step><span class="tm">16:00</span><span class="nm">Vouwen 3</span><span class="st mono" data-sec="760"></span></div>
<div class="tl" data-step><span class="tm">16:45</span><span class="nm">Vouwen 4</span><span class="st">+0:45</span></div>
<div class="tl" data-step><span class="tm">19:30</span><span class="nm">Vormen</span><span class="st">+3:30</span></div>
<div class="tl" data-step><span class="tm">20:00</span><span class="nm">Koelkast</span><span class="st">+4:00</span></div>
<div class="tl" data-step><span class="tm">za 10:00</span><span class="nm">Oven 240 C</span><span class="st">T-2:00</span></div>
<div class="tl" data-step><span class="tm">za 10:45</span><span class="nm">Bakken 40 min</span><span class="st">T-1:15</span></div>
<div class="panel" style="margin-top:8px"><div class="lbl">Bulk: temp vs. tijd (eigen bakken)</div>
<svg class="spark" viewBox="0 0 240 56"><line x1="8" y1="8" x2="232" y2="48" stroke="#D9DCD6"/><g fill="#0F6B4F"><circle cx="40" cy="12" r="3"/><circle cx="96" cy="22" r="3"/><circle cx="150" cy="34" r="3"/><circle cx="200" cy="44" r="3"/></g><circle cx="118" cy="28" r="4" fill="none" stroke="#9A5000" stroke-width="2"/></svg></div>
</div>%%TABS%%</div>

<div class="scr"><div class="body">
<h2 class="t">Logboek / 12 bakken</h2>
<div class="panel"><table class="tbl"><tr><th>Datum</th><th>Hydr</th><th>Start</th><th>Bulk</th><th>Score</th></tr>
<tr><td>31.10</td><td>73%</td><td>20%</td><td>5:15</td><td>4/5</td></tr>
<tr><td>24.10</td><td>78%</td><td>20%</td><td>4:45</td><td>3/5</td></tr>
<tr><td>17.10</td><td>72%</td><td>18%</td><td>5:30</td><td>5/5</td></tr>
<tr><td>10.10</td><td>75%</td><td>20%</td><td>4:30</td><td>3/5</td></tr></table></div>
<div class="panel"><div class="lbl">Score per bak</div>
<svg class="spark" viewBox="0 0 240 56"><g fill="#0F6B4F"><rect x="12" y="24" width="20" height="28"/><rect x="52" y="12" width="20" height="40"/><rect x="92" y="28" width="20" height="24"/><rect x="132" y="8" width="20" height="44"/><rect x="172" y="20" width="20" height="32"/><rect x="212" y="12" width="20" height="40"/></g></svg></div>
<div class="panel"><div class="lbl">Laatste notitie</div><p style="margin-top:4px">Kruim iets dicht. Volgende keer bulk 30 min langer.</p></div>
</div>%%TABS%%</div>
""", tabs_labels=["Vandaag","Formule","Tijdlijn","Log"],
)

# ---------------------------------------------------------------- 4 NACHT
D[4] = dict(
 naam="Nachtbak", sfeer="Donker en zacht voor 5 uur 's ochtends of laat op de avond, met enorme knoppen en cijfers.",
 fonts='<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;800&display=swap" rel="stylesheet">',
 sw=[("Nacht","#12100E"),("Vlak","#1F1915"),("Vlak hoog","#2B231D"),("Tekst","#F4EADD"),("Amber","#F2A541"),("Gedempt","#B3A596")],
 contrast=[("Tekst op nacht","16,0"),("Amber op nacht","9,3"),("Nacht op amber (knop)","9,3"),("Gedempt op nacht","7,9"),("Tekst op vlak","14,6")],
 letters="Manrope 600 en 800, bewust grote groottes: 20 px lopende tekst, 64 px timer. Weinig lettertypes, geen dunne gewichten.",
 waarom="Bij vroeg of laat bakken verblindt een wit scherm. Amber is zacht voor de ogen en doet aan ovenlicht denken. Grote tikvlakken (56 px) werken met meel aan de vingers en een kleine pauze.",
 plus=["Zeer goed bij weinig licht; aangenaam voor de ogen; grote tikdoelen","Eén ding per scherm: de volgende handeling vooraan"],
 min=["Overdag in een zonnige keuken minder goed leesbaar (reflectie)","Foto's van korst en kruim ogen donker in een donker scherm"],
 css="""
.screenbox{background:#12100E;color:#F4EADD;font-family:Manrope,system-ui,sans-serif}
.statusbar{color:#F4EADD}.homebar{background:#F4EADD}
h2.t{font:800 30px/1.1 Manrope;margin:0 0 16px}
.card{background:#1F1915;border-radius:24px;padding:24px;margin-bottom:16px}
.lbl{font-size:14px;font-weight:600;color:#B3A596}
.big{font:800 72px/1 Manrope;color:#F2A541;letter-spacing:-.03em}
.btn{display:flex;align-items:center;justify-content:center;min-height:64px;border-radius:24px;background:#F2A541;color:#12100E;font:800 20px Manrope;border:0;width:100%;cursor:pointer;margin-bottom:16px}
.btn.ghost{background:#2B231D;color:#F4EADD}
.tabbar{background:#1F1915}.tabbar button{color:#B3A596;font:600 14px Manrope}.tabbar button.on{color:#F2A541}
.field{background:#1F1915;border-radius:16px;padding:8px 16px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;min-height:64px}
.field label{font-size:18px;font-weight:600}.field input{width:120px;height:48px;background:#2B231D;border:0;border-radius:12px;color:#F4EADD;font:800 24px Manrope;text-align:right;padding:0 16px}
.res{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:16px 0}.res div{background:#2B231D;border-radius:16px;padding:16px 8px;text-align:center}.res b{display:block;font:800 26px Manrope;color:#F2A541}.res span{font-size:13px;color:#B3A596}
.step{display:flex;gap:16px;align-items:center;min-height:64px;padding:8px 16px;background:#1F1915;border-radius:16px;margin-bottom:8px;cursor:pointer;font-size:18px;font-weight:600}
.step .tm{width:60px;color:#B3A596;font-size:16px}.step.done{opacity:.45}.step.done .nm{text-decoration:line-through}
.step.now{background:#F2A541;color:#12100E}.step.now .tm{color:#12100E}
.photo{width:80px;height:80px;border-radius:16px;background:#4A3426;flex:none}
.log{display:flex;gap:16px;align-items:center}.log h4{font-size:20px}.log p{font-size:15px;color:#B3A596}
.stars{color:#F2A541;font-weight:800;font-size:18px}
""",
 screens="""
<div class="scr on"><div class="body">
<h2 class="t">Goeiemorgen</h2>
<div class="card"><div class="lbl">Nu: vouwen 3 van 4</div><div class="big" data-sec="760"></div><p style="margin-top:8px;color:#B3A596">Landbrood, klaar za 12:00</p></div>
<button class="btn" data-s="2">Open tijdlijn</button>
<div class="card"><div class="lbl">Starter</div><p style="font-size:22px;font-weight:800;margin-top:4px">Op piek, vandaag voeden niet nodig</p></div>
<div class="card"><div class="lbl">Vandaag in de oven</div><p style="font-size:22px;font-weight:800;margin-top:4px">Za 10:45 bakken</p></div>
<button class="btn ghost" data-s="1">Nieuwe bak</button>
</div>%%TABS%%</div>

<div class="scr"><div class="body">
<h2 class="t">Nieuwe bak</h2>
<div class="field"><label>Meel (g)</label><input class="calc" id="f-meel" inputmode="decimal" value="500"></div>
<div class="field"><label>Water (g)</label><input class="calc" id="f-water" inputmode="decimal" value="350"></div>
<div class="field"><label>Starter (g)</label><input class="calc" id="f-starter" inputmode="decimal" value="100"></div>
<div class="field"><label>Starter hydratatie %</label><input class="calc" id="f-sthyd" inputmode="decimal" value="100"></div>
<div class="field"><label>Zout (g)</label><input class="calc" id="f-zout" inputmode="decimal" value="10"></div>
<div class="field"><label>Keuken (graden)</label><input id="f-temp" inputmode="decimal" value="21"></div>
<div class="res"><div><b id="o-hyd"></b><span>Hydratatie</span></div><div><b id="o-st"></b><span>Starter</span></div><div><b id="o-zout"></b><span>Zout</span></div></div>
<div class="card"><div class="lbl">Klaar tegen</div><p style="font-size:26px;font-weight:800">Za 12:00</p><p style="color:#B3A596;margin-top:4px">Keuken 21 graden: bulk 45 min langer</p></div>
<button class="btn" data-s="2">Maak tijdlijn</button>
</div>%%TABS%%</div>

<div class="scr"><div class="body">
<h2 class="t">Tijdlijn</h2>
<div class="step done" data-step><span class="tm">14:00</span><span class="nm">Mengen, zout erbij</span></div>
<div class="step done" data-step><span class="tm">15:15</span><span class="nm">Vouwen 2</span></div>
<div class="step now" data-step><span class="tm">16:00</span><span class="nm">Vouwen 3<br><span style="font:800 40px Manrope" data-sec="760"></span></span></div>
<div class="step" data-step><span class="tm">16:45</span><span class="nm">Vouwen 4</span></div>
<div class="step" data-step><span class="tm">19:30</span><span class="nm">Vormen</span></div>
<div class="step" data-step><span class="tm">20:00</span><span class="nm">Koelkast</span></div>
<div class="step" data-step><span class="tm">10:00</span><span class="nm">Oven aan 240</span></div>
<div class="step" data-step><span class="tm">10:45</span><span class="nm">Bakken</span></div>
</div>%%TABS%%</div>

<div class="scr"><div class="body">
<h2 class="t">Logboek</h2>
<div class="card log"><div class="photo"></div><div><h4>Landbrood</h4><p>31 okt, 73%</p><div class="stars">4 van 5</div><p>Bulk 30 min langer</p></div></div>
<div class="card log"><div class="photo"></div><div><h4>Volkoren 30%</h4><p>24 okt, 78%</p><div class="stars">3 van 5</div><p>Oven 10 graden lager</p></div></div>
<div class="card log"><div class="photo"></div><div><h4>Landbrood</h4><p>17 okt, 72%</p><div class="stars">5 van 5</div><p>Zo houden</p></div></div>
</div>%%TABS%%</div>
""", tabs_labels=["Vandaag","Nieuw","Tijdlijn","Logboek"],
)

# ---------------------------------------------------------------- 5 BAKKERIJ
D[5] = dict(
 naam="Ambachtelijke bakkerij", sfeer="Meelstof, korstkleuren en bakkerslabels: de toonbank van een goede dorpsbakker.",
 fonts='<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,800&family=Work+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">',
 sw=[("Meelstof","#F4EEE4"),("Deeg","#E8DCC6"),("Korst","#8B4A1F"),("Donkere korst","#3F2410"),("Rogge-groen","#4F5D3A"),("Tekst","#2E1E14")],
 contrast=[("Tekst op meelstof","13,9"),("Korst op meelstof","5,9"),("Wit op korst (knop)","6,8"),("Rogge-groen op meelstof","6,1"),("Gedempt (#6B5646) op meelstof","6,0")],
 letters="Fraunces 800 (zachte serif met karakter) voor titels, Work Sans voor de rest. Etiketten met onderbroken rand, zoals een prijskaartje.",
 waarom="Het gevoel van een bakkerij zonder kitsch: korstkleuren als schaal (bleek tot donker) in plaats van sterren, en broden als 'etiketten'. Het resultaat van de bak krijgt een eigen visuele taal.",
 plus=["Korstkleur kiezen is sneller en preciezer dan 'sterren'; voelt bij brood passen","Warm en uniek, maar toch rustig en goed leesbaar"],
 min=["Meer eigen componenten (korstschaal, etiketten) dus meer bouwwerk","Aardetinten kunnen saai worden zonder duidelijke accentkleur"],
 css="""
.screenbox{background:#F4EEE4;color:#2E1E14;font-family:'Work Sans',system-ui,sans-serif}
.statusbar{color:#2E1E14}.homebar{background:#2E1E14}
h2.t{font:800 34px/1.05 Fraunces,serif;margin:0 0 4px;color:#3F2410}
.sub{font-size:14px;color:#6B5646;margin-bottom:16px}
.tag{background:#fff;border:2px dashed #8B4A1F;border-radius:8px;padding:16px;margin-bottom:16px;position:relative}
.tag::before{content:"";position:absolute;top:8px;right:16px;width:12px;height:12px;border-radius:6px;background:#F4EEE4;border:2px solid #8B4A1F}
.lbl{font:700 12px 'Work Sans';text-transform:uppercase;letter-spacing:.1em;color:#8B4A1F}
.big{font:800 52px/1 Fraunces;color:#3F2410}
.btn{display:flex;align-items:center;justify-content:center;min-height:52px;border-radius:8px;background:#8B4A1F;color:#fff;font:700 16px 'Work Sans';border:0;width:100%;cursor:pointer;margin-bottom:8px}
.btn.ghost{background:transparent;color:#8B4A1F;border:2px solid #8B4A1F}
.tabbar{background:#E8DCC6;border-top:2px solid #8B4A1F}.tabbar button{color:#6B5646;font:600 13px 'Work Sans'}.tabbar button.on{color:#3F2410;font-weight:700;box-shadow:inset 0 -3px #8B4A1F}
.field{margin-bottom:8px}.field label{display:block;font:700 12px 'Work Sans';text-transform:uppercase;letter-spacing:.08em;color:#8B4A1F;margin-bottom:4px}
.field input{width:100%;height:48px;border:2px solid #8B4A1F;border-radius:8px;background:#fff;padding:0 16px;font:600 20px 'Work Sans';color:#2E1E14}
.two{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.res{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:8px 0 16px}.res div{background:#E8DCC6;border-radius:8px;padding:12px 8px;text-align:center}.res b{display:block;font:800 26px Fraunces;color:#3F2410}.res span{font-size:12px;color:#6B5646;font-weight:600}
.step{display:flex;gap:16px;align-items:center;min-height:52px;padding:8px 0;border-bottom:2px dotted #C9B796;cursor:pointer}
.step .tm{width:64px;font:700 15px 'Work Sans';color:#8B4A1F}.step .dot{width:24px;height:24px;border-radius:12px;border:2px solid #4F5D3A;flex:none}
.step.done .dot{background:#4F5D3A}.step.done .nm{color:#6B5646;text-decoration:line-through}
.step.now{background:#E8DCC6;border-radius:8px;padding:8px;border:0}
.crust{display:flex;gap:8px;margin:8px 0}.crust i{flex:1;height:44px;border-radius:8px;border:2px solid transparent}
.crust i.sel{border-color:#2E1E14}
.photo{width:72px;height:72px;border-radius:8px;background:#C79A5E;flex:none}
.log{display:flex;gap:16px}.log h4{font:800 19px Fraunces}.log p{font-size:14px;color:#6B5646}
""",
 screens="""
<div class="scr on"><div class="body">
<h2 class="t">Vandaag in de bakkerij</h2><p class="sub">vrijdag 6 november</p>
<div class="tag"><div class="lbl">Op de werkbank</div><h3 style="font:800 22px Fraunces;margin:4px 0">Landbrood</h3><p style="font-size:14px;color:#6B5646">Vouwen 3 van 4</p><div class="big" data-sec="760" style="margin:8px 0"></div><button class="btn" data-s="2">Tijdlijn openen</button></div>
<div class="tag"><div class="lbl">Desem</div><p style="font-size:17px;margin-top:4px"><b>Oma-starter</b> is op piek. Gevoed om 06:30.</p></div>
<div class="tag"><div class="lbl">In de oven</div><p style="font-size:17px;margin-top:4px">Za <b>10:00</b> aan, <b>10:45</b> bakken, <b>12:00</b> klaar.</p></div>
<button class="btn ghost" data-s="1">Nieuwe bak</button>
</div>%%TABS%%</div>

<div class="scr"><div class="body">
<h2 class="t">Nieuwe bak</h2><p class="sub">Landbrood, 1 brood</p>
<div class="two">
<div class="field"><label>Meel (g)</label><input class="calc" id="f-meel" inputmode="decimal" value="500"></div>
<div class="field"><label>Water (g)</label><input class="calc" id="f-water" inputmode="decimal" value="350"></div>
<div class="field"><label>Desem (g)</label><input class="calc" id="f-starter" inputmode="decimal" value="100"></div>
<div class="field"><label>Desem hydr. %</label><input class="calc" id="f-sthyd" inputmode="decimal" value="100"></div>
<div class="field"><label>Zout (g)</label><input class="calc" id="f-zout" inputmode="decimal" value="10"></div>
<div class="field"><label>Keuken (graden)</label><input id="f-temp" inputmode="decimal" value="21"></div></div>
<div class="res"><div><b id="o-hyd"></b><span>Hydratatie</span></div><div><b id="o-st"></b><span>Desem</span></div><div><b id="o-zout"></b><span>Zout</span></div></div>
<div class="tag"><div class="lbl">Klaar tegen</div><p style="font:800 24px Fraunces">Zaterdag 12:00</p><p style="font-size:14px;color:#6B5646">Keuken 21 graden: bulk 45 min langer.</p></div>
<button class="btn" data-s="2">Plan maken</button>
</div>%%TABS%%</div>

<div class="scr"><div class="body">
<h2 class="t">Bakplan</h2><p class="sub">Landbrood, klaar za 12:00</p>
<div class="step done" data-step><span class="tm">14:00</span><span class="dot"></span><span class="nm">Mengen, zout erbij</span></div>
<div class="step done" data-step><span class="tm">15:15</span><span class="dot"></span><span class="nm">Vouwen 2</span></div>
<div class="step now" data-step><span class="tm">16:00</span><span class="dot"></span><span class="nm"><b>Vouwen 3</b><br><span class="big" style="font-size:34px" data-sec="760"></span></span></div>
<div class="step" data-step><span class="tm">16:45</span><span class="dot"></span><span class="nm">Vouwen 4</span></div>
<div class="step" data-step><span class="tm">19:30</span><span class="dot"></span><span class="nm">Vormen</span></div>
<div class="step" data-step><span class="tm">20:00</span><span class="dot"></span><span class="nm">Koelkast, koude rijs</span></div>
<div class="step" data-step><span class="tm">za 10:00</span><span class="dot"></span><span class="nm">Oven aan, 240 graden</span></div>
<div class="step" data-step><span class="tm">za 10:45</span><span class="dot"></span><span class="nm">Bakken, 40 min</span></div>
<p class="lbl" style="margin-top:16px">Na het bakken: korstkleur</p>
<div class="crust" data-pick="one"><i style="background:#E3B97E"></i><i style="background:#C98A45"></i><i class="sel" style="background:#9A5B25"></i><i style="background:#6A3A17"></i><i style="background:#3F2410"></i></div>
</div>%%TABS%%</div>

<div class="scr"><div class="body">
<h2 class="t">Mijn broden</h2><p class="sub">12 bakken</p>
<div class="tag log"><div class="photo"></div><div><h4>Landbrood</h4><p>31 okt, 73%, desem 20%</p><div class="crust" style="width:160px;margin:4px 0"><i style="background:#9A5B25;height:16px"></i></div><p>Volgende keer: bulk 30 min langer.</p></div></div>
<div class="tag log"><div class="photo" style="background:#7A4A22"></div><div><h4>Volkoren 30%</h4><p>24 okt, 78%, desem 20%</p><div class="crust" style="width:160px;margin:4px 0"><i style="background:#3F2410;height:16px"></i></div><p>Te donker: oven 10 graden lager.</p></div></div>
<div class="tag log"><div class="photo"></div><div><h4>Landbrood</h4><p>17 okt, 72%, desem 18%</p><div class="crust" style="width:160px;margin:4px 0"><i style="background:#C98A45;height:16px"></i></div><p>Zo houden.</p></div></div>
</div>%%TABS%%</div>
""", tabs_labels=["Vandaag","Nieuw","Bakplan","Broden"],
)

# ---------------------------------------------------------------- 6 HAVER EN SALIE (uit de ChatGPT-briefing)
D[6] = dict(
 naam="Haver en salie", sfeer="Rustig en ambachtelijk met echte foto's van haar broden en starter: crème, haver, salie en aarde, naar de projectbriefing.",
 fonts='<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">',
 sw=[("Crème","#F5F0E7"),("Haver","#E8DDCC"),("Salie (vlak)","#A7AD91"),("Aarde (vlak)","#A96F50"),("Donker","#302E29"),("Aarde donker (tekst/knop)","#8A5236"),("Salie donker (tekst)","#566043"),("Gedempt","#625C54")],
 contrast=[("Donker op crème","11,9"),("Aarde donker #8A5236 op crème","5,5"),("Wit op aarde donker (knop)","6,3"),("Aarde donker op haver","4,7"),("Salie donker op crème","5,9"),("Gedempt op crème","5,8"),("Briefingkleuren zelf: aarde #A96F50 op crème 3,6 en wit op aarde 4,1 (te laag voor kleine tekst), salie op crème 2,0 (enkel vlak). Daarom twee donkere varianten toegevoegd.","")],
 letters="DM Serif Display voor titels (zacht, kookboekachtig), DM Sans voor de rest. Echte foto's als hoofdrolspeler; hier getoond als tonale vlakken met het label FOTO.",
 waarom="Dit is het palet uit de briefing (van ChatGPT), bijgesteld voor leesbaarheid. De foto's van haar eigen broden en starter maken de app persoonlijk. Vijf tabs, zoals de briefing vraagt, en een bakmodus die vraagt of het deeg echt klaar is.",
 plus=["Foto's centraal: logboek en starter voelen als haar eigen kookboek","Bakmodus met controlepunten ('is het volume +30%?') past bij de eerlijke schatting van fermentatie"],
 min=["Vraagt goede foto's; zonder foto's ogen de schermen leeg","Meer schermen (starter erbij) dus meer bouwwerk dan richting 5"],
 css="""
.screenbox{background:#F5F0E7;color:#302E29;font-family:'DM Sans',system-ui,sans-serif}
.statusbar{color:#302E29}.homebar{background:#302E29}
h2.t{font:400 32px/1.1 'DM Serif Display',serif;margin:0 0 16px}
.card{background:#E8DDCC;border-radius:16px;padding:16px;margin-bottom:16px}
.card.w{background:#FBF8F2}
.lbl{font:700 12px 'DM Sans';text-transform:uppercase;letter-spacing:.08em;color:#566043}
.big{font:400 56px/1 'DM Serif Display',serif}
.btn{display:flex;align-items:center;justify-content:center;min-height:52px;border-radius:12px;background:#8A5236;color:#fff;font:700 16px 'DM Sans';border:0;width:100%;cursor:pointer;margin-bottom:8px}
.btn.ghost{background:transparent;color:#8A5236;border:2px solid #8A5236}
.btn.sage{background:#566043}
.tabbar{background:#FBF8F2;border-top:1px solid #E8DDCC;padding:8px 4px 24px}.tabbar button{color:#625C54;font:600 11px 'DM Sans'}.tabbar button.on{color:#8A5236;font-weight:700}
.photo{border-radius:12px;background:#A7AD91;display:flex;align-items:center;justify-content:center;font:700 12px 'DM Sans';color:#302E29;letter-spacing:.1em}
.photo.a{background:#A96F50;color:#fff}
.field{margin-bottom:8px}.field label{display:block;font:700 12px 'DM Sans';text-transform:uppercase;letter-spacing:.06em;color:#566043;margin-bottom:4px}
.field input{width:100%;height:48px;border:1px solid #C9BBA3;border-radius:12px;background:#FBF8F2;padding:0 16px;font:600 20px 'DM Sans';color:#302E29}
.two{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.res{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:8px 0 16px}.res div{background:#E8DDCC;border-radius:12px;padding:12px 8px;text-align:center}.res b{display:block;font:400 26px 'DM Serif Display'}.res span{font-size:12px;color:#625C54;font-weight:600}
.step{display:flex;gap:16px;align-items:center;min-height:52px;padding:8px 0;border-bottom:1px solid #E8DDCC;cursor:pointer}
.step .tm{width:64px;font:700 14px 'DM Sans';color:#8A5236}.step .dot{width:24px;height:24px;border-radius:12px;border:2px solid #566043;flex:none}
.step.done .dot{background:#566043}.step.done .nm{color:#625C54;text-decoration:line-through}
.step.now{background:#E8DDCC;border-radius:12px;padding:8px;border:0}
.row{display:flex;gap:16px;align-items:center}
.log p{font-size:14px;color:#625C54}.log h4{font:400 20px 'DM Serif Display'}
.msg{font-size:14px;color:#566043;font-weight:700;margin-top:8px;min-height:20px}
""",
 screens="""
<div class="scr on"><div class="body">
<p class="lbl">Goeiemorgen, vrijdag 6 november</p><h2 class="t">Vandaag</h2>
<div class="card"><div class="row"><div class="photo" style="width:72px;height:72px;flex:none">FOTO</div><div><p class="lbl">Starter</p><h3 style="font:400 22px 'DM Serif Display'">Oma-starter</h3><p style="font-size:14px;color:#625C54">Op piek, gevoed om 06:30</p></div></div></div>
<div class="card w"><p class="lbl">Volgende actie</p><h3 style="font:400 24px 'DM Serif Display';margin:4px 0">Vouwen 3 van 4</h3><div class="big" data-sec="760" style="margin:8px 0"></div><button class="btn" data-s="3">Open bakmodus</button></div>
<div class="card"><p class="lbl">Vandaag in de oven</p><p style="margin-top:4px">Za <b>10:00</b> aan, <b>10:45</b> bakken, <b>12:00</b> klaar.</p></div>
<div class="card w"><p class="lbl">Vorige keer</p><p style="margin-top:4px">Kruim iets dicht: bulk 30 min langer.</p></div>
</div>%%TABS%%</div>

<div class="scr"><div class="body">
<h2 class="t">Starter</h2>
<div class="photo" style="height:140px;margin-bottom:16px">FOTO VAN DE POT</div>
<div class="card"><h3 style="font:400 22px 'DM Serif Display'">Oma-starter</h3><p style="font-size:14px;color:#625C54">Roggemeel 20%, tarwe 80%, hydratatie 100%, bewaard op 21 graden</p><button class="btn" style="margin-top:16px">Voeding noteren</button></div>
<div class="card w"><p class="lbl">Rijs na laatste voeding (voorbeeldgegevens)</p>
<svg viewBox="0 0 240 64" style="width:100%;height:64px"><g fill="#566043"><rect x="8" y="48" width="20" height="12"/><rect x="40" y="40" width="20" height="20"/><rect x="72" y="28" width="20" height="32"/><rect x="104" y="14" width="20" height="46"/><rect x="136" y="8" width="20" height="52"/><rect x="168" y="18" width="20" height="42"/><rect x="200" y="32" width="20" height="28"/></g></svg>
<p style="font-size:13px;color:#625C54">Piek na ongeveer 4 tot 5 uur (schatting op basis van eigen metingen).</p></div>
<div class="card w"><p class="lbl">Voedingslog</p>
<p style="margin-top:8px;font-size:15px"><b>vr 06:30</b> 1:5:5 (20 / 100 / 100 g), 22 C</p>
<p style="margin-top:8px;font-size:15px"><b>do 06:30</b> 1:5:5, 21 C</p></div>
</div>%%TABS%%</div>

<div class="scr"><div class="body">
<h2 class="t">Nieuwe bak</h2>
<div class="two">
<div class="field"><label>Meel (g)</label><input class="calc" id="f-meel" inputmode="decimal" value="500"></div>
<div class="field"><label>Water (g)</label><input class="calc" id="f-water" inputmode="decimal" value="350"></div>
<div class="field"><label>Starter (g)</label><input class="calc" id="f-starter" inputmode="decimal" value="100"></div>
<div class="field"><label>Starter hydr. %</label><input class="calc" id="f-sthyd" inputmode="decimal" value="100"></div>
<div class="field"><label>Zout (g)</label><input class="calc" id="f-zout" inputmode="decimal" value="10"></div>
<div class="field"><label>Keuken (graden)</label><input id="f-temp" inputmode="decimal" value="21"></div></div>
<div class="res"><div><b id="o-hyd"></b><span>Hydratatie</span></div><div><b id="o-st"></b><span>Starter</span></div><div><b id="o-zout"></b><span>Zout</span></div></div>
<p style="font-size:13px;color:#625C54;margin:-8px 0 16px">Totaal deeg <b id="o-tot"></b>, totaal meel <b id="o-meel2"></b>. Alles op het totale meel gerekend.</p>
<div class="card"><p class="lbl">Klaar tegen</p><p style="font:400 26px 'DM Serif Display'">Zaterdag 12:00</p><p style="font-size:14px;color:#625C54;margin-top:4px">Keuken 21 graden: bulk 45 min langer. Schatting, bevestig het deeg zelf.</p></div>
<button class="btn" data-s="3">Plan deze bak</button>
</div>%%TABS%%</div>

<div class="scr"><div class="body">
<h2 class="t">Bakmodus</h2>
<div class="card w" style="text-align:center;padding:24px 16px"><p class="lbl">Nu</p><h3 style="font:400 30px 'DM Serif Display';margin:4px 0">Vouwen 3 van 4</h3><div class="big" data-sec="760"></div></div>
<div class="card"><p class="lbl">Controle: is het deeg klaar?</p><p style="font-size:15px;margin:4px 0 16px">Volume +30%? Bellen aan de rand? Deeg gespannen?</p>
<button class="btn sage" onclick="document.getElementById('m6').textContent='Genoteerd. Planning blijft staan.'">Ja, volgende stap</button>
<button class="btn ghost" data-bump="1800" onclick="document.getElementById('m6').textContent='Nog niet: planning schuift 30 min op.'">Nog niet, +30 min</button><p class="msg" id="m6"></p></div>
<div class="step done" data-step><span class="tm">15:15</span><span class="dot"></span><span class="nm">Vouwen 2</span></div>
<div class="step now" data-step><span class="tm">16:00</span><span class="dot"></span><span class="nm"><b>Vouwen 3</b></span></div>
<div class="step" data-step><span class="tm">16:45</span><span class="dot"></span><span class="nm">Vouwen 4</span></div>
<div class="step" data-step><span class="tm">19:30</span><span class="dot"></span><span class="nm">Vormen, koelkast</span></div>
<div class="step" data-step><span class="tm">za 10:45</span><span class="dot"></span><span class="nm">Bakken, 40 min</span></div>
</div>%%TABS%%</div>

<div class="scr"><div class="body">
<h2 class="t">Mijn broden</h2>
<div class="card w log"><div class="photo a" style="height:120px;margin-bottom:8px">FOTO KRUIM</div><h4>Landbrood</h4><p>31 okt, hydratatie 73%, 4 van 5</p><p>Volgende keer: bulk 30 min langer.</p></div>
<div class="card w log"><div class="photo" style="height:120px;margin-bottom:8px">FOTO KRUIM</div><h4>Volkoren 30%</h4><p>24 okt, hydratatie 78%, 3 van 5</p><p>Oven 10 graden lager.</p></div>
<button class="btn ghost">Vergelijk twee broden</button>
</div>%%TABS%%</div>
""", tabs_labels=["Vandaag","Starter","Nieuwe bak","Bakmodus","Broden"],
)

# ---------------------------------------------------------------- 7 en 8: SCANDI, op basis van de antwoorden van zus
SCANDI_CSS = """
.screenbox{background:var(--bg);color:var(--ink);font-family:Figtree,system-ui,sans-serif}
.statusbar{color:var(--ink)}.homebar{background:var(--ink)}
h2.t{font:400 30px/1.1 'Young Serif',serif;margin:0 0 4px;color:var(--grn)}
.folio{font:700 11px Figtree;text-transform:uppercase;letter-spacing:.12em;color:var(--mut);margin-bottom:4px}
.sub{font-size:14px;color:var(--mut);margin-bottom:16px}
.card{background:var(--card);border-radius:20px;padding:16px;margin-bottom:12px;border:1px solid var(--line)}
.card.b{background:var(--blush);border-color:var(--blush)}
.card.p{background:var(--bor);border-color:var(--bor);color:#F6F0E6}
.card.p .folio,.card.p .sub{color:#EBD2C4}
.arch{background:var(--blush);border-radius:999px 999px 20px 20px;padding:40px 24px 20px;text-align:center;margin-bottom:12px;position:relative;overflow:hidden}
.arch h3{font:400 30px 'Young Serif',serif;color:var(--grn)}
.arch .bub{position:absolute;border-radius:50%;background:var(--card);opacity:.7}
.btn{display:flex;align-items:center;justify-content:center;min-height:52px;border-radius:999px;background:var(--ter);color:var(--btxt);font:700 16px Figtree;border:0;width:100%;cursor:pointer;margin-bottom:8px}
.btn.g{background:var(--grn);color:var(--bg)}.btn.o{background:transparent;color:var(--ink);border:1.5px solid var(--ink)}
.chip{display:inline-flex;align-items:center;min-height:44px;padding:0 16px;border-radius:999px;border:1.5px solid var(--line);background:var(--card);font:600 14px Figtree;margin:0 8px 8px 0;cursor:pointer}
.chip.on{background:var(--grn);color:var(--bg);border-color:var(--grn)}
.tabbar{background:var(--card);border-top:1px solid var(--line);padding:8px 4px 24px}.tabbar button{color:var(--mut);font:700 12px Figtree}.tabbar button.on{color:var(--ter)}.tabbar button.on::before{content:"";display:block;width:24px;height:4px;border-radius:2px;background:var(--bor);margin:0 auto 4px}
.dots{display:flex;gap:8px;margin:8px 0}.dots i{flex:1;height:8px;border-radius:4px;background:var(--line)}.dots i.f{background:var(--grn)}
.lbl{font:700 11px Figtree;text-transform:uppercase;letter-spacing:.1em;color:var(--mut)}
.field{margin-bottom:8px}.field label{display:block;font:700 12px Figtree;color:var(--mut);margin-bottom:4px}
.field input{width:100%;height:48px;border:1.5px solid var(--line);border-radius:14px;background:var(--card);padding:0 16px;font:700 18px Figtree;color:var(--ink)}
.two{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.res{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:8px 0 12px}.res div{background:var(--blush);border-radius:16px;padding:12px 4px;text-align:center;color:var(--ink)}.res b{display:block;font:400 24px 'Young Serif';color:var(--grn)}.res span{font-size:12px;font-weight:700}
.st{display:grid;grid-template-columns:56px 1fr auto;gap:8px;align-items:center;min-height:56px;border-bottom:1px solid var(--line);padding:4px 0}
.st .tm{font:700 15px Figtree;color:var(--ter)}.st small{display:block;font-size:12px;color:var(--mut)}
.st .nm{font-weight:700}.st.wait .nm{font-weight:500;color:var(--mut)}
.bell{width:44px;height:44px;border-radius:22px;border:1.5px solid var(--line);background:var(--card);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--mut)}
.bell.on{background:var(--bor);border-color:var(--bor);color:#F6F0E6}
.day{display:flex;height:24px;border-radius:12px;overflow:hidden;margin:8px 0;background:var(--line)}.day i{display:block;height:100%}
.hours{display:flex;justify-content:space-between;font-size:11px;color:var(--mut)}
.seg{display:flex;background:var(--line);border-radius:999px;padding:4px;margin-bottom:12px}.seg button{flex:1;min-height:44px;border:0;border-radius:999px;background:transparent;font:700 14px Figtree;color:var(--ink);cursor:pointer}.seg button.on{background:var(--card)}
.swt{display:flex;justify-content:space-between;align-items:center;gap:16px;min-height:56px;border-bottom:1px solid var(--line);padding:8px 0}.swt p{font-size:14px;color:var(--mut)}
.tg{width:52px;height:32px;border-radius:16px;background:var(--line);position:relative;flex:none;cursor:pointer;border:0}.tg::after{content:"";position:absolute;top:4px;left:4px;width:24px;height:24px;border-radius:12px;background:var(--card);transition:left .15s}.tg.on{background:var(--grn)}.tg.on::after{left:24px}
.crust{display:flex;gap:8px;margin:8px 0}.crust i{flex:1;height:44px;border-radius:12px;border:2px solid transparent}.crust i.sel{border-color:var(--ink)}
.tagx{display:inline-block;background:var(--blush);color:var(--ink);border-radius:999px;padding:2px 12px;font:700 11px Figtree;letter-spacing:.06em}
.note2{font-size:12px;color:var(--mut);margin-top:4px}
"""

def scandi_screens():
    bell = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 17h12l-1.5-2V10a4.5 4.5 0 0 0-9 0v5z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>'
    def st(tm, nm, sub, on, wait=False):
        return '<div class="st%s"><span class="tm">%s</span><span><span class="nm">%s</span><small>%s</small></span><button class="bell%s" onclick="this.classList.toggle(\'on\')" aria-label="wekker">%s</button></div>' % (" wait" if wait else "", tm, nm, sub, " on" if on else "", bell)
    steps = "".join([
        st("17:30","Mengen","15 min handwerk",True),
        st("18:00","Zout erbij en vouwen 1","5 min",True),
        st("18:45","Vouwen 2","5 min",True),
        st("19:30","Vouwen 3","5 min",False),
        st("20:15","Vouwen 4","5 min",False),
        st("20:20","Bulk","wacht tot ongeveer 22:30",False,True),
        st("22:30","Vormen","10 min",True),
        st("23:00","Koelkast","koude rijs, wacht 12 uur",False,True),
        st("za 10:45","Oven aan, 240 graden","5 min",True),
        st("za 11:30","Bakken","45 min",True),
        st("za 13:00","Klaar","afkoelen, dan aansnijden",False,True)])
    return """
<div class="scr on"><div class="body">
<p class="folio">Dag 17 · maandag 2 november</p><h2 class="t">Dag 17 met Jean</h2><p class="sub">Je starter is aan het aansterken.</p>
<div class="arch"><span class="bub" style="width:18px;height:18px;left:14%;top:30px"></span><span class="bub" style="width:10px;height:10px;left:84%;top:26px"></span><span class="bub" style="width:14px;height:14px;left:90%;top:62px"></span>
<p class="lbl">Klaar om te bakken?</p><h3>Nog niet helemaal</h3><div class="dots"><i class="f"></i><i class="f"></i><i></i></div><p class="sub" style="margin:0">2 van 3 dagen op rij verdubbeld binnen 6 uur. Nog 1 dag.</p></div>
<div class="card"><p class="lbl">Volgende</p><p style="font:400 22px 'Young Serif';margin:4px 0 12px">Vanavond 18:00 voeden</p><button class="btn">Jean is gevoed</button><p class="note2">Eén tik. Zelfde verhouding als altijd (1:5:5).</p></div>
<div class="card b"><p class="lbl">Eerste brood</p><p style="margin-top:4px">Meestal pas na 2 tot 4 weken écht stabiel. Op zijn vroegst rond <b>zaterdag 7 november</b>, maar jij ziet het aan Jean. Dit is een schatting.</p></div>
</div>%%TABS%%</div>

<div class="scr"><div class="body">
<p class="folio">Starter</p><h2 class="t">Jean</h2><p class="sub">Gestart op 16 oktober, dag 17.</p>
<div class="two"><button class="btn">Gevoed</button><button class="btn g">Piek bereikt</button></div>
<div class="card"><p class="lbl">Uren tot verdubbeling</p>
<svg viewBox="0 0 260 120" style="width:100%;height:120px;margin-top:8px">
<line x1="12" y1="72" x2="252" y2="72" stroke="var(--warn)" stroke-width="1.5" stroke-dasharray="4 4"/>
<text x="14" y="66" text-anchor="start" font-size="10" fill="var(--warn)" font-family="Figtree" font-weight="700">doel: onder 6 uur</text>
<polyline fill="none" stroke="var(--grn)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="16,22 56,32 96,48 136,58 176,66 216,74 244,80"/>
<g fill="var(--grn)"><circle cx="16" cy="22" r="4"/><circle cx="56" cy="32" r="4"/><circle cx="96" cy="48" r="4"/><circle cx="136" cy="58" r="4"/><circle cx="176" cy="66" r="4"/><circle cx="216" cy="74" r="4"/><circle cx="244" cy="80" r="4"/></g>
<text x="16" y="112" font-size="10" fill="var(--mut)" font-family="Figtree">dag 10</text><text x="244" y="112" text-anchor="end" font-size="10" fill="var(--mut)" font-family="Figtree">dag 17</text></svg>
<p class="note2">Voorbeeldgegevens. Korter = sterker. De grafiek verschijnt pas na 3 metingen.</p></div>
<div class="card"><p class="lbl">Laatste voedingen</p>
<div class="st" style="grid-template-columns:90px 1fr"><span class="tm">vandaag</span><span class="nm">1:5:5 · piek na 5 u 30</span></div>
<div class="st" style="grid-template-columns:90px 1fr;border:0"><span class="tm">gisteren</span><span class="nm">1:5:5 · piek na 5 u 45</span></div></div>
</div>%%TABS%%</div>

<div class="scr"><div class="body">
<p class="folio">Mijn recepten</p><h2 class="t">Recepten</h2><p class="sub">Gewoon je eigen recept intikken, op de gram.</p>
<div class="card"><span class="tagx">Eigen recept</span><h3 style="font:400 22px 'Young Serif';margin:8px 0 4px;color:var(--grn)">Klassieke bâtard</h3><p class="sub" style="margin-bottom:12px">Uit Kometen Brood (voorbeeldcijfers)</p>
<div class="two"><div class="field"><label>Meel (g)</label><input class="calc" id="f-meel" inputmode="decimal" value="500"></div><div class="field"><label>Water (g)</label><input class="calc" id="f-water" inputmode="decimal" value="350"></div>
<div class="field"><label>Starter (g)</label><input class="calc" id="f-starter" inputmode="decimal" value="100"></div><div class="field"><label>Zout (g)</label><input class="calc" id="f-zout" inputmode="decimal" value="10"></div></div>
<input type="hidden" class="calc" id="f-sthyd" value="100">
<div class="res"><div><b id="o-hyd"></b><span>Hydratatie</span></div><div><b id="o-st"></b><span>Starter</span></div><div><b id="o-zout"></b><span>Zout</span></div></div>
<button class="btn" data-s="3">Plan deze bak</button></div>
<button class="btn o">Recept toevoegen</button><p class="note2" style="text-align:center">Intikken of een foto van de bladzijde nemen.</p>
</div>%%TABS%%</div>

<div class="scr"><div class="body">
<p class="folio">Bak plannen</p><h2 class="t">Klassieke bâtard</h2>
<p class="sub">Klaar tegen zaterdag 13:00 · keuken 21 graden</p>
<p class="lbl">Ik ben thuis</p>
<div class="day"><i style="width:30%;background:var(--line)"></i><i style="width:3%;background:var(--ter)"></i><i style="width:36%;background:var(--line)"></i><i style="width:31%;background:var(--grn)"></i></div>
<div class="hours"><span>6u</span><span>12u</span><span>18u</span><span>24u</span></div>
<p class="note2" style="margin-bottom:12px">Vrijdag: thuis vanaf 17:30. Alle handwerk valt op een moment dat je er bent.</p>
<div class="card" style="padding:4px 16px">%%STEPS%%</div>
<p class="note2" style="margin-bottom:12px">De bel zet een wekker voor die stap. Binnen een schatting van een paar minuten.</p>
<button class="btn o" data-s="5">Ik ben weg en kan niet kneden</button>
</div>%%TABS%%</div>

<div class="scr"><div class="body">
<p class="folio">Mijn broden</p><h2 class="t">Broden</h2><p class="sub">Na het snijden: 3 tikken en klaar.</p>
<div class="card"><p class="lbl">Korstkleur</p><div class="crust" data-pick="one"><i style="background:#E3B97E"></i><i style="background:#C98A45"></i><i class="sel" style="background:#9A5B25"></i><i style="background:#6A3A17"></i></div>
<p class="lbl" style="margin-top:8px">Kruim</p><div><span class="chip">Dicht</span><span class="chip on">Gelijkmatig</span><span class="chip">Open</span></div>
<p class="lbl">Volgende keer</p><div class="field" style="margin:4px 0 0"><input value="Bulk 30 min langer"></div></div>
<div class="card b"><span class="tagx">Voorbeeld</span><h3 style="font:400 20px 'Young Serif';margin:8px 0 4px;color:var(--grn)">Klassieke bâtard</h3><p class="sub" style="margin:0">za 7 nov · hydratatie 73% · gelijkmatig kruim</p><p style="margin-top:8px">Volgende keer: bulk 30 min langer.</p></div>
<p class="note2">Grafieken (bijvoorbeeld bulk-duur tegenover temperatuur) komen pas na 5 broden, als ze iets vertellen.</p>
</div>%%TABS%%</div>

<div class="scr"><div class="body">
<p class="folio">Ik ben weg</p><h2 class="t">Even niet thuis</h2><p class="sub">Dan past de planning zich aan.</p>
<div class="seg"><button onclick="this.parentNode.children[0].classList.add('on');this.parentNode.children[1].classList.remove('on');document.getElementById('w1').style.display='block';document.getElementById('w2').style.display='none'" class="on">Een paar uur</button><button onclick="this.parentNode.children[1].classList.add('on');this.parentNode.children[0].classList.remove('on');document.getElementById('w2').style.display='block';document.getElementById('w1').style.display='none'">Meerdere dagen</button></div>
<div id="w1"><div class="card b"><p class="lbl">Jij zegt</p><p style="margin:4px 0">Vrijdag ben ik pas om 20:00 thuis.</p><p class="lbl" style="margin-top:12px">De app stelt voor</p><p style="margin-top:4px"><b>Mengen schuift naar 20:00.</b> Alle stappen daarna schuiven mee: bakken zaterdag 14:30 in plaats van 11:30, klaar om 16:00.</p></div>
<button class="btn">Pas planning aan</button><button class="btn o">Een andere dag kiezen</button><p class="note2">Rijstijd hangt van de temperatuur af. Jij beslist of het deeg klaar is.</p></div>
<div id="w2" style="display:none"><p class="lbl">Weg van</p><div><span class="chip on">vr 20 nov</span><span class="chip on">tot zo 29 nov</span></div>
<div class="card" style="padding:4px 16px">
<div class="swt"><div><b>Jean naar de koelkast</b><p>Voed hem vlak voor je vertrekt en zet hem na de eerste rijs in de koelkast. Bronnen: 2 tot 3 weken bewaren kan, richtlijn.</p></div><button class="tg on" onclick="this.classList.toggle('on')"></button></div>
<div class="swt"><div><b>Geen voedingsmeldingen</b><p>Tot zondag 29 november.</p></div><button class="tg on" onclick="this.classList.toggle('on')"></button></div>
<div class="swt" style="border:0"><div><b>Bak na terugkeer plannen</b><p>Voed Jean de ochtend dat je thuiskomt, bak een dag later.</p></div><button class="tg" onclick="this.classList.toggle('on')"></button></div></div>
<p class="note2" style="margin-bottom:12px">Je bak van zaterdag 21 november vervalt. Eerste mogelijke datum: dinsdag 1 december.</p>
<button class="btn">Bewaar</button></div>
</div>%%TABS%%</div>
""".replace("%%STEPS%%", steps)

def scandi(nr, naam, sfeer, vars_, sw, contrast, plus, minus, waarom):
    css = ".screenbox{" + ";".join("--%s:%s" % kv for kv in vars_.items()) + "}" + SCANDI_CSS
    return dict(naam=naam, sfeer=sfeer,
      fonts='<link href="https://fonts.googleapis.com/css2?family=Young+Serif&family=Figtree:wght@400;500;600;700&display=swap" rel="stylesheet">',
      sw=sw, contrast=contrast,
      letters="Young Serif voor titels (zacht, een beetje speels), Figtree voor de rest. Veel witruimte, ronde vormen, een boog als vaste vorm.",
      waarom=waarom, plus=plus, min=minus, css=css, screens=scandi_screens(),
      tabs_labels=["Vandaag","Jean","Recepten","Plan","Broden","Weg"], tab_labels=["Vandaag","Jean","Recepten","Plan","Broden"])

D[7] = scandi(7, "Scandi terracotta", "Rustig en licht met warme tinten: kalkwit, terracotta, donkergroen, en bordeaux als kleine punch. Een boog als speelse vorm.",
  dict(bg="#F6F0E6",card="#FCF9F4",ink="#2A2522",mut="#6A5F57",ter="#B04E33",grn="#2F4A3E",bor="#6B2737",warn="#6B2737",blush="#EBD2C4",line="#E3D8C8",btxt="#FFFFFF"),
  [("Kalkwit","#F6F0E6"),("Terracotta","#B04E33"),("Donkergroen","#2F4A3E"),("Bordeaux (punch)","#6B2737"),("Blush","#EBD2C4"),("Inkt","#2A2522")],
  [("Inkt op kalkwit","13,4"),("Gedempt op kalkwit","5,5"),("Terracotta op kalkwit","4,7"),("Wit op terracotta (knop)","5,3"),("Donkergroen op kalkwit","8,5"),("Bordeaux op kalkwit","9,4"),("Terracotta op blush: 3,7, daarom daar nooit voor kleine tekst; groen op blush 6,7","")],
  ["Rustig en toch levendig door de boog, de ronde knoppen en de bordeaux-accenten","Eén kleur per taak: terracotta = actie, groen = structuur, bordeaux = let op of nu"],
  ["Lichte look: minder zacht om 5 uur 's ochtends dan een donkere","Terracotta haalt 4,7: enkel voor tekst vanaf ongeveer 14 px vet"],
  "Gebaseerd op de antwoorden van je zus: simpel Scandinavisch, warme mediterrane tinten, rustig met een kleine punch, en speelser dan de Recepten-look. Stora Bageriet kon ik niet terugvinden qua uiterlijk (zie rapport), dus dit is mijn interpretatie van 'Scandinavische bakkerij'.")
D[8] = scandi(8, "Scandi donkergroen", "Dezelfde vormen in donkergroen: diepe achtergrond, kalkwit, terracotta en een bordeaux vlak als punch.",
  dict(bg="#23382F",card="#2E4A3E",ink="#F6F0E6",mut="#B9C4B8",ter="#E58A66",grn="#F6F0E6",bor="#7A2E40",warn="#F0A98C",blush="#38574A",line="#3F5E50",btxt="#23382F"),
  [("Donkergroen","#23382F"),("Vlak","#2E4A3E"),("Kalkwit (tekst)","#F6F0E6"),("Terracotta licht","#E58A66"),("Bordeaux (punch)","#7A2E40"),("Gedempt","#B9C4B8")],
  [("Kalkwit op donkergroen","11,0"),("Gedempt op donkergroen","6,9"),("Terracotta op donkergroen","4,9"),("Donkergroen op terracotta (knop)","4,9"),("Kalkwit op bordeaux","8,1"),("Kalkwit op vlak","8,6"),("Gedempt op vlak","5,4")],
  ["Zacht voor de ogen bij vroeg of laat bakken, en nog steeds warm en Scandinavisch","Het groen is een eigen kleur, geen 'donkere modus' van een lichte look"],
  ["Foto's van brood zijn in een donker scherm moeilijker te beoordelen","Overdag in een zonnige keuken minder goed leesbaar"],
  "Voor wie 's avonds of 's ochtends vroeg met het deeg bezig is. Zelfde schermen als richting 7, alleen met andere kleuren: je zus mag kiezen welke sfeer ze het fijnst vindt.")

# ---------------------------------------------------------------- 9: AGENDA-PROEF (veel eenvoudiger)
_d9 = scandi(9, "Agenda-proef", "Veel eenvoudiger: je geeft je recept en een dag, Crumbly zet het bakplan in de agenda van je iPhone. Geen vragen, geen dagelijks bijhouden.",
  dict(bg="#F6F0E6",card="#FCF9F4",ink="#2A2522",mut="#6A5F57",ter="#B04E33",grn="#2F4A3E",bor="#6B2737",warn="#6B2737",blush="#EBD2C4",line="#E3D8C8",btxt="#FFFFFF"),
  [("Kalkwit","#F6F0E6"),("Terracotta","#B04E33"),("Donkergroen","#2F4A3E"),("Bordeaux","#6B2737"),("Blush","#EBD2C4")],
  [("Zelfde palet en contrast als richting 7","")],
  ["Ze hoeft niets bij te houden: het voordeel komt meteen, niet pas na weken","Alarmen komen van haar eigen iPhone-agenda, en werken ook als Crumbly dicht is"],
  ["Of de agenda-export vanuit een app op het beginscherm goed werkt op haar iPhone is nog niet getest","Geen overzicht van Jean of grafieken: dat is bewust weggelaten"],
  "Dit is een voorstel om mee te praten, geen gebouwde app. Het doel: dat je zus er iets aan heeft zonder iets te moeten doen.")
_d9["screens"] = """
<div class="scr on"><div class="body">
<p class="folio">Dinsdag 4 november</p><h2 class="t">Zaterdag brood?</h2><p class="sub">Je bâtard, vers voor de middag.</p>
<div class="card b"><p class="lbl">Zaterdag om 12:00 klaar</p><p style="font:400 26px 'Young Serif';margin:4px 0">Begin vrijdag om 17:30</p>
<p class="sub" style="margin:0 0 12px">Alleen handwerk in je avond: zes keer 5 tot 15 minuten. Daartussen mag je gewoon leven.</p>
<button class="btn" data-s="1">Zet in mijn agenda</button><button class="btn o">Andere dag of uur</button></div>
<div class="card"><p class="lbl">Jean</p><p style="font:400 22px 'Young Serif';margin:4px 0">Vanavond om 18:00 voeden</p>
<p class="sub" style="margin:0 0 12px">Houd 20 g starter, voeg 100 g meel en 100 g water toe.</p>
<button class="btn o">Elke dag als herinnering in mijn agenda</button></div>
<p class="note2" style="text-align:center">Geen vragen. Geen dagelijks bijhouden.</p>
</div>%%TABS%%</div>

<div class="scr"><div class="body">
<p class="folio">Je agenda</p><h2 class="t">Dit komt erin</h2><p class="sub">Je iPhone verwittigt je, ook als Crumbly dicht is.</p>
<div class="card" style="padding:4px 16px">
<div class="st"><span class="tm">vr 17:30</span><span><span class="nm">Mengen</span><small>Meng bloem en water en laat 30 minuten rusten.</small></span></div>
<div class="st"><span class="tm">vr 18:00</span><span><span class="nm">Starter en zout erbij</span><small>Voeg de starter en het zout toe en kneed 5 minuten.</small></span></div>
<div class="st"><span class="tm">vr 18:30</span><span><span class="nm">Vouwen (4 keer)</span><small>Om de 30 minuten, tot 20:30.</small></span></div>
<div class="st"><span class="tm">vr 22:30</span><span><span class="nm">Vormen, in de koelkast</span><small>Vorm een bâtard en laat 12 uur rijzen in de koelkast.</small></span></div>
<div class="st"><span class="tm">za 10:45</span><span><span class="nm">Oven aan</span><small>250 graden met de pan erin.</small></span></div>
<div class="st" style="border:0"><span class="tm">za 11:30</span><span><span class="nm">Bakken</span><small>20 minuten met deksel, 25 minuten zonder.</small></span></div>
</div>
<p class="note2" style="margin-bottom:12px">De uitleg bij elke afspraak komt uit je eigen boek. Je kan elke afspraak daarna in je agenda verschuiven.</p>
<button class="btn">Zet alles in mijn agenda</button>
</div>%%TABS%%</div>

<div class="scr"><div class="body">
<p class="folio">Zaterdag 12:30</p><h2 class="t">Hoe was hij?</h2><p class="sub">Drie tikken, als je er zin in hebt.</p>
<div class="card"><button class="btn o">Foto van de kruim</button>
<p class="lbl" style="margin-top:8px">Kruim</p><div><span class="chip">Dicht</span><span class="chip on">Gelijkmatig</span><span class="chip">Open</span></div>
<p class="lbl">Volgende keer</p><div class="field" style="margin:4px 0 12px"><input value="Bulk 30 min langer"></div><button class="btn">Bewaar</button></div>
<p class="note2" style="text-align:center">Dit briefje zie je terug als je weer een brood plant.</p>
</div>%%TABS%%</div>
"""
_d9["tabs_labels"] = ["Bakken", "Agenda", "Na het bakken"]
_d9["tab_labels"] = ["Bakken", "Agenda", "Broden"]
D[9] = _d9

def swatches(sw):
    out = []
    for n, h in sw:
        out.append('<div><i style="background:%s"></i><span><b>%s</b><br>%s</span></div>' % (h, html.escape(n), h))
    return "".join(out)

def contrast_rows(rows):
    return "".join("<tr><td>%s</td><td>%s</td></tr>" % (html.escape(a), html.escape(b)) for a, b in rows)

for nr, d in D.items():
    p = PAGE
    scr = d["screens"].replace("%%TABS%%", tabs(d.get("tab_labels", d["tabs_labels"])))
    rep = {"%%NAAM%%": d["naam"], "%%NR%%": str(nr), "%%FONTS%%": d["fonts"], "%%CSS%%": d["css"], "%%NAV%%": nav(nr),
           "%%SFEER%%": d["sfeer"], "%%SW%%": swatches(d["sw"]), "%%CONTRAST%%": contrast_rows(d["contrast"]),
           "%%LETTERS%%": d["letters"], "%%WAAROM%%": d["waarom"],
           "%%PLUS%%": "".join("<li>%s</li>" % x for x in d["plus"]), "%%MIN%%": "".join("<li>%s</li>" % x for x in d["min"]),
           "%%SCREENS%%": scr, "%%JUMP%%": "".join("<button>%s</button>" % l for l in d["tabs_labels"])}
    for k, v in rep.items():
        p = p.replace(k, v)
    open(os.path.join(OUT, "r%d.html" % nr), "w", encoding="utf-8").write(p)

# index
cards = "".join('<a class="cd" href="r%d.html"><b>%d. %s</b><span>%s</span><div class="chips">%s</div></a>' % (
    n, n, d["naam"], d["sfeer"], "".join('<i style="background:%s" title="%s"></i>' % (h, nme) for nme, h in d["sw"][:5])) for n, d in D.items())
idx = """<!doctype html><html lang="nl-BE"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mockups - overzicht</title>
<link rel="stylesheet" href="shared.css"><style>.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}.cd{display:block;background:#fff;border-radius:16px;padding:24px;text-decoration:none;color:#222;border:1px solid #ddd;min-height:44px}.cd b{font-size:20px;display:block;margin-bottom:8px}.chips{display:flex;gap:4px;margin-top:16px}.chips i{width:32px;height:32px;border-radius:8px;border:1px solid rgba(0,0,0,.2)}</style></head>
<body><div class="page"><div class="top">""" + nav(0) + """</div><h1>Zuurdesem-app: 5 designrichtingen</h1>
<p style="margin:8px 0 24px;color:#444">Klikbare mockups in een iPhone-frame (390 x 844). Per richting vier schermen: Vandaag, Nieuwe bak, Tijdlijn, Logboek. Alle gegevens zijn voorbeelden.</p>
<div class="g">""" + cards + """</div></div></body></html>"""
open(os.path.join(OUT, "index.html"), "w", encoding="utf-8").write(idx)
print("ok")
