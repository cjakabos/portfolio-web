import { createModelsHandler } from '@portfolio/api-clients/ai-server';
export const runtime = 'edge';
export default createModelsHandler(true);
