# Hřiště U Pošty — veřejný web

Toto je veřejný statický deploy webu pro doménu `www.hristeuposty.cz`.

Web obsahuje:

- veřejný onepager sbírky,
- samostatnou stránku žádosti o potvrzení daru,
- informační stránky k transparentnímu účtu, ochraně osobních údajů a dokumentům sbírky,
- veřejné CSS, JS a obrazové assety potřebné pro provoz webu.

Repo neobsahuje interní operátorský nástroj, ukázková data ani pracovní soubory.

## Nasazení

Web je čistý statický HTML/CSS/JS projekt bez buildu. GitHub Pages čte obsah z větve `main`.
Veřejná část používá system sans typografii bez Google Fonts a bez dalších
externích runtime skriptů mimo odkaz na transparentní účet banky.

Doména je nastavena přes `CNAME`:

```text
www.hristeuposty.cz
```

## Veřejné stránky

- `index.html`
- `potvrzeni-o-daru.html`
- `transparency.html`
- `transparent-account.html`
- `privacy.html`
- `osvedceni-verejna-sbirka.html`
- `vyuctovani-prubezne.html`
- `vyuctovani-konecne.html`

## Poznámka

Veřejný web nepoužívá backend, databázi ani serverové ukládání formulářů. Platební QR kód se generuje lokálně v prohlížeči.
