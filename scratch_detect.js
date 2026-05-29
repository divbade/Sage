import { detectTopicType } from './src/services/claude.js';
import * as dotenv from 'dotenv';
dotenv.config();

(async () => {
  const t1 = await detectTopicType("solving quadratic equations", "you use the quadratic formula");
  console.log("solving quadratic equations:", t1);
  const t2 = await detectTopicType("photosynthesis", "plants use sunlight to make food");
  console.log("photosynthesis:", t2);
})();
