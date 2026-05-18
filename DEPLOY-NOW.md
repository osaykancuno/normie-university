# 🚀 Deploy NORMIE UNIVERSITY su Vercel — istruzioni 10 minuti

Stato: commit `136129f` pronto. Ora serve push GitHub + import Vercel.

---

## 1️⃣ Crea il repo su GitHub (3 min)

Vai su **https://github.com/new** e crea un repo con queste impostazioni:

- **Nome**: `normie-university`
- **Visibilità**: Public (raccomandato per hackathon — Discord submission richiede repo URL pubblico)
- **NON** spuntare "Add README", "Add .gitignore", "Add license" — il repo locale ha già tutto

Dopo il "Create repository", GitHub ti mostra l'URL. Copialo (formato `https://github.com/<TUO_USER>/normie-university.git`).

---

## 2️⃣ Push del codice (1 comando)

Apri PowerShell dentro `C:\Users\Utente\Desktop\SkillAI` e lancia:

```powershell
git remote add origin https://github.com/<TUO_USER>/normie-university.git
git branch -M main
git push -u origin main
```

Al primo push GitHub ti chiederà l'auth — usa **GitHub Desktop** (se installato) oppure un **Personal Access Token** (Settings → Developer settings → Tokens → Generate).

---

## 3️⃣ Import su Vercel (3 min)

1. Vai su **https://vercel.com/new**
2. Login con GitHub se non l'hai fatto
3. Trova `normie-university` nella lista repo → click **Import**
4. **Configure Project**:
   - Framework Preset: `Next.js` (auto-detect)
   - **Root Directory**: clicca **Edit** → seleziona `app` ← IMPORTANTE, è monorepo
   - Build Command: `next build` (default)
   - Output Directory: `.next` (default)
   - Install Command: `npm install` (default)
5. **Environment Variables** — clicca "Add" e copia-incolla queste **11 variabili** una alla volta:

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_NETWORK` | `testnet` |
| `RPC_URL` | `https://ethereum-sepolia-rpc.publicnode.com` |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | `c085bed085b98c624c9a5ef64c33832f` |
| `PINATA_JWT` | *(incolla il JWT che mi hai dato)* |
| `IPFS_GATEWAY` | `https://ipfs.io/ipfs` |
| `NEXT_PUBLIC_AGENT_REGISTRY_11155111` | `0x0c14356eEB022515f45a8370145703990023ce40` |
| `NEXT_PUBLIC_SKILL_REGISTRY_11155111` | `0x4d3572C0D529c4F3162aAB928D4336461823B9e7` |
| `NEXT_PUBLIC_SKILL_CREDENTIAL_11155111` | `0x47473aBC1ccEdf08e1915467dD7e008Ef6512ed4` |
| `NEXT_PUBLIC_SKILL_MARKETPLACE_11155111` | `0x69901BEa99622Ad1c4130230917fb237181902AD` |
| `NEXT_PUBLIC_REPUTATION_ENGINE_11155111` | `0x8714a363579Aa1135888bc6B689077705C86b46A` |
| `NEXT_PUBLIC_TREASURY_11155111` | `0x4159d7693394f8160e4F99F6b1A3377c692CddB6` |
| `NEXT_PUBLIC_VALIDATION_REGISTRY_11155111` | `0xb0490cd67976096D77AD063fAA2a281488b8793B` |
| `NEXT_PUBLIC_CROSS_CHAIN_RECEIVER_11155111` | `0x5458D89d606B4bEc837875B0220E6460b58F6C8a` |
| `NEXT_PUBLIC_PATH_REGISTRY_11155111` | `0x16555d59EaE75Ebba1B07dD46520C42Be6a59472` |

6. Click **Deploy**.

Build richiede ~2-3 minuti. Quando finisce vedi l'URL tipo `https://normie-university.vercel.app`.

---

## 4️⃣ Smoke test post-deploy (1 min)

Apri il tuo URL Vercel e visita queste pagine — dovrebbero caricare tutte:

- `/` — landing NORMIE UNIVERSITY
- `/preview` — Pre-school
- `/preview/4354` — persona preview di Zori
- `/agents` — directory awakened
- `/skills` — catalogo 16 skill
- `/.well-known/agent.json` — manifest A2A

---

## 5️⃣ Aggiorna l'URL nel demo script

Una volta che hai l'URL Vercel definitivo, sostituisci nel video script + caption Discord:

```
Demo URL: https://normie-university.vercel.app
Repo:     https://github.com/<TUO_USER>/normie-university
```

---

## 🆘 Troubleshooting

**Push fails con "remote rejected"** → controlla che il repo GitHub sia vuoto (no README iniziale).

**Vercel build fail "Cannot find module"** → verifica che Root Directory sia `app`, NON la root del monorepo.

**API routes ritornano 500 in prod** → manca una env var. Apri il deployment → Logs → cerca `Missing env var`.

**WalletConnect non si connette** → il `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` deve essere uguale a quello in `.env.local`. Iniettati wallet (MetaMask) funzionano anche senza.
