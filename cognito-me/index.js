var Promise = require('bluebird');
var cognitoSync = new AWS.CognitoSync({region:process.env.AWS_REGION});
Promise.promisifyAll(cognitoSync);

function getMe(principalId) {
  return cognitoSync.listRecordsAsync({
    IdentityPoolId: process.env.COGNITO_POOL_ID,
    IdentityId: principalId.id,
    DatasetName: process.env.COGNITO_PROFILE_DATASET
  })
  .then(function (response) {
    var records = {};
    response.Records.map(function (record) {
      records[record.Key] = record.Value;
    });
    return records;
  });
}

module.exports.respond = function (event, callback) {
  getMe(event.principalId)
  .then(function (response) {
    callback(null, response);
  })
  .then(null, function (err) {
    callback(err);
  });
};
