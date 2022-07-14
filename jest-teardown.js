const jest_es = require('@shelf/jest-elasticsearch/teardown');

module.exports = async function (jestArgs) {
  await jest_es(jestArgs);
};
