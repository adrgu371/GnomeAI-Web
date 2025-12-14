# GnomeAI-Web
# Politica de Confidențialitate pentru WebGnome AI

WebGnome AI este o extensie de browser dezvoltată pentru a oferi asistență AI contextuală. Confidențialitatea și securitatea datelor dumneavoastră sunt prioritățile noastre principale.

## 1. Colectarea și Stocarea Datelor

**Extensia WebGnome AI NU colectează, stochează sau transmite date personale pe servere proprii sau servere terțe (cu excepția celor menționate mai jos).**

### Stocarea Locală (pe Dispozitivul Dvs.)

Datele sunt stocate exclusiv în spațiul de stocare local al browserului (`chrome.storage`) și includ:

* **Istoricul de Chat:** Mesajele și răspunsurile pentru a menține persistența conversațiilor.
* **Setările Utilizatorului:** Numele modelului Ollama și Cheia API Brave Search.

### Date transmise către Servicii Externe (în cadrul funcționalității):

* **Ollama (LLM Local):** Textul prompt-ului și conținutul paginii analizate sunt trimise de la browserul dumneavoastră la serverul Ollama care rulează **local** pe computerul dumneavoastră (ex: `http://localhost:11434`). Aceste date nu părăsesc rețeaua dumneavoastră locală.
* **Brave Search API:** Interogările de căutare (Query) sunt trimise către `https://api.search.brave.com/` împreună cu cheia API pentru a obține rezultate web.

## 2. Datele Paginilor Web

Extensia accesează conținutul paginii web active **doar** atunci când utilizatorul invocă în mod explicit funcția de Analiză a Paginilor. Conținutul extras al paginii este folosit exclusiv pentru a genera un răspuns contextual de la AI și **nu este înregistrat sau partajat** în afara comunicării locale cu Ollama.
