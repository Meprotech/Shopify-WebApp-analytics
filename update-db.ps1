npx vercel env rm DATABASE_URL production -y
Write-Output -NoEnumerate "postgresql://postgres.wlrbxjopvvescvtgbysr:7LgdVaL-fdvnY-4@aws-0-us-east-1.pooler.supabase.com:6543/postgres" | npx vercel env add DATABASE_URL production
npx vercel --prod --yes
