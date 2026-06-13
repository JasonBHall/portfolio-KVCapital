# Local dev setup — run once after Postgres is installed
# Assumes Postgres 17, default postgres user

$pgPass = "postgres"
$dbName = "kvcapital"

Write-Host "Creating database..." -ForegroundColor Cyan
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -c "CREATE DATABASE $dbName;" 2>$null

Write-Host "Running schema..." -ForegroundColor Cyan
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d $dbName -f "backend\db\schema.sql"

Write-Host "Generating dataset..." -ForegroundColor Cyan
python backend\data\generate_dataset.py --output backend\data\sales_data.json

Write-Host "`nSetup complete." -ForegroundColor Green
Write-Host "Next steps:"
Write-Host "  1. Add your ANTHROPIC_API_KEY and OPENAI_API_KEY to backend\.env"
Write-Host "  2. Run the seed script: cd backend && python db\seed.py"
Write-Host "  3. Start backend:  cd backend && uvicorn app.main:app --reload"
Write-Host "  4. Start frontend: cd frontend && npm run dev"
