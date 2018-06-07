# OAuth2 Function Template
Executes OAuth2 authorization flow for a given provider based on configuration

## Prerequisites
1. From project root folder install all the dependencies: `npm i`
2. Modify `provider-oauth-config.json` to suit your desired OAuth2 provider
3. Modify `serverless.yml` inserting the app slug where required

## Note on Configuration
The `authorizeUrl` section pertains to the provider url responsible for authorizing the user. The `scope`
field is the only **required** field, but additional fields can be added as needed by the provider. Any
additional fields will be included as query params (`key=value`) for the authorize request.

## Production Deployment Steps
1. Follow the "Quick Start" instructions for [DroneDeploy CLI](https://github.com/dronedeploy/dronedeploy-cli)
   1. Using the root of this directory as your template location will create a new OAuth function template from which to work
3. After deployment, navigate to https://dronedeployfunctions.com/fn-{functionId}/auth/ (replace `functionId` in url)

## Local Deployment Steps Only
1. Install the [Google Cloud Functions emulator](https://cloud.google.com/functions/docs/emulator)
2. Follow the instructions for the emulator to set a project ID and start the emulator
3. Deploy the function with `functions deploy oauth --trigger-http`
4. Navigate to the url displayed in the terminal with `/auth` as the final part of the path

## Note on Local Deployment with Emulator
Since the emulator mimics direct deployment to the cloud (i.e. not via DroneDeploy CLI),
you must have a `.env` file with your function that contains `APP_SLUG={slug-value}`.