var Promise = require('bluebird');
var request = require('request-promise');
var AWS = require('aws-sdk');

var cognitoIdentity = new AWS.CognitoIdentity({region:process.env.AWS_REGION});
Promise.promisifyAll(cognitoIdentity);

/**
 * Create or retrieve Amazon Cognito identity.
 */
function getCognitoIdentity(authorizationToken) {
  var m = (''+authorizationToken).match(/^Bearer +([^ ]+)$/);
  if (!m) {
    // Invalid authorization
    return Promise.reject(new Error('Invalid Authorization'));
  }
  var idToken = m[1];
  var logins = {};
  logins[process.env.COGNITO_PROVIDER] = idToken;
  return cognitoIdentity.getIdAsync({
    IdentityPoolId: process.env.COGNITO_POOL_ID,
    AccountId: process.env.AWS_ACCOUNT_ID,
    Logins: logins
  })
  .then(function (response) {
    return response.IdentityId;
  })
  .then(null, function (err) {
    if (err.code == 'NotAuthorizedException') {
      console.log('Handling err', err);
      return Promise.reject(new Error('Unauthorized'));
    } else {
      console.log('Unexpected err', err);
      return Promise.reject(err);
    }
  });
}

function customAuthorize(event) {
  console.log('Custom authorizer checking', event);
  return getCognitoIdentity(event.authorizationToken)
  .then(function (identityId) {
    return {
      "principalId": JSON.stringify({id:identityId}),
      "policyDocument": {
        "Version": "2012-10-17",
        "Statement": [
          {
            "Action": "execute-api:Invoke",
            "Effect": "Allow",
            "Resource": event.methodArn.replace(/\/.*$/, '/*')
          }
        ]
      }
    };
  });
}

module.exports.respond = function (event, callback) {
  customAuthorize(event)
  .then(function (response) {
    callback(null, response);
  })
  .then(null, function (err) {
    callback(err);
  });
};
