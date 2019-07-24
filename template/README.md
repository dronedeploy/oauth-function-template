# OAuth2 Function Template
Executes OAuth2 authorization flow for a given provider based on configuration

## Prerequisites
1. Install all the dependencies: `npm i`
2. Modify `configuration` variable in `index.js` file to suit your desired OAuth2 provider
3. Modify `serverless.yml` inserting the app id where required
4. Add `.env` file with needed env variables

## .ENV File Structure
CLIENT_ID - provider client id  
CLIENT_SECRET - provider client secret  

Example:
~~~~
CLIENT_ID=31523524302fjfj02jff0249
CLIENT_SECRET=4095hjfhfjhfeihf3jho3j4hgo34j
~~~~

## Note on Configuration
The `authorizeUrl` section pertains to the provider url responsible for authorizing the user. The `scope`
field is the only **required** field, but additional fields can be added as needed by the provider. Any
additional fields will be included as query params (`key=value`) for the authorize request.

The `innerAuthorizationUrl` parameter is optional parameter, which is used to make sure that inner 
service used within outer service is accessible with stored `accessToken`. If this field is not
empty then for each `/refresh` request this url is called. Field `accessToken` stored in 
`OAuth Table` is used as authorization token, if given. If url response give back `Unauthorized` or 
`Forbidden` status, then appropriate `OAuth Table` is cleaned up in the same way as the user
 logging out.