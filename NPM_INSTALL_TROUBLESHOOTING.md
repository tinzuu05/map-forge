# npm install troubleshooting

If `npm install` appears to hang after lines such as:

```txt
npm http cache ... packages.applied-caas-gateway1.internal.api.openai.org ...
```

the project is probably using an old `package-lock.json` that contains an internal registry URL from the build environment.

This v0.1.2 package intentionally does **not** include:

- `package-lock.json`
- `.npmrc`
- `node_modules`

Use a clean install:

```bash
cd map-forge-monorepo-v0.1.2
rm -rf node_modules package-lock.json
npm config set registry https://registry.npmjs.org/
npm install --no-audit --no-fund
npm run dev
```

If it still looks stuck, run:

```bash
npm install --verbose --no-audit --no-fund
```

For only the Studio app:

```bash
cd apps/studio
rm -rf node_modules package-lock.json
npm install --registry=https://registry.npmjs.org/ --no-audit --no-fund
npm run dev
```
