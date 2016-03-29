# Serverless Cognito OAuth2
Kenneth Falck <kennu@iki.fi> 2016

## Overview

This is a Serverless module that provides OAuth2 user authentication using
Amazon Cognito to store user identities and profiles.

The module also includes a Custom Authorizer for API Gateway, which you
should configure for every API that needs to be behind authentication.

Once you've installed and configured the module, navigate to
[yoursiteurl]/cognito/login to start the login process.

## Installation

To use this module, copy this folder under your Serverless project root folder.
Then, in the copied folder, run this command to install dependencies:

    npm install

You will also need to merge the Lambda policy permissions found in
*s-resources-cf.json* into your Serverless project's main s-resources-cf.json.

All the Lambda functions and APIs will be deployed by running these commands in
your Serverless project root:

    sls function deploy -a
    sls endpoint deploy -a

## Configuration

Use these environment variables to control the authentication process:

    AWS_REGION - AWS region to use
    AWS_ACCOUNT_ID - AWS account to use in authentication
    COGNITO_POOL_ID - Amazon Cognito Pool ID to use
    COGNITO_PROVIDER - Amazon Cognito OpenID Provider name to use
    COGNITO_PROFILE_DATASET - Amazon Cognito dataset to store user profile in
    OAUTH2_CLIENT_ID - External OAuth2 provider Client ID
    OAUTH2_CLIENT_SECRET - External OAuth2 provider Client Secret
    OAUTH2_SERVER - External OAuth2 provider base URL
    OAUTH2_TOKEN_PATH - Path for requesting tokens on OAuth2 server
    OAUTH2_AUTHORIZATION_PATH - Path for authorizing on OAuth2 server
    OAUTH2_USERINFO_PATH - Path for requesting user info on OAuth2 server
    OAUTH2_CALLBACK_URI - Full URI to /callback on our own server
    OAUTH2_REDIRECT_URI - Final redirect URI after authentication is complete
    OAUTH2_LOCAL_REDIRECT_URI - Final redirect URI for localhost testing

You will need to configure all those variables in your Serverless project.
Here is a script template you can copy-paste to do it:

    sls variables set -k AWS_REGION -v eu-west-1
    sls variables set -k AWS_ACCOUNT_ID -v 1234567890
    sls variables set -k COGNITO_POOL_ID -v eu-west-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
    sls variables set -k COGNITO_PROVIDER -v xxx.auth0.com
    sls variables set -k COGNITO_PROFILE_DATASET -v profile
    sls variables set -k OAUTH2_CLIENT_ID -v xxx
    sls variables set -k OAUTH2_CLIENT_SECRET -v xxx
    sls variables set -k OAUTH2_SERVER -v https://xxx.auth0.com
    sls variables set -k OAUTH2_TOKEN_PATH -v /oauth/token
    sls variables set -k OAUTH2_AUTHORIZATION_PATH -v /authorize
    sls variables set -k OAUTH2_USERINFO_PATH -v /userinfo
    sls variables set -k OAUTH2_CALLBACK_URI -v https://xxx.execute-api.eu-west-1.amazonaws.com/dev/cognito/callback
    sls variables set -k OAUTH2_REDIRECT_URI -v https://xxx.example.org/dashboard
    sls variables set -k OAUTH2_LOCAL_REDIRECT_URI -v http://localhost:9000/dashboard

## Using the Custom Authorizer

To protect an API, add this to the endpoint configuration:

    "authorizationType": "CUSTOM",
    "authorizerFunction": "cognito-authorize",

Take a look at cognito-me/s-function.json for an example.

## PrincipalId JSON format

The Custom Authorizer uses API Gateway's principalId field to convey
information to other Lambda functions. The field is populated with a small
JSON encoded document that may carry several attributes:

    {
      id: "<conito identity id>",
      email: "<cognito profile email>"
    }

The principalId document can be automatically decoded by using an API
Gateway request template like this:

    "requestTemplates": {
      "application/json": "{\"principalId\":$context.authorizer.principalId}"
    },

The JSON is expanded by the template and the fields are passed to Lambda
functions as:

    event.principalId.id
    event.principalId.email

## Exposed API Gateway Endpoints

These paths are exposed by this module:

* GET /cognito/login - Starts the login process (redirects the web browser to the OAuth2 provider)
* GET /cognito/callback - Ends the login process (redirect back from the OAuth2 provider)
* GET /cognito/me - Returns signed in profile information or 401 if not signed in
