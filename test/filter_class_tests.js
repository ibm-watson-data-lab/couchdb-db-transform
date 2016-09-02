' use strict';

const assert = require('assert');
const filterFactory = require('../lib/filter.js');

/*
 describe('lib/filter', function() {
  describe('#getFilter', function() {
    it('should do nothing if no filter routines are provided', function() {
      
    	filterFactory.getFilter(function(err, filter){
			assert(err === null, 'Err is ' + err);
			assert(filter.hasServerFilter() === false, 'hasServerFilter() failed');
			assert(filter.getServerFilterName() === null, 'getServerFilterName() failed');
			assert(filter.getServerFilterDefinition() === null, 'getServerFilterDefinition() failed');
			assert(filter.hasClientFilter() === false, 'hasClientFilter() failed');
			assert(filter.getClientFilterName() === null, 'getClientFilterName() failed');
			assert(filter.getClientFilterDefinition() === null, 'getClientFilterDefinition() failed');
			assert(false, filter.applyClientFilter(), 'applyClientFilter() failed');
			assert(false, filter.applyClientFilter({}), 'applyClientFilter({}) failed');
			assert(true, filter.applyClientFilter({doc:{'_id': '123', '_rev': 'abc'}}), 'applyClientFilter({doc:{\'_id\': \'123\', \'_rev\': \'abc\'}}) failed');
		}) ;
    });
  });
});

*/
