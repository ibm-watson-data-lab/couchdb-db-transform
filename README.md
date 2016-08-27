
## Deployment Tracker Record Cleansing

This service listens to the change feed of one Cloudant database and applies those changes to another Coudant database. If supplied, an optional transformation routine is run gainst each change record.

### Getting started

```
$ git clone https://github.ibm.com/analytics-advocacy/advocacy-analytics.git
$ cd advocacy-analytics/deployment-tracker-cleansing
$ cf push --no-start
$ cf set-env deployment-tracker-record-cleansing-service SOURCE_CLOUDANT_DB_URL https://$USERNAME:$PASSWORD@$REMOTE_USERNAME.cloudant.com/$SOURCE_DATABASE_NAME
$ cf set-env deployment-tracker-record-cleansing-service TARGET_CLOUDANT_DB_URL https://$USERNAME:$PASSWORD@$REMOTE_USERNAME.cloudant.com/$TARGET_DATABASE_NAME
$ cf set-env deployment-tracker-record-cleansing-service TRANSFORM_FUNCTION sample_transformation_functions/deployment_tracker_cleansing.js
$ cf start deployment-tracker-record-cleansing-service
```

### Monitoring

To display the current service status direct your web browser to 

```
https://deployment-tracker-record-cleansing-service/status
```

To hide the monitoring console from public view set environment variable `HIDE_CONSOLE`

```
$ cf set-env deployment-tracker-record-cleansing-service HIDE_CONSOLE true
```


Sample output:

```
{
	"copied":266583,
	"failed":0,
	"filtered":0,
	"last_change_received":"Tue Aug 16 2016 20:45:02 GMT+0000 (UTC)",
	"last_change_applied":"Tue Aug 16 2016 20:45:15 GMT+0000 (UTC)"
}
```

