//-------------------------------------------------------------------------------
// Copyright IBM Corp. 2016
//
// Licensed under the Apache License, Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//-------------------------------------------------------------------------------

'use strict';

const async = require('async');
const crypto = require('crypto');
const debug = require('debug')('cloudant-replication-cleansing:replicate');
const debug_data = require('debug')('cloudant-replication-cleansing:data');
const debug_perf = require('debug')('cloudant-replication-cleansing:performance');

const filter = require('./filter.js');
const transform = require('./transform.js');
const mutil = require('./util.js');
const r_cloudant = require('./util/cloudantRepository.js');

/*
 * Replication function. Listens to the change feed of the database identified by <sourceCredentials>, 
 * and selectively applies those changes to the database identified by <targetCredentials>.
 * 
 * @param {Object} sourceCredentials - credentials for the source database
 * @param {String} sourceCredentials.url - the URL of the source database
 * @param {String} sourceCredentials.dbname - the name of the source database
 * @param {Object} targetCredentials - credentials for the target database
 * @param {String} targetCredentials.url - the URL of the target database
 * @param {String} targetCredentials.dbname - the name of the target database
 * @param {Boolean} restart - if true (false is default), process all document changes in the source database; if false process changes that were not yet processed
 */
function Replicator(sourceCredentials, 
					targetCredentials,
					restart) {

	if((! sourceCredentials) || (!sourceCredentials.url) || (!sourceCredentials.dbname) ||
	   (! targetCredentials) || (!targetCredentials.url) || (!targetCredentials.dbname)
	  ) {
		return;
	}

	// set the default (true = process all document changes, 
	//		            false = process document changes that were not yet processed)
	restart = restart || false;

	// source database	
	const sourceCloudant = require('cloudant')({url:sourceCredentials.url});
	const sourceDb = sourceCloudant.db.use(sourceCredentials.dbname);

	// target database
	const targetCloudant = require('cloudant')({url:targetCredentials.url});
	const targetDb = targetCloudant.db.use(targetCredentials.dbname);

	const concurrency = 1; // maximum number of workers that will insert batches of documents in the target database

	var that = this;

	// replication statistics
	this.stats = {
					copied: 0,					// documents copied
					failed: 0,					// document copy failures
					filtered: 0,				// documents that were not copied because the filter condition was met
					last_change_received: null,	// timestamp for last change notification that was received from the source database
					last_change_applied: null,	// timestamp for last write operation in the target database
					last_update_seq: 0			// CouchDB update_seq number for the last change that was written to the target database
				};

	// for now only Cloudant is supported as repository
	var rr = new r_cloudant.CloudantRepository(targetCloudant, 
											   crypto.createHash('md5').update(JSON.stringify(sourceCredentials) + ' ' + JSON.stringify(targetCredentials)).digest('hex'));

	// bulk insert documents into the target database
	var q = async.queue(function(batch, callback) {

		debug('Saving new batch of documents. Batch size is ' + batch.changes.length);

		var seq = [];
		var docs = [];
		batch.changes.forEach(function(change) {
			seq.push(change.seq);	
			docs.push(change.doc);
		});		

		targetDb.bulk({docs:docs}, 
					  function(err, data) {
						if(err) {
							return callback('Error saving documents in target database "' + 
											targetCredentials.dbname + '": ' + err);
						}
						else {

							// keep track of when the last change was written to the target database
							this.stats.last_change_applied = Date();

							var lastSuccessSeqInBatch = null;
							var errors = [];

							data.forEach(function (result, index) {
								
											if(result.id && result.rev) {
												this.stats.copied++;
												lastSuccessSeqInBatch = seq[index];
											}
											else {
												errors.push(result);
												this.stats.failed++;
											}
										},
										this);

							if(errors.length > 0) {
								return callback('Error saving documents in target database "' + 
												targetCredentials.dbname + '": ' + JSON.stringify(errors));
							}

							this.stats.last_update_seq = lastSuccessSeqInBatch;

							// write recovery info
							rr.saveRecoveryInfo(this.stats.last_update_seq,
												this.stats.last_change_applied,
												function(err) {
													return callback(err);		
												});
						}
					  }.bind(this));

	}.bind(this), concurrency);

	console.log('Replicator ready. Starting to listen for changes in database "' + 
				sourceCredentials.dbname + '". Changes will be applied to database "' + 
				targetCredentials.dbname + '".');

	var changes = [];
	const changes_per_batch = 500;

	// repository is not available
	rr.on('error', function(message) {
		console.error('Error. The repository database is not available: ' + message);		
	});

	// repository is ready
	rr.on('ready', function(recoveryInfo) {

		debug(JSON.stringify({source: mutil.getCredentialsWithoutPassword(sourceCredentials),
			           			     target: mutil.getCredentialsWithoutPassword(targetCredentials)}));

		// save configuration information (informational purposes only)
		rr.saveEvent('start',
					 {source: mutil.getCredentialsWithoutPassword(sourceCredentials), 
					  target: mutil.getCredentialsWithoutPassword(targetCredentials)},
			         function(err) {
			         	if(err) {
			         		console.error('Configuration information could not be saved in repository: ' + err);
			         	}
			         });

		if((! restart) && (recoveryInfo)) {
			// a recovery record was found; continue processing changes in the source database
			// that were recorded after this recovery record was written
			this.stats.last_update_seq = recoveryInfo.last_update_seq;
			this.stats.last_change_applied = recoveryInfo.last_change_applied;

			console.log('Loaded recovery information. Resuming change tracking in source database starting with sequence number "' + 
						recoveryInfo.last_update_seq + '"" dated ' + recoveryInfo.last_change_applied + '.');
		}

		const update_start_sequence = this.stats.last_update_seq;

		// create a change feed for the source database; capture either all document changes (couch_start_seq = 0)
		// or all changes that occurred after couch_start_seq
		var feed = sourceDb.follow({since: update_start_sequence, include_docs: true});

		// instruct the server to not send us documents that were deleted
		feed.filter = function(doc) {
			if(doc._deleted) {
				return false;
			}
			else {
				return true;
			}
		};

		// process document changes
		feed.on('change', function (change) {

				// status monitoring: keep track of when the last change notification was received
				that.stats.last_change_received = Date();

				debug_data(change);

				if(! filter(change)) {

				  	delete change.doc._rev;

					changes.push({seq:change.seq, 
				  			      doc:transform(change.doc)});		  	

					if(changes.length >= changes_per_batch) {
				  		q.push({changes:changes.splice(0, changes_per_batch)}, 
				  			   function(err) {
				  				if(err)	{
				  					console.error(err);
					  			}
								console.log('Replication totals: ' + JSON.stringify(that.stats));
							   });			  	
				  	}
				}
				else {
					that.stats.filtered++;
					debug('Ignored change in document ' + change.doc._id + '.');
					debug(JSON.stringify(change.doc));
				}
		});

		// an error occurred while listening to the change feed
		feed.on('error', function (error) {
				rr.saveEvent('source_feed_error',
							 JSON.stringify(error));
			  	console.error('Source feed error: ' + error);
			   });

		// TBD
		feed.on('inactive', function (message) {
				rr.saveEvent('source_feed_inactive',
							 message);
			  	console.log('Inactive: ' + message);
			  	console.log('Pending: '+ changes.length);
			   });

		// a timeout occurred while listening to the change feed
		feed.on('timeout', function (info) {
				rr.saveEvent('source_feed_timeout',
							 info);
			   });

		// an error occurred while listening to the change feed
		feed.on('retry', function (info) {
				rr.saveEvent('source_feed_retry',
							 info);
			   });

		// change feed is stopping (because of an error or stop())
		feed.on('stop', function () {
				rr.saveEvent('source_feed_stopped',
							 null);
			  	console.error('Source feed stopped.');
			   });

		// Throttle change feed to limit memory consumption; check queue size every 
		// <check_queue_size_interval> ms and pause if more than <max_queued_batches> 
		// are waiting to be processed
		const max_queued_batches = 50;
		const check_queue_size_interval = 10000;
		var feed_paused = false;
		setInterval(function() {
		  
		  if(q.length() > max_queued_batches) {
		  	if(! feed_paused) {
		  		feed.pause();
		  		feed_paused = true;
		  		debug_perf('Pausing change feed to reduce memory consumption. Queue size: ' + q.length());
		  		debug_perf('Memory utilization: ' + JSON.stringify(process.memoryUsage()));
		  	}
		  }
		  else {
		  	if(feed_paused) {
			  	feed.resume();
			  	feed_paused = false;
			  	debug_perf('Resuming change feed. Queue size: ' + q.length());
		  	}
		  }
		}, check_queue_size_interval);

		// follow the change feed
		feed.follow();

		/*
		 * Monitor replication status every <X> ms. If no change activity was reported by the source 
		 * flush the document buffer. X is calculated as follows:
		 *  <inactivity_check_interval> * (Math.pow(2,<inactivity_check_interval_delay_factor>))
		 *  <inactivity_check_interval_delay_factor> is increased if the system is found idle 
		 */
		const inactivity_check_interval = 60 * 1000,			// base check interval is 60 seconds
			  max_inactivity_check_interval_delay_factor = 6;	// 60 seconds * 2^6 = 64 minutes (maximum interval)
		var   inactivity_check_interval_delay_factor = 0;		// 60 seconds * 2^1 = 60 seconds (minimum interval)		  

		var flush_timer = null;

		var flush = function() {
			if(changes.length === 0) {
				if(q.idle()) {
					if(inactivity_check_interval_delay_factor <= max_inactivity_check_interval_delay_factor) {
						inactivity_check_interval_delay_factor++;
						clearInterval(flush_timer);	
						flush_timer = setInterval(flush.bind(this),
		 						                  inactivity_check_interval * (Math.pow(2,inactivity_check_interval_delay_factor)));
					}
				}
				console.log(Date() + ' Document buffer is empty. Next attempt to flush buffer will be made in ' + (inactivity_check_interval * (Math.pow(2,inactivity_check_interval_delay_factor)) / 1000) + ' seconds.');
			}
			else {
				if(q.idle()) {
					// there's at least one document in the buffer that has not been sent to the target
					// write the buffer content to the target
					console.log('Flushing buffer containing ' + changes.length + ' documents.');
					q.push({changes:changes.splice(0, changes_per_batch)}, 
						   function(err) {
								if(err)	{
				  					console.error(err);
					  			}

								console.log('Replication totals: ' + JSON.stringify(this.stats));
							}.bind(this));
				}
				inactivity_check_interval_delay_factor = 0;	
				clearInterval(flush_timer);	
				flush_timer = setInterval(flush.bind(this),
		 				                  inactivity_check_interval * (Math.pow(2,inactivity_check_interval_delay_factor)));
			}
		};

		// interval timer: flush partially filled document buffer if the change feed is idle
		flush_timer = setInterval(flush.bind(this),
		 						  inactivity_check_interval * (Math.pow(2,inactivity_check_interval_delay_factor)));

	}.bind(this)); // rr.on('ready',...

} // constructor

/*
 * Returns system status information
 * @return {Object} status
 * @return {Numeric} status.copied - documents copied
 * @return {Numeric} status.failed - document copy failures
 * @return {Numeric} status.filtered - documents that were not copied because the filter condition was met
 * @return {String} status.last_change_received - timestamp for last change notification that was received from the source database
 * @return {String} status.last_change_applied - timestamp for last write operation in the target database
 * @return {String} status.last_update_seq - CouchDB update_seq number for the last change that was written to the target database
 */
Replicator.prototype.getStatus = function() {
	return this.stats;
};

module.exports = Replicator;
