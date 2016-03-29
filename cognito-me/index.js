var Promise = require('bluebird');
var AWS = require('aws-sdk');
var cognitoSync = new AWS.CognitoSync({region:process.env.AWS_REGION});
Promise.promisifyAll(cognitoSync);

function getMe(principalId) {
  return cognitoSync.listRecordsAsync({
    IdentityPoolId: process.env.COGNITO_POOL_ID,
    IdentityId: principalId.id,
    DatasetName: process.env.COGNITO_PROFILE_DATASET
  })
  .then(function (response) {
    var records = {
      id: principalId.id
    };
    response.Records.map(function (record) {
      if (record.Key === 'id') {
        // Don't overwrite id
        records['_id'] = record.Value;
      } else {
        records[record.Key] = record.Value;
      }
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
