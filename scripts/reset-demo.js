// Restores the demo dataset — handy before a sales demo. `npm run reset-demo`
import { bootstrap, resetDemo } from '../src/db.js';

bootstrap();
resetDemo();
console.log('Demo data has been reset. Restart the server if it is running.');
