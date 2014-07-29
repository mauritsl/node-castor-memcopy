"use strict";

(function() {
  var Q = require('q');
  var _ = require('lodash');
  
  var Rows = require('./Rows');
  
  /**
   * Get class
   * 
   * Usage example:
   * 
   * memcopy.get()
   *   .fields(['field', 'field'])
   *   .filter('field', 'uuid', '...')
   *   .orderBy('field', 'asc')
   *   .limit(10)
   * .then(...
   */
  var Get = function(copy) {
    this._copy = copy;
    this._actions = [];
    this._fields;
  };
  
  Get.prototype.fields = function(fields) {
    var self = this;
    this._actions.push(function(rows) {
      self._fields = typeof self._fields === 'undefined' ? fields : self._fields;
      self._fields.filter(function(column) {
        for (var i = 0; i < fields.length; ++i) {
          if (fields[i] == column) {
            return true;
          }
        }
        return false;
      });
      
      var output = [];
      rows.forEach(function(row) {
        var outputRow = {};
        fields.forEach(function(field) {
          outputRow[field] = typeof row[field] === 'undefined' ? null : row[field];
        });
        output.push(outputRow);
      });
      return output;
    });
    return this;
  };
  
  Get.prototype.filter = function(name, value, operator, cs) {
    operator = typeof operator === 'undefined' ? '==' : operator;
    cs = typeof cs === 'undefined' ? false : cs;
    if (!cs && typeof value === 'string') {
      value = value.toLowerCase();
    }
    
    var match = function(testValue) {
      // Check for regular expression matching.
      if (value instanceof RegExp) {
        var match;
        if (typeof testValue == 'number') {
          testValue = testValue.toString();
        }
        if (typeof testValue == 'string') {
          match = testValue.match(value);
        }
        else {
          match = false;
        }
        if (match) {
          return operator === '!==' || operator === '!=' ? false : true;
        }
        else {
          return operator === '!==' || operator === '!=' ? true : false;
        }
      }
      
      if (!cs) {
        testValue = typeof testValue === 'string' ? testValue.toLowerCase() : testValue;
      }
      switch (operator) {
        case '===':
          return testValue === value;
        case '!==':
          return testValue !== value;
        case '!=':
          return testValue != value;
        case '<':
          return testValue < value;
        case '>':
          return testValue > value;
        case '<=':
          return testValue <= value;
        case '>=':
          return testValue >= value;
        case '==':
        default:
          return testValue == value;
      }
    }
    
    this._actions.push(function(rows) {
      return rows.filter(function(row) {
        var testValue = row[name];
        if (testValue instanceof Array) {
          var setMatch = false;
          testValue.forEach(function(elementValue) {
            if (match(elementValue)) {
              setMatch = true;
            }
          });
          return setMatch;
        }
        else {
          return match(testValue);
        }
      });
    });
    return this;
  };
  
  Get.prototype.search = function(fields, keywords) {
    fields = fields instanceof Array ? fields : [fields];
    keywords = keywords.split(' ').map(function(v) {
      return v.trim().toLowerCase();
    });
    
    this._actions.push(function(rows) {
      rows.forEach(function(row) {
        if (typeof row.search_score === 'undefined') {
          row.search_score = 1;
        }
        var match = false;
        fields.forEach(function(field) {
          if (typeof row[field] === 'string') {
            var testValue = row[field].toLowerCase();
            var len = testValue.length;
            keywords.forEach(function(keyword) {
              var index = testValue.indexOf(keyword);
              if (index >= 0) {
                match = true;
                row.search_score *= Math.sqrt(1 - (index / len));
              }
              else {
                // Halve the score for each keyword which was not found.
                row.search_score *= .5;
              }
            });
          }
        });
        if (!match) {
          // None of the keywords were found.
          row.search_score = 0;
        }
      });
      
      // @todo: add "search_score" to the column specification.
      
      return rows.filter(function(row) {
        return row.search_score > 0;
      });
    });
    return this;
  };
  
  Get.prototype.substitute = function(field, memcopy, keyField) {
    var substituteScalar = function(value) {
      var defer = Q.defer();
      if (value === null) {
        defer.resolve(null);
      }
      else {
        memcopy.get()
          .filter(keyField, value)
          .limit(1)
        .then(function(rows) {
          if (rows.valid()) {
            defer.resolve(rows.current());
          }
          defer.resolve(null);
        }).done();
      }
      return defer.promise;
    };
    
    this._actions.push(function(rows) {
      var defer = Q.defer();
      var i = -1, next = function() {
        if (typeof rows[++i] === 'undefined') {
          defer.resolve(rows);
          return;
        }
        var row = rows[i];
        if (row[field] instanceof Array) {
          
          var newValue = [];
          var j = -1, nextScalar = function() {
            if (typeof row[field][++j] === 'undefined') {
              rows[i][field] = newValue;
              next();
              return;
            }
            substituteScalar(row[field][j]).then(function(value) {
              newValue.push(value);
            }).then(nextScalar).done();
          };
          nextScalar();
          
        }
        else {
          substituteScalar(row[field]).then(function(value) {
            rows[i][field] = value;
          }).then(next).done();
        }
      };
      next();
      return defer.promise;
    });
    return this;
  };
  
  Get.prototype.orderBy = function(name, direction) {
    this._actions.push(function(rows) {
      return rows.sort(function(a, b) {
        if (a[name] == b[name]) {
          return 0;
        }
        var v1 = typeof a[name] == 'string' ? a[name].toLowerCase() : a[name];
        var v2 = typeof b[name] == 'string' ? b[name].toLowerCase() : b[name];
        if (v1 > v2) {
          return direction == 'asc' ? 1 : -1;
        }
        else {
          return direction == 'asc' ? -1 : 1;
        }
      });
    });
    return this;
  };
  
  Get.prototype.limit = function(limit) {
    this._actions.push(function(rows) {
      return rows.slice(0, limit);
    });
    return this;
  };
  
  Get.prototype.range = function(offset, limit) {
    this._actions.push(function(rows) {
      return rows.slice(offset, offset + limit);
    });
    return this;
  };
  
  Get.prototype.execute = function() {
    var defer = Q.defer();
    var self = this;
    Q.when(self._copy.ready).then(function() {
      var output = [];
      self._copy.rows.forEach(function(row) {
        output.push(_.clone(row));
      });
      
      var i = -1, next = function() {
        if (typeof self._actions[++i] === 'undefined') {
          var columns = self._copy.columns;
          if (typeof self._fields !== 'undefined') {
            columns = columns.filter(function(column) {
              for (var i = 0; i < self._fields.length; ++i) {
                if (self._fields[i] == column.name) {
                  return true;
                }
              }
              return false;
            });
          }
          
          var rows = new Rows(output, columns);
          defer.resolve(rows);
          return;
        }
        var result = self._actions[i](output);
        Q.when(result).then(function(result) {
          output = result;
          next();
        });
      };
      next();
    }).done();
    
    return defer.promise;
  };
  
  Get.prototype.then = function(callback) {
    return this.execute().then(callback);
  };
  
  module.exports = Get;
}).call(this);
