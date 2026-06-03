# FinanceFlow 📊

> Dashboard de finances personnelles open-source — importez n'importe quel export CSV bancaire, analysez vos dépenses, abonnements, budget, et plus encore. **100% browser, zéro backend, zéro inscription.**

## ✨ Fonctionnalités

- 📂 **Import multi-fichiers** — Glissez vos CSV, plusieurs comptes à la fois
- 🏦 **Multi-banques** — BoursoBank, LCL, N26, Revolut, Société Générale, CSV standard
- 📊 **Dashboard complet** — KPIs, graphiques, alertes intelligentes automatiques
- 🔄 **Abonnements** — Détection automatique, timeline de présence mensuelle, coût total
- 🎯 **Budget** — Définissez des plafonds par catégorie, suivez vos dépassements
- 🏦 **Multi-comptes** — Vue globale et vue par compte avec graphiques dédiés
- 🌙 **Dark / Light mode** — Thème persistant en localStorage
- 💻 **100% offline** — Aucune donnée envoyée, tout reste dans votre navigateur
- 🎯 **Mode démo** — Testez sans importer de fichier

## 🚀 Démarrer

```bash
git clone https://github.com/BadreddineEK/financeflow.git
cd financeflow

# Option 1 : ouvrir directement dans votre navigateur
open index.html

# Option 2 : serveur local (recommandé pour éviter CORS)
npx serve .
# ou
python3 -m http.server 8080
```

Puis ouvrez [http://localhost:8080](http://localhost:8080)

## 📁 Structure

```
financeflow/
├── index.html          # Point d'entrée (écran import + app layout)
├── assets/
│   ├── style.css       # Design system (dark/light, tous les composants)
│   └── logo.svg        # Logo SVG
├── src/
│   ├── parsers.js      # Détection auto + parsing multi-banque
│   ├── analyzer.js     # Analyse, enrichissement catégories, alertes
│   ├── charts.js       # Wrappers Chart.js (bar, donut, line, stacked)
│   ├── pages.js        # 6 pages : Overview, Transactions, Catégories, Abonnements, Budget, Comptes
│   └── app.js          # Orchestrateur : import, navigation, thème, démo
└── README.md
```

## 🏦 Banques supportées

| Banque | Status | Format détecté |
|---|---|---|
| BoursoBank | ✅ | `dateOp`, `suggestedLabel`, `accountLabel` |
| LCL | ✅ | `Opération`, `Débit`, `Crédit` |
| N26 | ✅ | `Payee`, `Transaction type` |
| Revolut | ✅ | `Completed Date`, `Paid Out`, `Paid In` |
| Société Générale | ✅ | `libellé`, `REFERENCE` |
| CSV Standard | ✅ | Détection automatique des colonnes |
| Crédit Agricole | 🔜 | Contribution bienvenue |
| BNP Paribas | 🔜 | Contribution bienvenue |

## 🔧 Ajouter une banque

Dans `src/parsers.js`, ajoutez une entrée dans `BANK_CONFIGS` :

```js
mabanque: {
  name: 'Ma Banque',
  color: '#123456',
  detect: (headers) => headers.some(h => /moncolonne/i.test(h)),
  parse: (text, fileName) => {
    const { rows } = parseCSVRaw(text);
    return rows.map(r => ({
      date: parseDate(r['Date']),
      label: r['Libellé'],
      amount: parseAmount(r['Montant']),
      account: fileName,
      category: '', categoryParent: '',
      source: 'mabanque',
    })).filter(t => t.date);
  },
},
```

## 🤝 Contribuer

Les contributions sont les bienvenues !

```bash
git checkout -b feat/nouvelle-banque
# ... vos modifications ...
git commit -m "feat: ajout parser Crédit Agricole"
git push origin feat/nouvelle-banque
```

Ouvrez ensuite une Pull Request sur `main`.

## 📜 Licence

MIT — libre d'utilisation, modification et distribution.

---

Made with ❤️ by [BadreddineEK](https://github.com/BadreddineEK)
