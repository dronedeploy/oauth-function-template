# OAuth2 Function Template
Executes OAuth2 authorization flow for a given provider based on configuration

## Prerequisites
1. From project root folder install all the dependencies: `npm i`
2. Install the [Google Cloud Functions emulator](https://cloud.google.com/functions/docs/emulator)
3. Follow the instructions for the emulator to set a project ID and start the emulator
4. Modify `config.json` to suit your desired OAuth2 provider

## Run

Deploy the function with `functions deploy <authProvider name from config> --trigger-http`

Navigate to the url displayed in the terminal with `/auth` as the final part of the path
