import { createApp } from './src/app.js';
import { logger } from './src/logger.js';

const PORT = process.env.PORT || 3000;
createApp().listen(PORT, () => {
    logger.info({ port: Number(PORT) }, 'server listening');
});
