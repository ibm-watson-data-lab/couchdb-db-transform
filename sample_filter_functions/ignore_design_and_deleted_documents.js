/*jshint unused:false*/

/*
 * Sample STAGE_2 filter function that removes design documents and deleted documents from the change feed.
 * @param {Object} change - the change 
 * @returns {Boolean} - true if the document should be processed, false if it should be ignored
 */
module.exports = function(change) {

	// refer to http://guide.couchdb.org/draft/notifications.html#filter
	if(change.doc._id.startsWith('_design/') || (change.deleted)) {
		return false;
	}
	else {
		return true;
	}

};
