const jest_es = require('@shelf/jest-elasticsearch/setup');

module.exports = async function () {
  await jest_es();
};
