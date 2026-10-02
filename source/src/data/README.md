# Scientist surnames

`scientist-surnames.txt` contains **2,476 unique surnames**, one per line, in UTF-8. It is the name generator's source of truth. Edit this file to change the available names; Vite imports it as raw text and bundles it locally. No runtime network request is required. User-entered names remain unrestricted apart from the existing length validation.

Collected on 2 October 2026 from the [Wikidata Query Service](https://query.wikidata.org/) using [scientist-surnames.rq](scientist-surnames.rq). The query selects the explicit [family name property, P734](https://www.wikidata.org/wiki/Property:P734), for people with occupations scientist, physicist, chemist, biologist, mathematician, astronomer, or computer scientist. It does not guess surnames by splitting full names. The list includes scientists across these disciplines; it is not ranked by fame.

The query returned 2,500 family-name records. Cleaning removes trailing label disambiguators, excludes category labels and malformed entries containing digits or unsupported punctuation, normalises Unicode to NFC, limits names to 60 characters, and deduplicates case-insensitively. Diacritics, hyphens, apostrophes, and compound surnames such as `de Broglie` remain supported. Alphabetical sorting makes the text file easy to maintain.

`scientist-surnames-sources.csv` records the source family-name entity for each retained entry. Distinct entities can share a surname; the generator uses that surname only once. Wikidata is community-maintained, so the association reflects its recorded data rather than a manual audit of every scientist.

Wikidata structured data is released under [CC0](https://www.wikidata.org/wiki/Wikidata:Licensing). The source links and query are retained for provenance.
