var Promise = require('bluebird');

var oauth2 = require('simple-oauth2')({
  clientID: process.env.OAUTH2_CLIENT_ID,
  clientSecret: process.env.OAUTH2_CLIENT_SECRET,
  site: process.env.OAUTH2_SERVER,
  tokenPath: process.env.OAUTH2_TOKEN_PATH,
  authorizationPath: process.env.OAUTH2_AUTHORIZATION_PATH
});

function login(local) {
  var authorizationUri = oauth2.authCode.authorizeURL({
    redirect_uri: process.env.OAUTH2_CALLBACK_URI,
    scope: 'openid',
    state: local ? 'local' : ''
  });
  return Promise.resolve({Location:authorizationUri});
}

module.exports.respond = function (event, callback) {
  login(event.local)
  .then(function (response) {
    callback(null, response);
  })
  .then(null, function (err) {
    callback(err);
  });
};
