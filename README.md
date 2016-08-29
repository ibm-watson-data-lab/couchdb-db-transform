# couchdb-db-transform

![build status](https://travis-ci.org/ibm-cds-labs/couchdb-db-transform.svg?branch=master)

Copies documents from one CouchDB database to another CouchDB database, applying one or more optionally configured transformations to the documents.

![Overview](https://raw.githubusercontent.com/ibm-cds-labs/couchdb-db-transform/master/media/flow.png)

Inspired by [couchimport](https://www.npmjs.com/package/couchimport).

## Getting started

### Run the service in Bluemix

#### Clone the repository

```
$ git clone https://github.com/ibm-cds-labs/couchdb-db-transform.git
$ cd couchdb-db-transform
```

#### Optional: Implement a custom transformation function

Custom transformation functions can be used to selectively modify source documents before they are saved in the target database.
[Example transformation function that adds a timestamp to each document](https://github.com/ibm-cds-labs/couchdb-db-transform/blob/master/sample_transform_functions/add_timestamp_property.js):

```
/*
 * Sample transformation function that adds a property to each document
 * @param {Object} doc - the source document
 * @returns {Object} - the transformed document
 */
module.exports = function(doc) {

	if(doc) {

		doc.timestamp = new Date().toISOString();

	}
	
	return doc;
};
```

#### Deploy the service

```
$ cf push --no-start
```


### Configure the service

Before the service can be used you have to identify the source database, the target database and the (optionally) the transformation function.

#### Define the source and target databases

```
$ cf set-env couchdb-db-copy-and-transform-service SOURCE_COUCH_DB_URL https://$USERNAME:$PASSWORD@$REMOTE_USERNAME.cloudant.com/$SOURCE_DATABASE_NAME
$ cf set-env couchdb-db-copy-and-transform-service TARGET_COUCH_DB_URL https://$USERNAME:$PASSWORD@$REMOTE_USERNAME.cloudant.com/$TARGET_DATABASE_NAME
```

> The databases identified by environment variables `SOURCE_COUCH_DB_URL` and `TARGET_COUCH_DB_URL` must exist.

> Note: the service creates a small repository database named `transform_` in the target CouchDB instance. [Learn more ...](https://github.com/ibm-cds-labs/couchdb-db-transform/wiki/Repository-database-overview)

#### Declare the transformation function

Declare the transformation function by setting environment variable `TRANSFORM_FUNCTION`.

```
$ cf set-env couchdb-db-copy-and-transform-service TRANSFORM_FUNCTION </path/to/custom_transform_function.js>
```

> Simple example transformation functions are located in the [`sample_transform_functions`](https://github.com/ibm-cds-labs/couchdb-db-transform/blob/master/sample_transform_functions/) directory.


#### Start the service

```
$ cf start couchdb-db-copy-and-transform-service
  ...
$ cf logs couchdb-db-copy-and-transform-service --recent  
```

Once started, the service will listen to the change feed of the source database. When the service is started for the first time, all changes that occurred in the past will be captured. If the service is restarted only documents that have not yet been processed will be retrieved, transformed and stored in the target database. 

> Set environment variable `RESTART` to `true` to always fetch all documents. Note that the service _does not_ delete existing documents in the target database.

> The service terminates immediately if the `SOURCE_COUCH_DB_URL` or `TARGET_COUCH_DB_URL` environment variables are not defined, if the specified `TRANSFORM_FUNCTION` cannot be loaded or if it causes an error during processing.

#### Monitor the service status

This service provides a basic service status console. 

Launch a web browser and open the servide status page `<service-url>/status`, replacing `<service_url>` with the URL that was assigned to your service instance.

Example: `https://couchdb-db-copy-and-transform-service.mybluemix.net/status`

> To disable the console, set environment variable `HIDE_CONSOLE` to `true`.

### Run the service locally

```
$ git clone https://github.com/ibm-cds-labs/couchdb-db-transform.git
$ cd couchdb-db-transform
$ npm install
  ...
$ export SOURCE_COUCH_DB_URL=https://$USERNAME:$PASSWORD@$REMOTE_USERNAME.cloudant.com/$SOURCE_DATABASE_NAME
$ export TARGET_COUCH_DB_URL=https://$USERNAME:$PASSWORD@$REMOTE_USERNAME.cloudant.com/$TARGET_DATABASE_NAME
$ export TRANSFORM_FUNCTION=sample_transform_functions/no_transformation.js
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
