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

const BasicStrategy = require('passport-http').BasicStrategy;
const AnonymousStrategy = require('passport-anonymous');

var strategyName = null;
var strategy = null;

// enable basic authentication if security was configured
if((process.env.CONSOLE_USER) && (process.env.CONSOLE_PASSWORD)) {
	strategyName = 'basic';
	strategy = new BasicStrategy(
								  function(userid, password, done) {
								    if((userid === process.env.CONSOLE_USER) && (password === process.env.CONSOLE_PASSWORD)) {
								    	return done(null, process.env.CONSOLE_USER);
								    }
								    return done(null, false); 
  								  });
}
else {
	strategyName = 'anonymous';
	strategy = new AnonymousStrategy();	
}

module.exports.strategy = strategy;
module.exports.strategyName = strategyName;