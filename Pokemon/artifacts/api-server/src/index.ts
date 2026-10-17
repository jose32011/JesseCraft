import app from "./app";
import { logger } from "./lib/logger";
import { closeDatabase, initializeDatabase } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

await initializeDatabase();

const server = app.listen(port, process.env["HOST"] ?? "0.0.0.0", (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    server.close((err) => {
      if (err) {
        logger.error({ err }, "Error closing Pokémon Arena API");
        process.exitCode = 1;
      }
      void closeDatabase().catch((closeError: unknown) => {
        logger.error({ err: closeError }, "Error closing Pokémon Arena database");
        process.exitCode = 1;
      });
    });
  });
}
