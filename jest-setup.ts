const jest_es = require('@shelf/jest-elasticsearch/lib/setup');
export default async function () {
  await jest_es();
}
