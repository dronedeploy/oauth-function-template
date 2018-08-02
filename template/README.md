# OAuth2 Function Template
Executes OAuth2 authorization flow for a given provider based on configuration

## Prerequisites
1. Install all the dependencies: `npm i`
2. Modify `configuration` variable in `index.js` file to suit your desired OAuth2 provider
3. Modify `serverless.yml` inserting the app id where required
4. Add `.env` file with needed env variables

## .ENV File Structure
APP_ID - App Id from DroneDeploy   
DDENV - deployment environment  
FUNCTION_NAME - only needed while deploying onto GCloud  
CLIENT_ID - provider client id  
CLIENT_SECRET - provider client secret  

Example:
~~~~
APP_ID=abcdefghijklmnopqrst
DDENV=test  
FUNCTION_NAME=fn_4b07d7qfd3g24b0651743771
CLIENT_ID=31523524302fjfj02jff0249
CLIENT_SECRET=4095hjfhfjhfeihf3jho3j4hgo34j
~~~~

## Note on Configuration
The `authorizeUrl` section pertains to the provider url responsible for authorizing the user. The `scope`
field is the only **required** field, but additional fields can be added as needed by the provider. Any
additional fields will be included as query params (`key=value`) for the authorize request.

## Production Deployment Steps
1. Follow the "Quick Start" instructions for [DroneDeploy CLI](https://github.com/dronedeploy/dronedeploy-cli)
2. Using the root of this directory as your template location will create a new OAuth function template from which to work

## Local Deployment Steps Only
1. Install the [Google Cloud Functions emulator](https://cloud.google.com/functions/docs/emulator)
2. Follow the instructions for the emulator to set a project ID and start the emulator
3. Deploy the function with `functions deploy oauth --trigger-http`
4. Navigate to the url displayed in the terminal with `/auth` as the final part of the path
