(function (window, angular) {

  'use strict';


  //====================//
  // PRIVATE PROPERTIES //
  //====================//

  var defaultFieldset = {
    title: '',
    fields: {}
  };

  var defaultField = {
    title: '',
    type: 'string',
    readonly: false,
    required: false
  };


  //=================//
  // ANGULAR MODULES //
  //=================//

  angular.module('betsol.entityForm', [
    'ui.bootstrap',
    'ui.bootstrap.datetimepicker'
  ])

    .factory('EntityForm', function ($rootScope, $injector, $parse) {

      var successStrategy = new RedirectStrategy('success');
      var cancelStrategy = new RedirectStrategy('cancel');

      return function (config) {

        // Handling config.
        var defaultConfig = {
          scope: null,
          repository: null,
          entity: null,
          mode: null,
          scheme: null,
          successStrategy: null,
          cancelStrategy: null,
          redirectState: null
        };
        config = angular.extend({}, defaultConfig, config);

        if (!config.scope) {
          return console.log('Missing scope');
        }

        if (!config.repository) {
          return console.log('Missing repository');
        }

        var $scope = config.scope;
        var entity = config.entity || {};
        var mode = config.mode || 'create';
        var repository = config.repository;
        var formScheme = normalizeForm(config.scheme || {});

        if ('function' === typeof config.successStrategy) {
          successStrategy = config.successStrategy;
        }

        if ('function' === typeof config.cancelStrategy) {
          cancelStrategy = config.cancelStrategy;
        }

        if ('update' == mode && !entity.id) {
          return console.log('Entity must have an ID in update mode');
        }

        $scope.processing = false;
        $scope.mode = mode;
        $scope.entity = scopeEntityFromEntity(entity);
        $scope.formScheme = formScheme;

        $scope.save = function (form) {
          if ($scope.processing) {
            return;
          }
          if (!form.$valid) {
            return alert('Пожалуйста, заполните форму корректно');
          }
          $scope.processing = true;
          var data = getDataToSave(formScheme, $scope.entity);
          if ('update' == mode) {
            data.id = entity.id;
          }
          repository
            .save(data)
            .then(function () {
              $injector.invoke(successStrategy, null, {
                config: config,
                $scope: $scope
              });
            })
            .catch(function () {
              alert('Не удалось сохранить форму, пожалуйста, проверьте вводимые данные');
            })
            .finally(function () {
              $scope.processing = false;
            })
          ;
        };

        $scope.reset = function () {
          $scope.entity = scopeEntityFromEntity(entity);
        };

        $scope.cancel = function () {
          $injector.invoke(cancelStrategy, null, {
            config: config,
            $scope: $scope
          });
        };

        $scope.entityPath = function (string) {
          var getter = $parse(string);
          var setter = getter.assign;
          return function (newValue) {
            if ('undefined' !== typeof newValue) {
              setter($scope, newValue);
            }
            return getter($scope);
          };
        };

        $scope.getInputAddonImage = function (entity, url) {
          if ('function' === typeof url) {
            return url(entity);
          } else {
            return url;
          }
        };

      }

    })

    .directive('dateTimeModel', function () {
      return {
        restrict: 'A',
        require: 'ngModel',
        link: function (scope, element, attrs, ngModel) {
          ngModel.$formatters.push(function (value) {
            if (moment.isMoment(value)) {
              return value.toDate();
            } else {
              return value;
            }
          });
          ngModel.$parsers.push(function (value) {
            if (value instanceof Date) {
              return moment(value);
            } else {
              return value;
            }
          });
        }
      }
    })

  ;


  //===================//
  // PRIVATE FUNCTIONS //
  //===================//

  /**
   * Returns entity to be used inside of scope,
   * based on entity received from the repository.
   *
   * @param {object} entity
   *
   * @returns {object}
   */
  function scopeEntityFromEntity (entity) {
    return angular.extend({}, entity);
  }

  /**
   * Returns data to be sent to the repository,
   * based on scope entity.
   *
   * @param {object} formScheme
   * @param {object} scopeEntity
   *
   * @returns {object}
   */
  function getDataToSave (formScheme, scopeEntity) {
    var result = {};
    iterateFields(formScheme, function (fieldName, field) {
      if (!field.readonly && !field.hidden) {
        propertyPathSet(result, fieldName, propertyPathGet(scopeEntity, fieldName));
      }
    });
    return result;
  }

  /**
   * Normalizes user-provided fields.
   *
   * @param {object} formScheme
   *
   * @returns {object}
   */
  function normalizeForm (formScheme) {
    // Merging with default structures.
    angular.forEach(formScheme, function (fieldset, key) {
      formScheme[key] = angular.extend({}, defaultFieldset, fieldset);
      angular.forEach(formScheme[key].fields, function (field, fieldName) {
        formScheme[key].fields[fieldName] = angular.extend({}, defaultField, field);
      });
    });
    // Adding additional properties used in templating.
    iterateFields(formScheme, function (fieldName, field) {
      switch (field.type) {
        case 'string':
        case 'url':
        case 'boolean':
        case 'email':
        case 'phoneNumber':
        case 'number':
          field.elementType = 'input';
          break;
        case 'datetime':
        case 'date':
          field.elementType = field.type;
          break;
        case 'enum':
          if (!field.selectExpression) {
            field.selectExpression = 'key as value for (key, value)';
          }
          break;
        case 'text':
          if (!field.rowsCount) {
            field.rowsCount = 10;
          }
          break;
      }
      switch (field.type) {
        case 'string':
          field.inputType = 'text';
          break;
        case 'boolean':
          field.inputType = 'checkbox';
          break;
        case 'phoneNumber':
          field.inputType = 'tel';
          break;
        default:
          field.inputType = field.type;
      }
    });
    return formScheme;
  }

  /**
   * Iterates specified form scheme fields and
   * executes a specified callback function for each field.
   *
   * @param {object} formScheme
   * @param {function} cb
   */
  function iterateFields (formScheme, cb) {
    angular.forEach(formScheme, function (fieldset, key) {
      angular.forEach(formScheme[key].fields, function (field, fieldName) {
        cb(fieldName, field);
      });
    });
  }

  /**
   * Default redirect strategy constructor for different modes.
   *
   * @param {string} mode
   * @returns {function}
   *
   * @constructor
   */
  function RedirectStrategy (mode) {
    return function (config, $injector) {

      // Trying to redirect to the previous URL first.
      if ($injector.has('previousUrl')) {
        var previousUrl = $injector.get('previousUrl');
        if (previousUrl.hasUrl()) {
          previousUrl.redirectBack();
          return;
        }
      }

      // Using UI router if available.
      if ($injector.has('$state')) {
        var $state = $injector.get('$state');
        if (config.redirectState) {
          // Redirecting to the pre-configured state.
          $state.go(config.redirectState);
        } else {
          // Just reloading the state.
          notifyUser();
          $state.reload();
        }
        return;
      }

      // Using default router if available to refresh the page.
      if ($injector.has('router')) {
        var router = $injector.get('router');
        notifyUser();
        router.reload();
        return;
      }

      // Falling back to vanilla JavaScript.
      notifyUser();
      window.location.reload();


      function notifyUser () {
        if ('success' == mode) {
          alert('Данные успешно сохранены');
        }
      }

    }
  }

  /**
   * Sets object property value by it's path.
   *
   * @param {Object} object
   * @param {string} path
   * @param {*} value
   */
  function propertyPathSet (object, path, value) {
    var parts = path.split('.');
    var reference = object;
    var i = 0;
    var imax = parts.length - 1;
    angular.forEach(parts, function (part) {
      reference[part] = reference[part] || {};
      if (i == imax) {
        reference[part] = value;
      } else {
        reference = reference[part];
      }
      i++;
    });
    reference = value;
  }

  /**
   * Returns property value from object by it's path.
   *
   * @param {Object} object
   * @param {string} path
   *
   * @returns {Object}
   */
  function propertyPathGet (object, path) {
    return eval('object.' + path);
  }

})(window, angular);
