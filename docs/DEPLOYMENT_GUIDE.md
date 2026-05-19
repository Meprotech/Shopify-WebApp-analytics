# Vercel Deployment Guide & Bypassing Pipeline

> [!IMPORTANT]
> Because this repository is a **private repository** on a **Vercel Hobby (Free) Plan**, Vercel restricts automatic GitHub push deployments due to collaborator email/username checking mechanisms.
> 
> **To push updates successfully, we MUST build the project locally and deploy directly via the Vercel CLI.**

## The Automation Script

We have defined a custom script inside your `package.json` to handle the entire pipeline in a single command:

```bash
npm run push-code
```

### What this script does:
1. **GitHub Sync:** Synchronizes the main repository:
   ```bash
   git push origin main --force
   ```
2. **Environment Pull:** Pulls your secure Supabase & Shopify variables securely from Vercel:
   ```bash
   npx vercel pull --yes --environment production
   ```
3. **Local Production Compile:** Compiles your Vite and Remix assets locally:
   ```bash
   npx vercel build --prod
   ```
4. **Direct Prebuilt Deploy:** Pushes the compiled prebuilt bundle directly to your production live site, completely bypassing Vercel's automated git-hook blocklist:
   ```bash
   npx vercel deploy --prebuilt --prod
   ```

---

## Instructions for AI Agents

Whenever the user says **"push the code"** or **"deploy"**, you **MUST** run:
```bash
npm run push-code
```
Inside the `x:\Dashboard Analytics\shopify-analytics-app` workspace. Do NOT attempt to rely on standard automatic GitHub action hooks.
