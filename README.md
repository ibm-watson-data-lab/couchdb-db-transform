# couchdb-db-transform

![build status](https://travis-ci.org/ibm-cds-labs/couchdb-db-transform.svg?branch=master)

Copies documents from one CouchDB database to another CouchDB database, applying one or more optionally configured filter and transformation operations to the documents.

![Overview](https://raw.githubusercontent.com/ibm-cds-labs/couchdb-db-transform/master/media/flow.png)

Inspired by [couchimport](https://www.npmjs.com/package/couchimport) and built on CouchDB's change feed.

## Getting started

#### Clone the repository

```
$ git clone https://github.com/ibm-cds-labs/couchdb-db-transform.git
$ cd couchdb-db-transform
```

#### Custom filter function

Custom filter functions can be used to limit the number of source documents that will be stored in the target database. Two types of filters are supported: _server-side_ and _client-side_.


##### Server-side filters

Server-side filters are applied by CouchDB and determine which documents are included in the change feed that the service subscribes to. Use this type of filter in scenarios where a significant number of documents can be excluded to reduce the network traffic between the database and the service. 

Server-side filters are [defined in design documents](https://github.com/ibm-cds-labs/couchdb-db-transform/wiki/Document-filters) in the source database. 

Example of a design document that defines a filter for deleted documents:

```
{
  "_id": "_design/transform_service",
  "filters": {
    "exclude_deleted_docs": "function(doc, req) { if(doc._deleted) { return false; }  else { return true; }}"
  },
  "language": "javascript"
}

```

##### Client-side filters

Client-side filters are applied by the service and determine which documents will be passed to the transformation routine and subsequently stored in the target database. These filters are implemented in Node.JS and deployed with the service.

[Example filter function that excludes design documents](https://github.com/ibm-cds-labs/couchdb-db-transform/blob/master/sample_filter_functions/ignore_design_documents.js):

```
/*
 * Filter function that excludes design documents.
 * @param {Object} change - a document change that was received in the change feed
 * @returns {Boolean} - true if the document is not a design document, false otherwise
 */
module.exports = function(change) {
  if((! change) || (! change.doc) || (change.doc._id.startsWith('_design/'))) {
    return false;
  }
  else {
    return true;
  }
};
```

#### Custom transformation functions

Custom transformation are used to selectively modify source documents before they are saved in the target database. Like client-side filters, transformation scripts are implemented in Node.JS and are deployed with the service.
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

> If performance is critical, use CouchDB's replication instead of this service to simply synchronize two databases.

You can run this service in [Bluemix](https://github.com/ibm-cds-labs/couchdb-db-transform#deploy-the-service-in-bluemix) or [locally](https://github.com/ibm-cds-labs/couchdb-db-transform#run-the-service-locally).

### Deploy the service in Bluemix

```
$ cf push --no-start
```

#### Configure the service

Before the service can be used you have to identify the source database, the target database and the (optionally) the transformation function.

##### Define the source and target databases

```
$ cf set-env couchdb-db-copy-and-transform-service SOURCE_COUCH_DB_URL https://$USERNAME:$PASSWORD@$REMOTE_USERNAME.cloudant.com/$SOURCE_DATABASE_NAME
$ cf set-env couchdb-db-copy-and-transform-service TARGET_COUCH_DB_URL https://$USERNAME:$PASSWORD@$REMOTE_USERNAME.cloudant.com/$TARGET_DATABASE_NAME
```

> The databases identified by environment variables `SOURCE_COUCH_DB_URL` and `TARGET_COUCH_DB_URL` must exist.

> Note: the service creates a small repository database named `transform_` in the target CouchDB instance. [Learn more ...](https://github.com/ibm-cds-labs/couchdb-db-transform/wiki/Repository-database-overview)

##### Register the filter functions

To enable filtering define environment variables `SERVER_FILTER` and/or `CLIENT_FILTER`. The value assigned to `SERVER_FILTER` must identify an existing filter definition in an existing view in the database identified by `SOURCE_COUCH_DB_URL`. The value assigned to `CLIENT_FILTER` must identify an existing Node.JS script that's deployed with the service.

```
$ cf set-env couchdb-db-copy-and-transform-service SERVER_FILTER <view/filter_name>
$ cf set-env couchdb-db-copy-and-transform-service CLIENT_FILTER </path/to/custom_filter_function.js>
```

> Examples:
> _Register a server-side filter named `exclude_deleted_docs` that is defined in design document `transform_service`._
  ```
  $ cf set-env couchdb-db-copy-and-transform-service SERVER_FILTER transform_service/exclude_deleted_docs
  ```

> _Register a client-side filter named `exclude_design_docs` that is defined in `sample_filter_functions/ignore_design_documents.js`._
  ```
  $ cf set-env couchdb-db-copy-and-transform-service CLIENT_FILTER sample_filter_functions/ignore_design_documents.js
  ```

> The service does not start if any problems are found with the filter definitions.

##### Register transformation functions

Register a transformation function by setting environment variable `TRANSFORM_FUNCTION`.

```
$ cf set-env couchdb-db-copy-and-transform-service TRANSFORM_FUNCTION </path/to/custom_transform_function.js>
```

> Example:
> _Register transformation function `add_timestamp_property.js` that is located in the service's `sample_transform_functions` directory._
  ```
  $ cf set-env couchdb-db-copy-and-transform-service TRANSFORM_FUNCTION sample_transform_functions/add_timestamp_property.js
  ```

##### Hide or secure the service status endpoint

The service provides a `/status` endpoint that can be used to monitor the current service state.

##### Hide the service status endpoint

To disable the endpoint set environment variable `HIDE_CONSOLE` to `true`.

```
$ cf set-env couchdb-db-copy-and-transform-service HIDE_CONSOLE true
```

##### Secure the service status endpoint

To secure the endpoint, define environment variables `CONSOLE_USER` and `CONSOLE_PASSWORD` and assign the desired values.

```
$ cf set-env couchdb-db-copy-and-transform-service CONSOLE_USER <console_user>
$ cf set-env couchdb-db-copy-and-transform-service CONSOLE_PASSWORD <console_user_password>
```

##### Start the service

```
$ cf start couchdb-db-copy-and-transform-service
  ...
$ cf logs couchdb-db-copy-and-transform-service --recent  
```

Once started, the service will listen to the change feed of the source database. When the service is started for the first time, all changes that occurred in the past will be captured. If the service is restarted only documents that have not yet been processed will be retrieved, transformed and stored in the target database. 
> Set environment variable `RESTART` to `true` to always fetch all documents. Note that the service _does not_ delete existing documents in the target database.

> The service terminates immediately if the `SOURCE_COUCH_DB_URL` or `TARGET_COUCH_DB_URL` environment variables are not defined or if the specified filter and/or tranform functions cannot be validated or cause an error during processing.

> You can restart the service after the problem has been addressed. Document processing will resume at the point of failure. [Learn more ...](https://github.com/ibm-cds-labs/couchdb-db-transform/wiki/Repository-database-overview)

##### Monitor the service status

If the service status endpoint is enabled (default), direct your browser to `<service-url>/status`, replacing `<service_url>` with the URL that was assigned to your service instance.

Example: `https://couchdb-db-copy-and-transform-service.mybluemix.net/status`

If prompted, enter the values configured for `CONSOLE_USER` and `CONSOLE_PASSWORD`.

```
{
  status_date: "Thu Sep 08 2016 10:53:44 GMT-0700 (Pacific Daylight Time)",
  service_status: {
    source: {
      database_name: "sample_source",
      last_change_received: "Thu Sep 08 2016 10:53:41 GMT-0700 (Pacific Daylight Time)",
      update_seq: "1206002-g1AAAAI..."
    },
    target: {
      database_name: "sample_target",
      last_applied_update_seq: "103500-g1AAAA..",
      copied: 3000,
      failed: 0,
      last_change_applied: "Thu Sep 08 2016 10:53:42 GMT-0700 (Pacific Daylight Time)"
    },
    filter: {
      server: {
        name: "transform_service/exclude_deleted_docs",
        definition: "..."
      },
      client: {
        name: "sample_filter_functions/ignore_design_documents.js",
        definition: "...",
        filtered: 3
      }
    },
    transformer: {
      name: "sample_transform_functions/add_timestamp_property.js",
      definition: "..."
    }
  }
}
```


## Run the service locally

```
$ npm install
  ...
$ export SOURCE_COUCH_DB_URL=https://$USERNAME:$PASSWORD@$REMOTE_USERNAME.cloudant.com/$SOURCE_DATABASE_NAME
$ export TARGET_COUCH_DB_URL=https://$USERNAME:$PASSWORD@$REMOTE_USERNAME.cloudant.com/$TARGET_DATABASE_NAME
$ export SERVER_FILTER=transform_service/exclude_deleted_docs
$ export CLIENT_FILTER=sample_filter_functions/ignore_design_documents.js
$ export TRANSFORM_FUNCTION=sample_transform_functions/add_timestamp_property.js
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
