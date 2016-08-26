# couchdb-db-transform

Copies documents from one CouchDB database to another CouchDB database, applying one or more optionally configured transformations to the documents.

## Getting started

### Deploy the service in Bluemix

```
$ git clone https://github.com/ibm-cds-labs/couchdb-db-transform.git
$ cd couchdb-db-transform
$ cf push --no-start
```

### Configure the service

#### Define the source and target databases

```
$ cf set-env couchdb-db-transform SOURCE_COUCH_DB_URL https://$USERNAME:$PASSWORD@$REMOTE_USERNAME.cloudant.com/$SOURCE_DATABASE_NAME
$ cf set-env couchdb-db-transform TARGET_COUCH_DB_URL https://$USERNAME:$PASSWORD@$REMOTE_USERNAME.cloudant.com/$TARGET_DATABASE_NAME
```

#### Optional: Declare the transformation functions

```
$ cf set-env couchdb-db-transform TRANSFORM_FUNCTION </path/to/custom_transform_function.js>
```

#### Start the service

```
$ cf start couchdb-db-transform
  ...
$ cf logs couchdb-db-transform --recent  

```

> The service does not start if the `SOURCE_COUCH_DB_URL` or `TARGET_COUCH_DB_URL` environment variables are not defined.

#### Monitor the service status

This service provides a basic service status console. 
> To disable the console, set environment variable `HIDE_CONSOLE` to `true`.

Launch a web browser and open the servide status page `<service-url>/status`, replacing `<service_url>` with the URL that was assigned to your service instance.

Example: `https://couchdb-db-transform.mybluemix.net/status`




### Run the service locally

```
$ git clone https://github.com/ibm-cds-labs/couchdb-db-transform.git
$ cd couchdb-db-transform
$ npm install
  ...
$ export SOURCE_COUCH_DB_URL=https://$USERNAME:$PASSWORD@$REMOTE_USERNAME.cloudant.com/$SOURCE_DATABASE_NAME
$ export TARGET_COUCH_DB_URL=https://$USERNAME:$PASSWORD@$REMOTE_USERNAME.cloudant.com/$TARGET_DATABASE_NAME
$ export TRANSFORM_FUNCTION=sample_transform_function/no_transformation.js
$ node app.js
  ...
```

#### Monitor the status

Launch a web browser and open the service status URL:

```
...
Server starting on http://localhost:6020
Status information is made available at http://localhost:6020/status
...
```

### License 

Copyright 2016 IBM Cloud Data Services

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
