import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./shared/logger/logger.js";

const app = createApp();

app.listen(env.PORT, () => {
  logger.info("API server started", {
    port: env.PORT,
    basePath: env.API_BASE_PATH,
    environment: env.NODE_ENV,
  });
});
