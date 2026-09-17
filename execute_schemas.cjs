const fs = require('fs');
const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL no encontrada en el .env");
  process.exit(1);
}

const client = new Client({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

const artifactDir = path.join(__dirname, "database_schemas");

const schemasToExecute = [
  "full_schema.md",
  "academic_schema.md",
  "attendance_schema.md",
  "finance_schema.md",
  "assignments_schema.md",
  "schedules_schema.md",
  "contracts_schema.md",
  "documents_schema.md",
  "hierarchy_schema.md",
  "corporate_erp_schema.md"
];

async function executeSchemas() {
  try {
    await client.connect();
    console.log("Conectado a Supabase Postgres!");

    for (const schemaName of schemasToExecute) {
      const filePath = path.join(artifactDir, schemaName);
      if (!fs.existsSync(filePath)) {
        console.warn(`Archivo no encontrado: ${schemaName}`);
        continue;
      }

      const content = fs.readFileSync(filePath, 'utf8');
      // Extract SQL block from markdown
      const sqlMatch = content.match(/```sql([\s\S]*?)```/);
      let sqlToRun = sqlMatch ? sqlMatch[1] : content;
      
      // Some files might not have markdown sql blocks if I wrote them directly as SQL, or they might just be plain SQL
      // Wait, let's verify if there are any SQL blocks. If not, just run the whole content (except markdown headers).
      if (!sqlMatch) {
         // simple filter to remove markdown headers (#) if any
         sqlToRun = sqlToRun.split('\n').filter(line => !line.startsWith('#') && !line.startsWith('```')).join('\n');
      }

      console.log(`Ejecutando ${schemaName}...`);
      try {
        await client.query(sqlToRun);
        console.log(`✅ ${schemaName} ejecutado exitosamente.`);
      } catch (err) {
        console.error(`❌ Error ejecutando ${schemaName}:`, err.message);
      }
    }

  } catch (err) {
    console.error("Error de conexión:", err);
  } finally {
    await client.end();
  }
}

executeSchemas();
