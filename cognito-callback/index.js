var Promise = require('bluebird');
var request = require('request-promise');
var AWS = require('aws-sdk');

var cognitoIdentity = new AWS.CognitoIdentity({region:process.env.AWS_REGION});
var cognitoSync = new AWS.CognitoSync({region:process.env.AWS_REGION});
var sns = new AWS.SNS({region:process.env.AWS_REGION});

Promise.promisifyAll(cognitoIdentity);
Promise.promisifyAll(cognitoSync);
Promise.promisifyAll(sns);

var oauth2 = require('simple-oauth2')({
  clientID: process.env.OAUTH2_CLIENT_ID,
  clientSecret: process.env.OAUTH2_CLIENT_SECRET,
  site: process.env.OAUTH2_SERVER,
  tokenPath: process.env.OAUTH2_TOKEN_PATH,
  authorizationPath: process.env.OAUTH2_AUTHORIZATION_PATH
});

function getOAuth2Profile(accessToken) {
  return request(process.env.OAUTH2_SERVER + process.env.OAUTH2_USERINFO_PATH, {
    json: true,
    headers: {
      Authorization: 'Bearer ' + accessToken
    }
  })
  .then(function (response) {
    console.log('USERINFO response:', response);
    return response;
  });
}

function getCognitoIdentity(idToken) {
  var logins = {};
  logins[process.env.COGNITO_PROVIDER] = idToken;
  var options = {
    IdentityPoolId: process.env.COGNITO_POOL_ID,
    AccountId: process.env.AWS_ACCOUNT_ID,
    Logins: logins
  };
  console.log('Getting Cognito identity', options);
  return cognitoIdentity.getIdAsync(options)
  .then(function (response) {
    return response.IdentityId;
  });
}

function updateCognitoProfile(identityId, profile) {
  var syncSessionToken;
  var patches = [];
  return cognitoSync.listRecordsAsync({
    IdentityPoolId: process.env.COGNITO_POOL_ID,
    IdentityId: identityId,
    DatasetName: process.env.COGNITO_PROFILE_DATASET,
  })
  .then(function (response) {
    syncSessionToken = response.SyncSessionToken;
    var oldRecords = {};
    response.Records.map(function (record) {
      oldRecords[record.Key] = record;
    });
    Object.keys(profile).map(function (key) {
      var oldRecord = oldRecords[key];
      var newValue = typeof profile[key] == 'object' ? JSON.stringify(profile[key]) : ''+profile[key];
      // Check if changed
      if (!oldRecord || newValue != oldRecord.Value) {
        patches.push({
          Op: 'replace',
          Key: key,
          Value: newValue,
          SyncCount: oldRecord ? oldRecord.SyncCount : 0
        });
      }
    });
    if (patches.length > 0) {
      return cognitoSync.updateRecordsAsync({
        IdentityPoolId: process.env.COGNITO_POOL_ID,
        IdentityId: identityId,
        DatasetName: process.env.COGNITO_PROFILE_DATASET,
        SyncSessionToken: syncSessionToken,
        RecordPatches: patches
      });
    }
  })
  .then(function (response) {
    console.log('Cognito profile response:', response);
  })
}

/**
 *
 */
function publishSnsTrigger(identityId, profile) {
  if (process.env.COGNITO_TRIGGER_TOPIC) {
    return sns.publishAsync({
      TopicName: process.env.COGNITO_TRIGGER_TOPIC,
      Message: JSON.stringify({
        identityId: identityId,
        profile: profile
      })
    });
  }
}

/**
 * Handle a callback redirect return from OAuth2 server.
 */
function oauth2Callback(code, accessToken, idToken, state) {
  var profile;
  var identityId;
  var local = false;

  if (state && state == 'local') {
    local = true;
  }

  return Promise.resolve()
  .then(function () {
    // If we don't have an access token and an id token, retrieve them using the code
    if (code && (!accessToken || !idToken)) {
      return oauth2.authCode.getToken({
        code: code,
        redirect_uri: process.env.OAUTH2_CALLBACK_URI
      })
      .then(function (response) {
        accessToken = response.access_token;
        idToken = response.id_token;
        console.log('Callback got accessToken', accessToken, 'idToken', idToken);
      });
    }
  })
  .then(function () {
    // Retrieve user profile info
    return getOAuth2Profile(accessToken);
  })
  .then(function (aProfile) {
    profile = aProfile;
    console.log('Callback got profile', profile);
    return getCognitoIdentity(idToken);
  })
  .then(function (aIdentityId) {
    identityId = aIdentityId;
    console.log('Callback got identity', identityId);
    return updateCognitoProfile(identityId, profile);
  })
  .then(function () {
    return publishSnsTrigger(identityId, profile);
  })
  .then(function () {
    console.log('Callback updated cognito profile');
    var location = (local ? process.env.OAUTH2_LOCAL_REDIRECT_URI : process.env.OAUTH2_REDIRECT_URI)
      + '?access_token=' + encodeURIComponent(accessToken)
      + '&id_token=' + encodeURIComponent(idToken);
    console.log('Redirecting to location', location);
    return {
      Location: location
    }
  });
}

module.exports.respond = function (event, callback) {
  oauth2Callback(event.code, event.access_token, event.id_token, event.state)
  .then(function (response) {
    callback(null, response);
  })
  .then(null, function (err) {
    callback(err);
  });
};
