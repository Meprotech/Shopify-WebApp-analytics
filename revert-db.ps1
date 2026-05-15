npx vercel env rm DATABASE_URL production -y
Write-Output -NoEnumerate "postgresql://postgres:7LgdVaL-fdvnY-4@db.wlrbxjopvvescvtgbysr.supabase.co:5432/postgres" | npx vercel env add DATABASE_URL production
npx vercel --prod --yes
