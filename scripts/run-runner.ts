// Runs the automation runner once, directly against the database:
//   npm run runner
// Handy locally (or from any cron) without going through HTTP.
import "dotenv/config";
import { processAllTenants } from "@/modules/automation/runner";

const result = await processAllTenants(new Date());
console.log(JSON.stringify(result, null, 2));
process.exit(0);
