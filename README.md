# plugin-quest
show quest info

## Updating data
Use `fetch.js` to automatically update data. DO NOT manually change the data file!

The scripts will read 2 environment variables.
1. `http_proxy` or `https_prxoy`, if set, will download through the proxy
2. `local`, if truthy, will read local data file instead

The scripts will also updates quest interpretations in `result` folder, check the diff of these files to ensure the new data could be used in every languages. And if some errors are thrown during interpretation, either the data or the intepreter is incorrect.
