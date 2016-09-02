/*
 * Sample client-side filter function that removes deleted documents from the processing pipeline.
 * Refer to http://guide.couchdb.org/draft/notifications.html for details about the change parameter
 * @param {Object} change - a document change that was received in the change feed
 * @returns {Boolean} - true if the document has not been deleted in the source database, false otherwise
 */
module.exports = function(change) {
	if((! change) || (change.deleted)) {
		return false;
	}
	else {
		return true;
	}
};