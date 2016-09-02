module.exports = function (grunt) {
  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    jshint: {
      options : {
        jshintrc: ".jshintrc",
        ignores : [ "node_modules/**/*.js" ]
      },
      src: ["Gruntfile.js", "app.js", "lib/*.js"],
    },
    jscs: {
      src: ["Gruntfile.js", "app.js", "lib/*.js"],
      options: {
        config: ".jscsrc",
        esnext: true, // If you use ES6 http://jscs.info/overview.html#esnext
        verbose: true, // If you need output with rule names http://jscs.info/overview.html#verbose
        requireCurlyBraces: [ "if" ]
      }
    },
    simplemocha: {
      test: {
        src: ["test/*.js"]
      },
      options: {
        run:true
      }
    }
  });

  grunt.loadNpmTasks("grunt-contrib-jshint");
  grunt.loadNpmTasks("grunt-jscs");
  grunt.loadNpmTasks('grunt-simple-mocha');

  grunt.registerTask("default", [ "lint", "jscs", "simplemocha" ]);
  grunt.registerTask("lint", "Check for common code problems.", [ "jshint" ]);
};