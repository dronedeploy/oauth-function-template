# OAuth2 Function Template
Executes OAuth2 authorization flow for a given provider based on configuration

## Prerequisites
1. From project root folder install all the dependencies: `npm i`
2. Modify `provider-oauth-config.json` to suit your desired OAuth2 provider
3. Modify `serverless.yml` replacing 'providername' and inserting the app slug where required
4. Modify `global.APP_SLUG` in `index.js` with your actual app slug

## Production Deployment Steps
1. Follow the "Quick Start" instructions for [DroneDeploy CLI](https://github.com/dronedeploy/dronedeploy-cli)
   1. Using the root of this directory as your template location will create a new OAuth function template from which to work
3. After deployment, navigate to https://dronedeployfunctions.com/providername-oauth/auth/ (replace providername in url)

## Local Deployment Steps Only
1. Install the [Google Cloud Functions emulator](https://cloud.google.com/functions/docs/emulator)
2. Follow the instructions for the emulator to set a project ID and start the emulator
3. Deploy the function with `functions deploy <authProvider name from config> --trigger-http`
4. Navigate to the url displayed in the terminal with `/auth` as the final part of the path