' use strict';

const assert = require('assert');
const transformFactory = require('../lib/transform.js');

 describe('lib/transform', function() {
  describe('#getTransformer', function() {
    it('should do nothing if no transformation routine is provided', function() {
      
    	transformFactory.getTransformer(function(err, transformer){
			assert(err === null, 'Err is ' + err);
			assert(transformer.hasTransformationRoutine() === false, 'hasTransformationRoutine() failed');
			assert(transformer.getName() === null, 'getName() failed');
			assert(transformer.getRoutineDefinition() === null, 'getRoutineDefinition() failed');
			transformer.transform(null, function(err, transformedDoc) {
				assert(err === null, 'transform(null,... ' + err);
				assert(transformedDoc === null, 'transform(null,... ' + transformedDoc);
			});

			var doc = {'_id': '123'};
			transformer.transform(doc, function(err, transformedDoc) {
				assert(err === null, 'transform({_id: \'123\'}... ' + err);
				assert.equal(transformedDoc, doc); 	
			});
		}) ;
    });
  });
});
